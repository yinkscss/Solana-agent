import { describe, it, expect, vi } from 'vitest';
import { ProgramAllowlistRuleEvaluator } from '../src/rules/program-allowlist.rule.js';
import type { ProgramAllowlistRule, TransactionDetails } from '../src/types/index.js';
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
  destinationAddress: 'dest',
  programIds: ['programA', 'programB'],
  instructions: [],
};

const rule: ProgramAllowlistRule = {
  type: 'program_allowlist',
  allowedPrograms: ['programA', 'programB', 'programC'],
};

describe('ProgramAllowlistRuleEvaluator', () => {
  const evaluator = new ProgramAllowlistRuleEvaluator();

  it('allows when all programs are in the allowlist', async () => {
    const result = await evaluator.evaluate(rule, baseTx, ctx);

    expect(result.decision).toBe('allow');
  });

  it('denies when a program is not in the allowlist', async () => {
    const tx = { ...baseTx, programIds: ['programA', 'unknownProgram'] };

    const result = await evaluator.evaluate(rule, tx, ctx);

    expect(result.decision).toBe('deny');
    expect(result.reason).toContain('unknownProgram');
  });

  it('denies and reports first unauthorized program', async () => {
    const tx = { ...baseTx, programIds: ['badProg1', 'badProg2'] };

    const result = await evaluator.evaluate(rule, tx, ctx);

    expect(result.decision).toBe('deny');
    expect(result.reason).toContain('badProg1');
  });

  it('allows when transaction has no program IDs', async () => {
    const tx = { ...baseTx, programIds: [] };

    const result = await evaluator.evaluate(rule, tx, ctx);

    expect(result.decision).toBe('allow');
  });

  it('allows single allowed program', async () => {
    const tx = { ...baseTx, programIds: ['programC'] };

    const result = await evaluator.evaluate(rule, tx, ctx);

    expect(result.decision).toBe('allow');
  });
});
