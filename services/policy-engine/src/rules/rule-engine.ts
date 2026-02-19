import type { PolicyRule, RuleResult, TransactionDetails } from '../types/index.js';
import { AddressBlocklistRuleEvaluator } from './address-blocklist.rule.js';
import { ProgramAllowlistRuleEvaluator } from './program-allowlist.rule.js';
import type { EvaluationContext, RuleEvaluator } from './rule.interface.js';
import { SpendingLimitRuleEvaluator } from './spending-limit.rule.js';
import { TokenAllowlistRuleEvaluator } from './token-allowlist.rule.js';

export class RuleEngine {
  private evaluators: Map<string, RuleEvaluator>;

  constructor(customEvaluators?: RuleEvaluator[]) {
    const defaults: RuleEvaluator[] = [
      new SpendingLimitRuleEvaluator(),
      new ProgramAllowlistRuleEvaluator(),
      new TokenAllowlistRuleEvaluator(),
      new AddressBlocklistRuleEvaluator(),
    ];

    const all = customEvaluators ? [...defaults, ...customEvaluators] : defaults;
    this.evaluators = new Map(all.map((e) => [e.ruleType, e]));
  }

  evaluateRule = async (
    rule: PolicyRule,
    txDetails: TransactionDetails,
    context: EvaluationContext,
  ): Promise<RuleResult> => {
    const evaluator = this.evaluators.get(rule.type);

    if (!evaluator) {
      return {
        ruleType: rule.type,
        decision: 'deny',
        reason: `No evaluator registered for rule type: ${rule.type}`,
      };
    }

    return evaluator.evaluate(rule, txDetails, context);
  };

  evaluateRules = async (
    rules: PolicyRule[],
    txDetails: TransactionDetails,
    context: EvaluationContext,
  ): Promise<RuleResult[]> => {
    const results: RuleResult[] = [];

    for (const rule of rules) {
      const result = await this.evaluateRule(rule, txDetails, context);
      results.push(result);

      if (result.decision === 'deny') break;
    }

    return results;
  };

  registerEvaluator = (evaluator: RuleEvaluator): void => {
    this.evaluators.set(evaluator.ruleType, evaluator);
  };
}
