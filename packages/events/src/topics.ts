export const TOPICS = {
  AGENT_LIFECYCLE: 'agent.lifecycle',
  TRANSACTION_EVENTS: 'transaction.events',
  POLICY_EVALUATIONS: 'policy.evaluations',
  POLICY_VIOLATIONS: 'policy.violations',
  WALLET_BALANCE: 'wallet.balance',
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];
