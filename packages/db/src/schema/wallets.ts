import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { agents } from './agents.js';

export const walletStatusEnum = pgEnum('wallet_status', ['active', 'frozen', 'recovering']);
export const keyProviderEnum = pgEnum('key_provider', ['turnkey', 'crossmint', 'privy', 'local']);
export const networkEnum = pgEnum('network', ['mainnet-beta', 'devnet', 'testnet']);

export const wallets = pgTable('wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => agents.id).notNull(),
  publicKey: text('public_key').unique().notNull(),
  keyProvider: keyProviderEnum('key_provider').notNull(),
  keyProviderRef: text('key_provider_ref').notNull(),
  network: networkEnum('network').notNull().default('devnet'),
  label: text('label').notNull(),
  status: walletStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
