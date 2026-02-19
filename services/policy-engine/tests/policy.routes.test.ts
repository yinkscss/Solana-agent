import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { PolicyController } from '../src/controllers/policy.controller.js';
import { EvaluationController } from '../src/controllers/evaluation.controller.js';
import { createPolicyRoutes, createWalletPolicyRoutes } from '../src/routes/policies.js';
import { createEvaluationRoutes } from '../src/routes/evaluations.js';
import type { PolicyService } from '../src/services/policy.service.js';
import type { EvaluatorService } from '../src/services/evaluator.service.js';
import type { Policy } from '../src/types/index.js';

const makePolicy = (overrides: Partial<Policy> = {}): Policy => ({
  id: 'policy-1',
  walletId: 'wallet-1',
  name: 'Test Policy',
  rules: [{ type: 'token_allowlist', allowedMints: ['SOL'] }],
  version: 1,
  isActive: true,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  ...overrides,
});

const createMockPolicyService = (): PolicyService =>
  ({
    createPolicy: vi.fn().mockResolvedValue(makePolicy()),
    getPolicy: vi.fn().mockResolvedValue(makePolicy()),
    updatePolicy: vi.fn().mockResolvedValue(makePolicy()),
    deactivatePolicy: vi.fn().mockResolvedValue(makePolicy({ isActive: false })),
    activatePolicy: vi.fn().mockResolvedValue(makePolicy()),
    getPoliciesForWallet: vi.fn().mockResolvedValue([makePolicy()]),
    getActivePoliciesForWallet: vi.fn().mockResolvedValue([makePolicy()]),
  }) as unknown as PolicyService;

const createMockEvaluatorService = (): EvaluatorService =>
  ({
    evaluateTransaction: vi.fn().mockResolvedValue({
      decision: 'allow',
      reasons: ['All policies passed'],
      evaluatedPolicies: [{ policyId: 'policy-1', decision: 'allow' }],
    }),
  }) as unknown as EvaluatorService;

describe('Policy Routes', () => {
  let app: Hono;
  let policyService: PolicyService;

  beforeEach(() => {
    policyService = createMockPolicyService();
    const controller = new PolicyController(policyService);
    app = new Hono();
    app.route('/api/v1/policies', createPolicyRoutes(controller));
    app.route('/api/v1/wallets', createWalletPolicyRoutes(controller));
  });

  it('POST /api/v1/policies creates a policy', async () => {
    const res = await app.request('/api/v1/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Policy',
        rules: [{ type: 'token_allowlist', allowedMints: ['SOL'] }],
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('POST /api/v1/policies returns 400 on invalid body', async () => {
    const res = await app.request('/api/v1/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'No wallet' }),
    });

    expect(res.status).toBe(400);
  });

  it('GET /api/v1/policies/:policyId returns a policy', async () => {
    const res = await app.request('/api/v1/policies/policy-1');

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.id).toBe('policy-1');
  });

  it('GET /api/v1/policies/:policyId returns 404 when not found', async () => {
    vi.mocked(policyService.getPolicy).mockResolvedValue(null);

    const res = await app.request('/api/v1/policies/nonexistent');

    expect(res.status).toBe(404);
  });

  it('DELETE /api/v1/policies/:policyId deactivates a policy', async () => {
    const res = await app.request('/api/v1/policies/policy-1', { method: 'DELETE' });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('GET /api/v1/wallets/:walletId/policies returns wallet policies', async () => {
    const res = await app.request('/api/v1/wallets/wallet-1/policies');

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
  });
});

describe('Evaluation Routes', () => {
  let app: Hono;

  beforeEach(() => {
    const evaluatorService = createMockEvaluatorService();
    const controller = new EvaluationController(evaluatorService);
    app = new Hono();
    app.route('/api/v1/evaluate', createEvaluationRoutes(controller));
  });

  it('POST /api/v1/evaluate evaluates a transaction', async () => {
    const res = await app.request('/api/v1/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletId: '550e8400-e29b-41d4-a716-446655440000',
        amount: '1000',
        tokenMint: 'SOL',
        destinationAddress: 'dest-addr',
        programIds: ['programA'],
        instructions: [],
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.decision).toBe('allow');
  });

  it('POST /api/v1/evaluate returns 400 on missing fields', async () => {
    const res = await app.request('/api/v1/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletId: 'bad' }),
    });

    expect(res.status).toBe(400);
  });
});
