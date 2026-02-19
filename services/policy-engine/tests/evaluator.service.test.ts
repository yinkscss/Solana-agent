import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EvaluatorService } from '../src/services/evaluator.service.js';
import type { PolicyService } from '../src/services/policy.service.js';
import type { Policy, TransactionDetails } from '../src/types/index.js';

const mockRedis = () => ({
  get: vi.fn().mockResolvedValue(null),
  multi: vi.fn().mockReturnValue({
    incrby: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  }),
});

const baseTx: TransactionDetails = {
  walletId: 'wallet-1',
  amount: 500n,
  tokenMint: 'SOL',
  destinationAddress: 'safe-addr',
  programIds: ['programA'],
  instructions: [],
};

const makePolicy = (overrides: Partial<Policy> = {}): Policy => ({
  id: 'policy-1',
  walletId: 'wallet-1',
  name: 'Test Policy',
  rules: [],
  version: 1,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('EvaluatorService', () => {
  let evaluator: EvaluatorService;
  let policyService: PolicyService;
  let redis: ReturnType<typeof mockRedis>;

  beforeEach(() => {
    redis = mockRedis();
    policyService = {
      getActivePoliciesForWallet: vi.fn().mockResolvedValue([]),
    } as unknown as PolicyService;
    evaluator = new EvaluatorService(policyService, redis as any);
  });

  it('allows when no active policies exist', async () => {
    const result = await evaluator.evaluateTransaction('wallet-1', baseTx);

    expect(result.decision).toBe('allow');
    expect(result.reasons).toContain('No active policies');
  });

  it('allows when all rules pass', async () => {
    const policy = makePolicy({
      rules: [
        { type: 'program_allowlist', allowedPrograms: ['programA'] },
        { type: 'token_allowlist', allowedMints: ['SOL'] },
      ],
    });
    vi.mocked(policyService.getActivePoliciesForWallet).mockResolvedValue([policy]);

    const result = await evaluator.evaluateTransaction('wallet-1', baseTx);

    expect(result.decision).toBe('allow');
    expect(result.evaluatedPolicies).toHaveLength(1);
    expect(result.evaluatedPolicies[0]!.decision).toBe('allow');
  });

  it('denies fast when a rule fails', async () => {
    const policy = makePolicy({
      rules: [
        { type: 'address_blocklist', blockedAddresses: ['safe-addr'] },
        { type: 'token_allowlist', allowedMints: ['SOL'] },
      ],
    });
    vi.mocked(policyService.getActivePoliciesForWallet).mockResolvedValue([policy]);

    const result = await evaluator.evaluateTransaction('wallet-1', baseTx);

    expect(result.decision).toBe('deny');
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('denies on spending limit exceeded', async () => {
    const policy = makePolicy({
      rules: [
        {
          type: 'spending_limit',
          maxPerTransaction: 100n,
          maxPerWindow: 1000n,
          windowDuration: 3600,
          tokenMint: 'SOL',
        },
      ],
    });
    vi.mocked(policyService.getActivePoliciesForWallet).mockResolvedValue([policy]);

    const result = await evaluator.evaluateTransaction('wallet-1', baseTx);

    expect(result.decision).toBe('deny');
  });

  it('processes multiple policies and stops on deny', async () => {
    const policy1 = makePolicy({
      id: 'policy-1',
      rules: [{ type: 'token_allowlist', allowedMints: ['SOL'] }],
    });
    const policy2 = makePolicy({
      id: 'policy-2',
      rules: [{ type: 'address_blocklist', blockedAddresses: ['safe-addr'] }],
    });
    vi.mocked(policyService.getActivePoliciesForWallet).mockResolvedValue([
      policy1,
      policy2,
    ]);

    const result = await evaluator.evaluateTransaction('wallet-1', baseTx);

    expect(result.decision).toBe('deny');
    expect(result.evaluatedPolicies).toHaveLength(2);
  });
});
