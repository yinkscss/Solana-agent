import type { PolicyRule, ProgramAllowlistRule, RuleResult, TransactionDetails } from '../types/index.js';
import type { EvaluationContext, RuleEvaluator } from './rule.interface.js';

const isProgramAllowlist = (rule: PolicyRule): rule is ProgramAllowlistRule =>
  rule.type === 'program_allowlist';

export class ProgramAllowlistRuleEvaluator implements RuleEvaluator {
  readonly ruleType = 'program_allowlist';

  evaluate = async (
    rule: PolicyRule,
    txDetails: TransactionDetails,
    _context: EvaluationContext,
  ): Promise<RuleResult> => {
    if (!isProgramAllowlist(rule)) {
      return { ruleType: this.ruleType, decision: 'allow' };
    }

    const allowedSet = new Set(rule.allowedPrograms);

    const unauthorized = txDetails.programIds.find((pid) => !allowedSet.has(pid));
    if (unauthorized) {
      return {
        ruleType: this.ruleType,
        decision: 'deny',
        reason: `Program ${unauthorized} is not in the allowlist`,
      };
    }

    return { ruleType: this.ruleType, decision: 'allow' };
  };
}
