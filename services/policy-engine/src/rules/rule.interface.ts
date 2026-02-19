import type Redis from 'ioredis';
import type { PolicyRule, RuleResult, TransactionDetails } from '../types/index.js';

export interface EvaluationContext {
  redis: Redis;
  walletId: string;
  timestamp: Date;
}

export interface RuleEvaluator {
  readonly ruleType: string;
  evaluate(
    rule: PolicyRule,
    txDetails: TransactionDetails,
    context: EvaluationContext,
  ): Promise<RuleResult>;
}
