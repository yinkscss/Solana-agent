import { z } from 'zod';

export const agentLifecycleEventSchema = z.object({
  agentId: z.string().uuid(),
  event: z.enum(['created', 'started', 'paused', 'stopped', 'destroyed']),
  timestamp: z.string().datetime(),
});

export type AgentLifecycleEvent = z.infer<typeof agentLifecycleEventSchema>;

export const transactionEventSchema = z.object({
  txId: z.string().uuid(),
  walletId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
  event: z.enum(['pending', 'simulated', 'signed', 'submitted', 'confirmed', 'failed']),
  details: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime(),
});

export type TransactionEvent = z.infer<typeof transactionEventSchema>;

export const policyEvaluationEventSchema = z.object({
  evalId: z.string().uuid(),
  txId: z.string().uuid(),
  walletId: z.string().uuid(),
  decision: z.enum(['allow', 'deny', 'require_approval']),
  reasons: z.array(z.string()),
  timestamp: z.string().datetime(),
});

export type PolicyEvaluationEvent = z.infer<typeof policyEvaluationEventSchema>;

export const policyViolationEventSchema = z.object({
  evalId: z.string().uuid(),
  txId: z.string().uuid(),
  walletId: z.string().uuid(),
  violatedPolicies: z.array(z.object({
    policyId: z.string().uuid(),
    policyName: z.string(),
    reason: z.string(),
  })),
  timestamp: z.string().datetime(),
});

export type PolicyViolationEvent = z.infer<typeof policyViolationEventSchema>;

export const walletBalanceEventSchema = z.object({
  walletId: z.string().uuid(),
  token: z.string(),
  previousBalance: z.string(),
  newBalance: z.string(),
  timestamp: z.string().datetime(),
});

export type WalletBalanceEvent = z.infer<typeof walletBalanceEventSchema>;
