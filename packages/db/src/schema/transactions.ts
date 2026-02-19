import { pgTable, uuid, text, integer, boolean, timestamp, bigint, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { wallets } from './wallets.js';
import { agents } from './agents.js';

export const transactionStatusEnum = pgEnum('transaction_status', [
  'pending', 'simulating', 'simulation_failed', 'policy_eval', 'rejected',
  'awaiting_approval', 'signing', 'signing_failed', 'submitting', 'submitted',
  'confirmed', 'failed', 'retrying', 'permanently_failed',
]);

export const transactionTypeEnum = pgEnum('transaction_type', [
  'transfer', 'swap', 'stake', 'unstake', 'lend', 'borrow', 'nft', 'custom',
]);

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletId: uuid('wallet_id').references(() => wallets.id).notNull(),
  agentId: uuid('agent_id').references(() => agents.id),
  signature: text('signature'),
  type: transactionTypeEnum('type').notNull().default('custom'),
  status: transactionStatusEnum('status').notNull().default('pending'),
  instructions: jsonb('instructions').$type<unknown[]>().notNull(),
  feeLamports: bigint('fee_lamports', { mode: 'bigint' }),
  gasless: boolean('gasless').notNull().default(false),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  confirmedAt: timestamp('confirmed_at'),
});
