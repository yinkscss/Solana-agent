import type { Producer } from 'kafkajs';
import { TOPICS } from './topics.js';
import {
  agentLifecycleEventSchema,
  transactionEventSchema,
  policyEvaluationEventSchema,
  policyViolationEventSchema,
  walletBalanceEventSchema,
} from './schemas.js';
import type {
  AgentLifecycleEvent,
  TransactionEvent,
  PolicyEvaluationEvent,
  PolicyViolationEvent,
  WalletBalanceEvent,
} from './schemas.js';

export class EventPublisher {
  constructor(private producer: Producer) {}

  async connect(): Promise<void> {
    await this.producer.connect();
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
  }

  async publishAgentLifecycle(event: AgentLifecycleEvent): Promise<void> {
    const validated = agentLifecycleEventSchema.parse(event);
    await this.send(TOPICS.AGENT_LIFECYCLE, validated.agentId, validated);
  }

  async publishTransactionEvent(event: TransactionEvent): Promise<void> {
    const validated = transactionEventSchema.parse(event);
    await this.send(TOPICS.TRANSACTION_EVENTS, validated.txId, validated);
  }

  async publishPolicyEvaluation(event: PolicyEvaluationEvent): Promise<void> {
    const validated = policyEvaluationEventSchema.parse(event);
    await this.send(TOPICS.POLICY_EVALUATIONS, validated.evalId, validated);
  }

  async publishPolicyViolation(event: PolicyViolationEvent): Promise<void> {
    const validated = policyViolationEventSchema.parse(event);
    await this.send(TOPICS.POLICY_VIOLATIONS, validated.evalId, validated);
  }

  async publishWalletBalance(event: WalletBalanceEvent): Promise<void> {
    const validated = walletBalanceEventSchema.parse(event);
    await this.send(TOPICS.WALLET_BALANCE, validated.walletId, validated);
  }

  private async send(topic: string, key: string, value: unknown): Promise<void> {
    await this.producer.send({
      topic,
      messages: [{ key, value: JSON.stringify(value) }],
    });
  }
}
