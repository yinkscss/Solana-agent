import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpendingLimitRuleEvaluator } from '../src/rules/spending-limit.rule.js';
import type { SpendingLimitRule, TransactionDetails } from '../src/types/index.js';
import type { EvaluationContext } from '../src/rules/rule.interface.js';

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
  amount: 1000n,
  tokenMint: 'SOL',
  destinationAddress: 'dest-addr',
  programIds: ['11111111111111111111111111111111'],
  instructions: [],
};

const baseRule: SpendingLimitRule = {
  type: 'spending_limit',
  maxPerTransaction: 5000n,
  maxPerWindow: 10000n,
  windowDuration: 3600,
  tokenMint: 'SOL',
};

const baseContext = (redis: any): EvaluationContext => ({
  redis,
  walletId: 'wallet-1',
  timestamp: new Date('2025-01-01T12:00:00Z'),
});

describe('SpendingLimitRuleEvaluator', () => {
  let evaluator: SpendingLimitRuleEvaluator;
  let redis: ReturnType<typeof mockRedis>;

  beforeEach(() => {
    evaluator = new SpendingLimitRuleEvaluator();
    redis = mockRedis();
  });

  it('allows transactions under per-transaction limit', async () => {
    const result = await evaluator.evaluate(baseRule, baseTx, baseContext(redis));

    expect(result.decision).toBe('allow');
    expect(result.ruleType).toBe('spending_limit');
  });

  it('denies transactions exceeding per-transaction limit', async () => {
    const tx = { ...baseTx, amount: 6000n };

    const result = await evaluator.evaluate(baseRule, tx, baseContext(redis));

    expect(result.decision).toBe('deny');
    expect(result.reason).toContain('per-transaction limit');
  });

  it('denies when window spending would exceed limit', async () => {
    redis.get.mockResolvedValue('9500');

    const result = await evaluator.evaluate(baseRule, baseTx, baseContext(redis));

    expect(result.decision).toBe('deny');
    expect(result.reason).toContain('Window spending');
  });

  it('allows and increments window counter when within limits', async () => {
    redis.get.mockResolvedValue('3000');

    const result = await evaluator.evaluate(baseRule, baseTx, baseContext(redis));

    expect(result.decision).toBe('allow');
    expect(redis.multi).toHaveBeenCalled();
  });

  it('skips rule if token mint does not match', async () => {
    const rule: SpendingLimitRule = { ...baseRule, tokenMint: 'USDC' };
    const tx = { ...baseTx, tokenMint: 'BONK' };

    const result = await evaluator.evaluate(rule, tx, baseContext(redis));

    expect(result.decision).toBe('allow');
  });

  it('tracks spending at exact window boundary', async () => {
    redis.get.mockResolvedValue('9000');
    const tx = { ...baseTx, amount: 1000n };

    const result = await evaluator.evaluate(baseRule, tx, baseContext(redis));

    expect(result.decision).toBe('allow');
  });
});
