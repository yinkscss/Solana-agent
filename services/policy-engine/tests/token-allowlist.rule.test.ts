import { describe, it, expect } from 'vitest';
import { TokenAllowlistRuleEvaluator } from '../src/rules/token-allowlist.rule.js';
import type { TokenAllowlistRule, TransactionDetails } from '../src/types/index.js';
import type { EvaluationContext } from '../src/rules/rule.interface.js';

const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111112';

const ctx: EvaluationContext = {
  redis: {} as any,
  walletId: 'wallet-1',
  timestamp: new Date(),
};

const baseTx: TransactionDetails = {
  walletId: 'wallet-1',
  amount: 500n,
  tokenMint: 'USDC_MINT',
  destinationAddress: 'dest',
  programIds: [],
  instructions: [],
};

const rule: TokenAllowlistRule = {
  type: 'token_allowlist',
  allowedMints: ['USDC_MINT', 'SOL'],
};

describe('TokenAllowlistRuleEvaluator', () => {
  const evaluator = new TokenAllowlistRuleEvaluator();

  it('allows token in the allowlist', async () => {
    const result = await evaluator.evaluate(rule, baseTx, ctx);

    expect(result.decision).toBe('allow');
  });

  it('denies token not in the allowlist', async () => {
    const tx = { ...baseTx, tokenMint: 'UNKNOWN_MINT' };

    const result = await evaluator.evaluate(rule, tx, ctx);

    expect(result.decision).toBe('deny');
    expect(result.reason).toContain('UNKNOWN_MINT');
  });

  it('allows SOL special case when SOL is in allowlist', async () => {
    const tx = { ...baseTx, tokenMint: 'SOL' };

    const result = await evaluator.evaluate(rule, tx, ctx);

    expect(result.decision).toBe('allow');
  });

  it('allows native SOL mint address when SOL is in allowlist', async () => {
    const tx = { ...baseTx, tokenMint: NATIVE_SOL_MINT };

    const result = await evaluator.evaluate(rule, tx, ctx);

    expect(result.decision).toBe('allow');
  });

  it('allows native SOL mint when allowlist contains native mint address', async () => {
    const nativeRule: TokenAllowlistRule = {
      type: 'token_allowlist',
      allowedMints: [NATIVE_SOL_MINT],
    };
    const tx = { ...baseTx, tokenMint: 'SOL' };

    const result = await evaluator.evaluate(nativeRule, tx, ctx);

    expect(result.decision).toBe('allow');
  });
});
