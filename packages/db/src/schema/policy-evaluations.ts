import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { transactions } from './transactions.js';

export type PolicyEvalEntry = {
  policyId: string;
  decision: string;
  reason?: string;
};

export type PolicyDecision = 'allow' | 'deny' | 'require_approval';

export const policyEvaluations = pgTable('policy_evaluations', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id').references(() => transactions.id).notNull(),
  policiesEvaluated: jsonb('policies_evaluated').$type<PolicyEvalEntry[]>().notNull(),
  decision: text('decision').$type<PolicyDecision>().notNull(),
  reasons: jsonb('reasons').$type<string[]>().default([]),
  evaluatedAt: timestamp('evaluated_at').defaultNow().notNull(),
});
