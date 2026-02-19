import { relations } from 'drizzle-orm';
import { organizations } from './organizations.js';
import { users } from './users.js';
import { agents } from './agents.js';
import { wallets } from './wallets.js';
import { policies } from './policies.js';
import { transactions } from './transactions.js';
import { policyEvaluations } from './policy-evaluations.js';
import { apiKeys } from './api-keys.js';

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  agents: many(agents),
  apiKeys: many(apiKeys),
}));

export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.orgId],
    references: [organizations.id],
  }),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [agents.orgId],
    references: [organizations.id],
  }),
  wallets: many(wallets),
  transactions: many(transactions),
}));

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  agent: one(agents, {
    fields: [wallets.agentId],
    references: [agents.id],
  }),
  policies: many(policies),
  transactions: many(transactions),
}));

export const policiesRelations = relations(policies, ({ one }) => ({
  wallet: one(wallets, {
    fields: [policies.walletId],
    references: [wallets.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  wallet: one(wallets, {
    fields: [transactions.walletId],
    references: [wallets.id],
  }),
  agent: one(agents, {
    fields: [transactions.agentId],
    references: [agents.id],
  }),
  policyEvaluations: many(policyEvaluations),
}));

export const policyEvaluationsRelations = relations(policyEvaluations, ({ one }) => ({
  transaction: one(transactions, {
    fields: [policyEvaluations.transactionId],
    references: [transactions.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  organization: one(organizations, {
    fields: [apiKeys.orgId],
    references: [organizations.id],
  }),
}));
