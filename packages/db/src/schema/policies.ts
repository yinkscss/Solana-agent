import { pgTable, uuid, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { wallets } from './wallets.js';

export type SpendingLimitRule = {
  type: 'spending_limit';
  maxAmountLamports: string;
  period: 'per_tx' | 'daily' | 'weekly' | 'monthly';
};

export type ProgramAllowlistRule = {
  type: 'program_allowlist';
  programIds: string[];
};

export type TokenAllowlistRule = {
  type: 'token_allowlist';
  mints: string[];
};

export type AddressBlocklistRule = {
  type: 'address_blocklist';
  addresses: string[];
};

export type TimeRestrictionRule = {
  type: 'time_restriction';
  allowedDays: number[];
  allowedHoursUtc: { start: number; end: number };
};

export type HumanApprovalRule = {
  type: 'human_approval';
  thresholdLamports: string;
  approvers: string[];
};

export type RateLimitRule = {
  type: 'rate_limit';
  maxTransactions: number;
  windowSeconds: number;
};

export type PolicyRule =
  | SpendingLimitRule
  | ProgramAllowlistRule
  | TokenAllowlistRule
  | AddressBlocklistRule
  | TimeRestrictionRule
  | HumanApprovalRule
  | RateLimitRule;

export const policies = pgTable('policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletId: uuid('wallet_id').references(() => wallets.id).notNull(),
  version: integer('version').notNull().default(1),
  name: text('name').notNull(),
  rules: jsonb('rules').$type<PolicyRule[]>().notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
