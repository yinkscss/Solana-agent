import { pgTable, uuid, text, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';

export const agentStatusEnum = pgEnum('agent_status', [
  'created', 'running', 'paused', 'stopped', 'destroyed',
]);

export type AgentLlmConfig = {
  provider: string;
  model: string;
  temperature?: number;
};

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  status: agentStatusEnum('status').notNull().default('created'),
  config: jsonb('config').$type<Record<string, unknown>>().default({}),
  llmConfig: jsonb('llm_config').$type<AgentLlmConfig>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
