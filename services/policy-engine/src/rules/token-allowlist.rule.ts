import type { PolicyRule, RuleResult, TokenAllowlistRule, TransactionDetails } from '../types/index.js';
import type { EvaluationContext, RuleEvaluator } from './rule.interface.js';

const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111112';

const isTokenAllowlist = (rule: PolicyRule): rule is TokenAllowlistRule =>
  rule.type === 'token_allowlist';

const isNativeSol = (mint: string): boolean =>
  mint === 'SOL' || mint === NATIVE_SOL_MINT;

export class TokenAllowlistRuleEvaluator implements RuleEvaluator {
  readonly ruleType = 'token_allowlist';

  evaluate = async (
    rule: PolicyRule,
    txDetails: TransactionDetails,
    _context: EvaluationContext,
  ): Promise<RuleResult> => {
    if (!isTokenAllowlist(rule)) {
      return { ruleType: this.ruleType, decision: 'allow' };
    }

    const allowedSet = new Set(rule.allowedMints);
    const txMint = txDetails.tokenMint;

    if (allowedSet.has(txMint)) {
      return { ruleType: this.ruleType, decision: 'allow' };
    }

    if (isNativeSol(txMint) && (allowedSet.has('SOL') || allowedSet.has(NATIVE_SOL_MINT))) {
      return { ruleType: this.ruleType, decision: 'allow' };
    }

    return {
      ruleType: this.ruleType,
      decision: 'deny',
      reason: `Token ${txMint} is not in the allowlist`,
    };
  };
}
