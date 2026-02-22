export interface PolicyRule {
  id: string;
  name: string;
  type: 'spending_limit' | 'whitelist' | 'time_restriction' | 'rate_limit' | 'human_approval';
  enabled: boolean;
  params: Record<string, unknown>;
}

export interface PolicyRuleEvaluator {
  type: PolicyRule['type'];
  evaluate(rule: PolicyRule, context: Record<string, unknown>): Promise<'allow' | 'deny' | 'require_approval'>;
}
