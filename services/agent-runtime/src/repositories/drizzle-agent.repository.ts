import { eq, count } from 'drizzle-orm';
import { createDb, agents } from '@solagent/db';
import type { AgentRepository } from '../services/agent.service.js';
import type { AgentRecord } from '../types/index.js';

type AgentRow = typeof agents.$inferSelect;

const mapToRecord = (row: AgentRow): AgentRecord => ({
  id: row.id,
  orgId: row.orgId,
  walletId: ((row.config as Record<string, unknown>)?.walletId as string) ?? '',
  name: row.name,
  description: row.description ?? '',
  status: row.status,
  framework:
    ((row.config as Record<string, unknown>)?.framework as AgentRecord['framework']) ?? 'solagent',
  llmProvider: (row.llmConfig?.provider as AgentRecord['llmProvider']) ?? 'openai',
  model: row.llmConfig?.model ?? 'gpt-4o',
  systemPrompt: ((row.config as Record<string, unknown>)?.systemPrompt as string) ?? '',
  tools: ((row.config as Record<string, unknown>)?.tools as string[]) ?? [],
  config: (row.config as Record<string, unknown>) ?? {},
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const buildConfig = (record: Partial<AgentRecord>): Record<string, unknown> => {
  const cfg: Record<string, unknown> = { ...(record.config ?? {}) };
  if (record.walletId !== undefined) cfg.walletId = record.walletId;
  if (record.framework !== undefined) cfg.framework = record.framework;
  if (record.systemPrompt !== undefined) cfg.systemPrompt = record.systemPrompt;
  if (record.tools !== undefined) cfg.tools = record.tools;
  return cfg;
};

export const createDrizzleAgentRepo = (dbUrl?: string): AgentRepository => {
  const db = createDb(dbUrl);

  return {
    insert: async (record) => {
      const [row] = await db
        .insert(agents)
        .values({
          id: record.id,
          orgId: record.orgId,
          name: record.name,
          description: record.description,
          status: record.status as AgentRow['status'],
          config: buildConfig(record),
          llmConfig: {
            provider: record.llmProvider,
            model: record.model,
          },
        })
        .returning();
      return mapToRecord(row);
    },

    findById: async (id) => {
      const row = await db.query.agents.findFirst({
        where: eq(agents.id, id),
      });
      return row ? mapToRecord(row) : null;
    },

    findAll: async (opts) => {
      const page = opts.page ?? 1;
      const pageSize = opts.pageSize ?? 20;

      const [rows, [{ value: total }]] = await Promise.all([
        db
          .select()
          .from(agents)
          .limit(pageSize)
          .offset((page - 1) * pageSize)
          .orderBy(agents.createdAt),
        db.select({ value: count() }).from(agents),
      ]);

      return { data: rows.map(mapToRecord), total };
    },

    findByOrgId: async (orgId, opts) => {
      const page = opts.page ?? 1;
      const pageSize = opts.pageSize ?? 20;

      const [rows, [{ value: total }]] = await Promise.all([
        db
          .select()
          .from(agents)
          .where(eq(agents.orgId, orgId))
          .limit(pageSize)
          .offset((page - 1) * pageSize)
          .orderBy(agents.createdAt),
        db.select({ value: count() }).from(agents).where(eq(agents.orgId, orgId)),
      ]);

      return { data: rows.map(mapToRecord), total };
    },

    updateStatus: async (id, status) => {
      const [row] = await db
        .update(agents)
        .set({ status: status as AgentRow['status'], updatedAt: new Date() })
        .where(eq(agents.id, id))
        .returning();
      return row ? mapToRecord(row) : null;
    },

    update: async (id, patch) => {
      const existing = await db.query.agents.findFirst({
        where: eq(agents.id, id),
      });
      if (!existing) return null;

      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (patch.name !== undefined) set.name = patch.name;
      if (patch.description !== undefined) set.description = patch.description;
      if (patch.status !== undefined) set.status = patch.status;

      const needsConfigUpdate =
        patch.walletId !== undefined ||
        patch.framework !== undefined ||
        patch.systemPrompt !== undefined ||
        patch.tools !== undefined ||
        patch.config !== undefined;

      if (needsConfigUpdate) {
        set.config = buildConfig({
          ...patch,
          config: { ...(existing.config as Record<string, unknown>), ...patch.config },
        });
      }

      if (patch.llmProvider !== undefined || patch.model !== undefined) {
        set.llmConfig = {
          provider: patch.llmProvider ?? existing.llmConfig?.provider ?? 'openai',
          model: patch.model ?? existing.llmConfig?.model ?? 'gpt-4o',
        };
      }

      const [row] = await db.update(agents).set(set).where(eq(agents.id, id)).returning();
      return row ? mapToRecord(row) : null;
    },

    delete: async (id) => {
      const result = await db.delete(agents).where(eq(agents.id, id)).returning();
      return result.length > 0;
    },
  };
};
