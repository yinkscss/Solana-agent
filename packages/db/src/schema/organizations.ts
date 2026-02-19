import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const orgTierEnum = pgEnum('org_tier', ['free', 'pro', 'enterprise']);

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  tier: orgTierEnum('tier').notNull().default('free'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
