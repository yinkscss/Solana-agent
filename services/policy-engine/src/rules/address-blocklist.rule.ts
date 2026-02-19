import type { AddressBlocklistRule, PolicyRule, RuleResult, TransactionDetails } from '../types/index.js';
import type { EvaluationContext, RuleEvaluator } from './rule.interface.js';

const isAddressBlocklist = (rule: PolicyRule): rule is AddressBlocklistRule =>
  rule.type === 'address_blocklist';

export class AddressBlocklistRuleEvaluator implements RuleEvaluator {
  readonly ruleType = 'address_blocklist';

  evaluate = async (
    rule: PolicyRule,
    txDetails: TransactionDetails,
    _context: EvaluationContext,
  ): Promise<RuleResult> => {
    if (!isAddressBlocklist(rule)) {
      return { ruleType: this.ruleType, decision: 'allow' };
    }

    const blockedSet = new Set(rule.blockedAddresses);

    if (blockedSet.has(txDetails.destinationAddress)) {
      return {
        ruleType: this.ruleType,
        decision: 'deny',
        reason: `Destination address ${txDetails.destinationAddress} is blocked`,
      };
    }

    return { ruleType: this.ruleType, decision: 'allow' };
  };
}
