import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { PolicyController } from '../src/controllers/policy.controller.js';
import { EvaluationController } from '../src/controllers/evaluation.controller.js';
import { createPolicyRoutes, createWalletPolicyRoutes } from '../src/routes/policies.js';
import { createEvaluationRoutes } from '../src/routes/evaluations.js';
import { EvaluatorService } from '../src/services/evaluator.service.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import type { Policy, PolicyRule } from '../src/types/index.js';
import type { PolicyService } from '../src/services/policy.service.js';

const WALLET_ID = '550e8400-e29b-41d4-a716-446655440000';

const createInMemoryPolicyService = (): PolicyService => {
  const store = new Map<string, Policy>();
  let idCounter = 0;

  return {
    createPolicy: async (walletId: string, name: string, rules: PolicyRule[]): Promise<Policy> => {
      const id = `policy-${++idCounter}`;
      const policy: Policy = {
        id,
        walletId,
        name,
        rules,
        version: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.set(id, policy);
      return policy;
    },

    getPolicy: async (policyId: string): Promise<Policy | null> => {
      return store.get(policyId) ?? null;
    },

    getPoliciesForWallet: async (walletId: string): Promise<Policy[]> => {
      return [...store.values()].filter((p) => p.walletId === walletId);
    },

    getActivePoliciesForWallet: async (walletId: string): Promise<Policy[]> => {
      return [...store.values()].filter((p) => p.walletId === walletId && p.isActive);
    },

    updatePolicy: async (
      policyId: string,
      updates: { name?: string; rules?: PolicyRule[] },
    ): Promise<Policy | null> => {
      const existing = store.get(policyId);
      if (!existing) return null;

      const updated: Policy = {
        ...existing,
        ...(updates.name && { name: updates.name }),
        ...(updates.rules && { rules: updates.rules }),
        version: existing.version + 1,
        updatedAt: new Date(),
      };
      store.set(policyId, updated);
      return updated;
    },

    deactivatePolicy: async (policyId: string): Promise<Policy | null> => {
      const existing = store.get(policyId);
      if (!existing) return null;

      const updated = { ...existing, isActive: false, updatedAt: new Date() };
      store.set(policyId, updated);
      return updated;
    },

    activatePolicy: async (policyId: string): Promise<Policy | null> => {
      const existing = store.get(policyId);
      if (!existing) return null;

      const updated = { ...existing, isActive: true, updatedAt: new Date() };
      store.set(policyId, updated);
      return updated;
    },
  } as PolicyService;
};

const createMockRedis = () => {
  const cache = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => cache.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      cache.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      cache.delete(key);
      return 1;
    }),
    multi: vi.fn(() => ({
      incrby: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    })),
    _cache: cache,
  };
};

const createTestApp = () => {
  const redis = createMockRedis();
  const policyService = createInMemoryPolicyService();
  const evaluatorService = new EvaluatorService(policyService, redis as any);

  const policyController = new PolicyController(policyService);
  const evaluationController = new EvaluationController(evaluatorService);

  const app = new Hono();
  app.route('/api/v1/policies', createPolicyRoutes(policyController));
  app.route('/api/v1/wallets', createWalletPolicyRoutes(policyController));
  app.route('/api/v1/evaluate', createEvaluationRoutes(evaluationController));
  app.onError(errorHandler);

  return { app, redis, policyService };
};

describe('Policy Engine Integration', () => {
  let app: Hono;
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    vi.clearAllMocks();
    const ctx = createTestApp();
    app = ctx.app;
    redis = ctx.redis;
  });

  describe('create policy + evaluate allow', () => {
    it('allows a transaction within the spending limit', async () => {
      const createRes = await app.request('/api/v1/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: WALLET_ID,
          name: 'SOL Spending Limit',
          rules: [{
            type: 'spending_limit',
            maxPerTransaction: '1000000000',
            maxPerWindow: '5000000000',
            windowDuration: 3600,
            tokenMint: 'SOL',
          }],
        }),
      });

      expect(createRes.status).toBe(201);
      const { data: policy } = await createRes.json();
      expect(policy.isActive).toBe(true);

      const evalRes = await app.request('/api/v1/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: WALLET_ID,
          amount: '500000000',
          tokenMint: 'SOL',
          destinationAddress: 'safe-destination',
          programIds: ['11111111111111111111111111111111'],
          instructions: [],
        }),
      });

      expect(evalRes.status).toBe(200);
      const { data: evaluation } = await evalRes.json();
      expect(evaluation.decision).toBe('allow');
    });
  });

  describe('create policy + evaluate deny', () => {
    it('denies a transaction exceeding the per-transaction spending limit', async () => {
      await app.request('/api/v1/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: WALLET_ID,
          name: 'Tight Limit',
          rules: [{
            type: 'spending_limit',
            maxPerTransaction: '1000000000',
            maxPerWindow: '5000000000',
            windowDuration: 3600,
            tokenMint: 'SOL',
          }],
        }),
      });

      const evalRes = await app.request('/api/v1/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: WALLET_ID,
          amount: '2000000000',
          tokenMint: 'SOL',
          destinationAddress: 'any-destination',
          programIds: ['11111111111111111111111111111111'],
          instructions: [],
        }),
      });

      expect(evalRes.status).toBe(200);
      const { data: evaluation } = await evalRes.json();
      expect(evaluation.decision).toBe('deny');
      expect(evaluation.reasons.length).toBeGreaterThan(0);
    });
  });

  describe('multiple policies on same wallet', () => {
    it('evaluates both spending_limit and program_allowlist rules', async () => {
      await app.request('/api/v1/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: WALLET_ID,
          name: 'Spending Guard',
          rules: [{
            type: 'spending_limit',
            maxPerTransaction: '1000000000',
            maxPerWindow: '10000000000',
            windowDuration: 3600,
            tokenMint: 'SOL',
          }],
        }),
      });

      await app.request('/api/v1/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: WALLET_ID,
          name: 'Program Guard',
          rules: [{
            type: 'program_allowlist',
            allowedPrograms: ['11111111111111111111111111111111'],
          }],
        }),
      });

      const evalRes = await app.request('/api/v1/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: WALLET_ID,
          amount: '500000000',
          tokenMint: 'SOL',
          destinationAddress: 'dest',
          programIds: ['11111111111111111111111111111111'],
          instructions: [],
        }),
      });

      expect(evalRes.status).toBe(200);
      const { data: evaluation } = await evalRes.json();
      expect(evaluation.decision).toBe('allow');
      expect(evaluation.evaluatedPolicies.length).toBe(2);
    });

    it('denies when one of the policies fails', async () => {
      await app.request('/api/v1/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: WALLET_ID,
          name: 'Token Guard',
          rules: [{
            type: 'token_allowlist',
            allowedMints: ['SOL'],
          }],
        }),
      });

      await app.request('/api/v1/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: WALLET_ID,
          name: 'Address Guard',
          rules: [{
            type: 'address_blocklist',
            blockedAddresses: ['evil-address'],
          }],
        }),
      });

      const evalRes = await app.request('/api/v1/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: WALLET_ID,
          amount: '100',
          tokenMint: 'SOL',
          destinationAddress: 'evil-address',
          programIds: [],
          instructions: [],
        }),
      });

      expect(evalRes.status).toBe(200);
      const { data: evaluation } = await evalRes.json();
      expect(evaluation.decision).toBe('deny');
    });
  });

  describe('policy CRUD lifecycle', () => {
    it('creates → gets → updates → gets again → deactivates a policy', async () => {
      const createRes = await app.request('/api/v1/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: WALLET_ID,
          name: 'Lifecycle Policy',
          rules: [{
            type: 'token_allowlist',
            allowedMints: ['SOL'],
          }],
        }),
      });
      expect(createRes.status).toBe(201);
      const { data: created } = await createRes.json();
      expect(created.name).toBe('Lifecycle Policy');
      expect(created.isActive).toBe(true);

      const getRes = await app.request(`/api/v1/policies/${created.id}`);
      expect(getRes.status).toBe(200);
      const { data: fetched } = await getRes.json();
      expect(fetched.id).toBe(created.id);

      const updateRes = await app.request(`/api/v1/policies/${created.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated Policy',
          rules: [{
            type: 'token_allowlist',
            allowedMints: ['SOL', 'USDC'],
          }],
        }),
      });
      expect(updateRes.status).toBe(200);
      const { data: updated } = await updateRes.json();
      expect(updated.name).toBe('Updated Policy');
      expect(updated.version).toBe(2);

      const getAgainRes = await app.request(`/api/v1/policies/${created.id}`);
      expect(getAgainRes.status).toBe(200);
      const { data: fetchedAgain } = await getAgainRes.json();
      expect(fetchedAgain.name).toBe('Updated Policy');

      const deactivateRes = await app.request(`/api/v1/policies/${created.id}`, {
        method: 'DELETE',
      });
      expect(deactivateRes.status).toBe(200);
      const { data: deactivated } = await deactivateRes.json();
      expect(deactivated.isActive).toBe(false);
    });
  });

  describe('cache invalidation', () => {
    it('evaluates correctly, then still evaluates after re-evaluation', async () => {
      await app.request('/api/v1/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: WALLET_ID,
          name: 'Cache Test Policy',
          rules: [{
            type: 'program_allowlist',
            allowedPrograms: ['programA'],
          }],
        }),
      });

      const evalPayload = {
        walletId: WALLET_ID,
        amount: '100',
        tokenMint: 'SOL',
        destinationAddress: 'dest',
        programIds: ['programA'],
        instructions: [],
      };

      const eval1 = await app.request('/api/v1/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evalPayload),
      });
      const { data: result1 } = await eval1.json();
      expect(result1.decision).toBe('allow');

      const eval2 = await app.request('/api/v1/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evalPayload),
      });
      const { data: result2 } = await eval2.json();
      expect(result2.decision).toBe('allow');

      const evalDenied = await app.request('/api/v1/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...evalPayload,
          programIds: ['unknownProgram'],
        }),
      });
      const { data: resultDenied } = await evalDenied.json();
      expect(resultDenied.decision).toBe('deny');
    });
  });

  describe('error handling', () => {
    it('returns 404 for nonexistent policy', async () => {
      const res = await app.request('/api/v1/policies/nonexistent-id');
      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid create body', async () => {
      const res = await app.request('/api/v1/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Missing wallet id' }),
      });
      expect(res.status).toBe(400);
    });
  });
});
