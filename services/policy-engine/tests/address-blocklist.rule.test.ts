import { describe, it, expect } from 'vitest';
import { AddressBlocklistRuleEvaluator } from '../src/rules/address-blocklist.rule.js';
import type { AddressBlocklistRule, TransactionDetails } from '../src/types/index.js';
import type { EvaluationContext } from '../src/rules/rule.interface.js';

const ctx: EvaluationContext = {
  redis: {} as any,
  walletId: 'wallet-1',
  timestamp: new Date(),
};

const baseTx: TransactionDetails = {
  walletId: 'wallet-1',
  amount: 1000n,
  tokenMint: 'SOL',
  destinationAddress: 'safe-address',
  programIds: [],
  instructions: [],
};

const rule: AddressBlocklistRule = {
  type: 'address_blocklist',
  blockedAddresses: ['blocked-addr-1', 'blocked-addr-2'],
};

describe('AddressBlocklistRuleEvaluator', () => {
  const evaluator = new AddressBlocklistRuleEvaluator();

  it('allows when destination is not blocked', async () => {
    const result = await evaluator.evaluate(rule, baseTx, ctx);

    expect(result.decision).toBe('allow');
  });

  it('denies when destination is blocked', async () => {
    const tx = { ...baseTx, destinationAddress: 'blocked-addr-1' };

    const result = await evaluator.evaluate(rule, tx, ctx);

    expect(result.decision).toBe('deny');
    expect(result.reason).toContain('blocked-addr-1');
  });

  it('denies second blocked address', async () => {
    const tx = { ...baseTx, destinationAddress: 'blocked-addr-2' };

    const result = await evaluator.evaluate(rule, tx, ctx);

    expect(result.decision).toBe('deny');
    expect(result.reason).toContain('blocked-addr-2');
  });

  it('allows when blocklist is checked case-sensitively', async () => {
    const tx = { ...baseTx, destinationAddress: 'BLOCKED-ADDR-1' };

    const result = await evaluator.evaluate(rule, tx, ctx);

    expect(result.decision).toBe('allow');
  });
});
