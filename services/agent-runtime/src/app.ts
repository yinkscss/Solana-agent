import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { createAgentService } from './services/agent.service.js';
import type { AgentRepository } from './services/agent.service.js';
import { InMemoryStateManager } from './services/state-manager.service.js';
import { createExecutionService } from './services/execution.service.js';
import type { ExecutionDeps } from './services/execution.service.js';
import { ToolRegistry } from './tools/tool-registry.js';
import { createTransferTool } from './tools/transfer.tool.js';
import { createBalanceTool } from './tools/balance.tool.js';
import { createSwapTool } from './tools/swap.tool.js';
import { createAgentController } from './controllers/agent.controller.js';
import { createAgentRoutes, createOrgAgentRoutes } from './routes/agents.js';
import type { AgentRecord, ListOptions } from './types/index.js';
import type { AgentStatus } from '@solagent/common';
import type { LLMProvider } from './llm/provider.interface.js';

const createInMemoryRepo = (): AgentRepository => {
  const store = new Map<string, AgentRecord>();

  return {
    insert: async (record) => {
      const full: AgentRecord = { ...record, createdAt: new Date(), updatedAt: new Date() };
      store.set(record.id, full);
      return full;
    },
    findById: async (id) => store.get(id) ?? null,
    findByOrgId: async (orgId, opts: ListOptions) => {
      const all = [...store.values()].filter((a) => a.orgId === orgId);
      const page = opts.page ?? 1;
      const pageSize = opts.pageSize ?? 20;
      const start = (page - 1) * pageSize;
      return { data: all.slice(start, start + pageSize), total: all.length };
    },
    updateStatus: async (id, status) => {
      const existing = store.get(id);
      if (!existing) return null;
      const updated = { ...existing, status, updatedAt: new Date() };
      store.set(id, updated);
      return updated;
    },
    update: async (id, patch) => {
      const existing = store.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...patch, id: existing.id, updatedAt: new Date() };
      store.set(id, updated);
      return updated;
    },
    delete: async (id) => store.delete(id),
  };
};

export interface AppDeps {
  repo?: AgentRepository;
  providerFactory?: (provider: string, model: string) => LLMProvider;
}

export const createApp = (deps?: AppDeps) => {
  const repo = deps?.repo ?? createInMemoryRepo();
  const stateManager = new InMemoryStateManager();

  const toolRegistry = new ToolRegistry();
  toolRegistry.register(createTransferTool(env.TRANSACTION_ENGINE_URL));
  toolRegistry.register(createBalanceTool(env.WALLET_ENGINE_URL));
  toolRegistry.register(createSwapTool(env.DEFI_ENGINE_URL));

  const agentService = createAgentService(repo);

  const executionDeps: ExecutionDeps = {
    agentService,
    stateManager,
    toolRegistry,
    providerFactory: deps?.providerFactory,
  };
  const executionService = createExecutionService(executionDeps);

  const controller = createAgentController(agentService, executionService);

  const app = new Hono();

  app.use('*', logger());
  app.use('*', cors());

  app.get('/health', (c) => c.json({ status: 'ok', service: 'agent-runtime' }));

  app.route('/api/v1/agents', createAgentRoutes(controller));
  app.route('/api/v1/orgs', createOrgAgentRoutes(controller));

  app.onError(errorHandler);

  return { app, agentService, executionService, stateManager, toolRegistry };
};

export const { app } = createApp();
