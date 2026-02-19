import type { PolicyRule, RuleResult, SpendingLimitRule, TransactionDetails } from '../types/index.js';
import type { EvaluationContext, RuleEvaluator } from './rule.interface.js';

const isSpendingLimit = (rule: PolicyRule): rule is SpendingLimitRule =>
  rule.type === 'spending_limit';

const buildWindowKey = (walletId: string, tokenMint: string, windowDuration: number, now: Date): string => {
  const windowStart = Math.floor(now.getTime() / 1000 / windowDuration) * windowDuration;
  return `spending:${walletId}:${tokenMint}:${windowStart}`;
};

export class SpendingLimitRuleEvaluator implements RuleEvaluator {
  readonly ruleType = 'spending_limit';

  evaluate = async (
    rule: PolicyRule,
    txDetails: TransactionDetails,
    context: EvaluationContext,
  ): Promise<RuleResult> => {
    if (!isSpendingLimit(rule)) {
      return { ruleType: this.ruleType, decision: 'allow' };
    }

    if (rule.tokenMint !== txDetails.tokenMint && rule.tokenMint !== 'SOL') {
      return { ruleType: this.ruleType, decision: 'allow' };
    }

    if (txDetails.amount > rule.maxPerTransaction) {
      return {
        ruleType: this.ruleType,
        decision: 'deny',
        reason: `Transaction amount ${txDetails.amount} exceeds per-transaction limit ${rule.maxPerTransaction}`,
      };
    }

    const windowKey = buildWindowKey(
      context.walletId,
      txDetails.tokenMint,
      rule.windowDuration,
      context.timestamp,
    );

    const currentSpending = await context.redis.get(windowKey);
    const spent = currentSpending ? BigInt(currentSpending) : 0n;
    const projectedSpending = spent + txDetails.amount;

    if (projectedSpending > rule.maxPerWindow) {
      return {
        ruleType: this.ruleType,
        decision: 'deny',
        reason: `Window spending ${projectedSpending} would exceed limit ${rule.maxPerWindow} (already spent: ${spent})`,
      };
    }

    await context.redis
      .multi()
      .incrby(windowKey, txDetails.amount.toString())
      .expire(windowKey, rule.windowDuration)
      .exec();

    return { ruleType: this.ruleType, decision: 'allow' };
  };
}
