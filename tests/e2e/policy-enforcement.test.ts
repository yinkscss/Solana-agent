import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { PolicyController } from '../../services/policy-engine/src/controllers/policy.controller.js';
import { EvaluationController } from '../../services/policy-engine/src/controllers/evaluation.controller.js';
import { createPolicyRoutes, createWalletPolicyRoutes } from '../../services/policy-engine/src/routes/policies.js';
import { createEvaluationRoutes } from '../../services/policy-engine/src/routes/evaluations.js';
import { EvaluatorService } from '../../services/policy-engine/src/services/evaluator.service.js';
import { errorHandler } from '../../services/policy-engine/src/middleware/error-handler.js';
import type { Policy, PolicyRule } from '../../services/policy-engine/src/types/index.js';
import type { PolicyService } from '../../services/policy-engine/src/services/policy.service.js';

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
    getPolicy: async (policyId: string) => store.get(policyId) ?? null,
    getPoliciesForWallet: async (walletId: string) =>
      [...store.values()].filter((p) => p.walletId === walletId),
    getActivePoliciesForWallet: async (walletId: string) =>
      [...store.values()].filter((p) => p.walletId === walletId && p.isActive),
    updatePolicy: async (policyId: string, updates: { name?: string; rules?: PolicyRule[] }) => {
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
    deactivatePolicy: async (policyId: string) => {
      const existing = store.get(policyId);
      if (!existing) return null;
      const updated = { ...existing, isActive: false, updatedAt: new Date() };
      store.set(policyId, updated);
      return updated;
    },
    activatePolicy: async (policyId: string) => {
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

  return { app, policyService };
};

const post = (app: Hono, path: string, body: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const put = (app: Hono, path: string, body: unknown) =>
  app.request(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('Policy Enforcement E2E', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    const ctx = createTestApp();
    app = ctx.app;
  });

  it('allows transaction within spending limit', async () => {
    const createRes = await post(app, '/api/v1/policies', {
      walletId: WALLET_ID,
      name: 'SOL Spending Cap',
      rules: [{
        type: 'spending_limit',
        maxPerTransaction: '2000000000',
        maxPerWindow: '10000000000',
        windowDuration: 3600,
        tokenMint: 'SOL',
      }],
    });
    expect(createRes.status).toBe(201);

    const evalRes = await post(app, '/api/v1/evaluate', {
      walletId: WALLET_ID,
      amount: '1000000000',
      tokenMint: 'SOL',
      destinationAddress: 'safe-dest',
      programIds: ['11111111111111111111111111111111'],
      instructions: [],
    });
    expect(evalRes.status).toBe(200);
    const { data } = await evalRes.json();
    expect(data.decision).toBe('allow');
  });

  it('denies transaction exceeding spending limit', async () => {
    await post(app, '/api/v1/policies', {
      walletId: WALLET_ID,
      name: 'Tight SOL Limit',
      rules: [{
        type: 'spending_limit',
        maxPerTransaction: '2000000000',
        maxPerWindow: '10000000000',
        windowDuration: 3600,
        tokenMint: 'SOL',
      }],
    });

    const evalRes = await post(app, '/api/v1/evaluate', {
      walletId: WALLET_ID,
      amount: '5000000000',
      tokenMint: 'SOL',
      destinationAddress: 'any-dest',
      programIds: ['11111111111111111111111111111111'],
      instructions: [],
    });
    expect(evalRes.status).toBe(200);
    const { data } = await evalRes.json();
    expect(data.decision).toBe('deny');
    expect(data.reasons.length).toBeGreaterThan(0);
  });

  it('applies updated policy rules after modification', async () => {
    const createRes = await post(app, '/api/v1/policies', {
      walletId: WALLET_ID,
      name: 'Permissive Limit',
      rules: [{
        type: 'spending_limit',
        maxPerTransaction: '10000000000',
        maxPerWindow: '50000000000',
        windowDuration: 3600,
        tokenMint: 'SOL',
      }],
    });
    const { data: policy } = await createRes.json();

    const evalPayload = {
      walletId: WALLET_ID,
      amount: '5000000000',
      tokenMint: 'SOL',
      destinationAddress: 'dest',
      programIds: ['11111111111111111111111111111111'],
      instructions: [],
    };

    const eval1 = await post(app, '/api/v1/evaluate', evalPayload);
    const { data: result1 } = await eval1.json();
    expect(result1.decision).toBe('allow');

    await put(app, `/api/v1/policies/${policy.id}`, {
      rules: [{
        type: 'spending_limit',
        maxPerTransaction: '1000000000',
        maxPerWindow: '5000000000',
        windowDuration: 3600,
        tokenMint: 'SOL',
      }],
    });

    const eval2 = await post(app, '/api/v1/evaluate', evalPayload);
    const { data: result2 } = await eval2.json();
    expect(result2.decision).toBe('deny');
  });
});
