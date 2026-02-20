import { describe, it, expect, beforeEach } from 'vitest';
import { createAgentService } from '../src/services/agent.service';
import type { AgentRepository } from '../src/services/agent.service';
import type { AgentRecord, ListOptions } from '../src/types';
import type { AgentStatus } from '@solagent/common';

const createMockRepo = (): AgentRepository => {
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
    updateStatus: async (id, status: AgentStatus) => {
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

const defaultParams = {
  orgId: 'org-1',
  walletId: 'wallet-1',
  name: 'Test Agent',
  description: 'A test agent',
  framework: 'langchain' as const,
  llmProvider: 'openai' as const,
  model: 'gpt-4o',
  systemPrompt: 'You are helpful.',
  tools: ['transfer', 'get_balance'],
};

describe('AgentService', () => {
  let service: ReturnType<typeof createAgentService>;

  beforeEach(() => {
    service = createAgentService(createMockRepo());
  });

  describe('createAgent', () => {
    it('creates an agent with created status', async () => {
      const agent = await service.createAgent(defaultParams);
      expect(agent.name).toBe('Test Agent');
      expect(agent.status).toBe('created');
      expect(agent.orgId).toBe('org-1');
      expect(agent.framework).toBe('langchain');
    });
  });

  describe('getAgent', () => {
    it('returns existing agent', async () => {
      const created = await service.createAgent(defaultParams);
      const found = await service.getAgent(created.id);
      expect(found.id).toBe(created.id);
    });

    it('throws for missing agent', async () => {
      await expect(service.getAgent('nonexistent')).rejects.toThrow('Agent not found');
    });
  });

  describe('listAgents', () => {
    it('returns agents for org', async () => {
      await service.createAgent(defaultParams);
      await service.createAgent({ ...defaultParams, name: 'Agent 2' });
      const result = await service.listAgents('org-1', { page: 1, pageSize: 10 });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('filters by org', async () => {
      await service.createAgent(defaultParams);
      await service.createAgent({ ...defaultParams, orgId: 'org-2' });
      const result = await service.listAgents('org-1', {});
      expect(result.data).toHaveLength(1);
    });
  });

  describe('lifecycle transitions', () => {
    it('created → running', async () => {
      const agent = await service.createAgent(defaultParams);
      const started = await service.startAgent(agent.id);
      expect(started.status).toBe('running');
    });

    it('running → paused', async () => {
      const agent = await service.createAgent(defaultParams);
      await service.startAgent(agent.id);
      const paused = await service.pauseAgent(agent.id);
      expect(paused.status).toBe('paused');
    });

    it('paused → running (resume)', async () => {
      const agent = await service.createAgent(defaultParams);
      await service.startAgent(agent.id);
      await service.pauseAgent(agent.id);
      const resumed = await service.startAgent(agent.id);
      expect(resumed.status).toBe('running');
    });

    it('running → stopped', async () => {
      const agent = await service.createAgent(defaultParams);
      await service.startAgent(agent.id);
      const stopped = await service.stopAgent(agent.id);
      expect(stopped.status).toBe('stopped');
    });

    it('stopped → destroyed', async () => {
      const agent = await service.createAgent(defaultParams);
      await service.startAgent(agent.id);
      await service.stopAgent(agent.id);
      const destroyed = await service.destroyAgent(agent.id);
      expect(destroyed.status).toBe('destroyed');
    });

    it('rejects invalid transition: created → paused', async () => {
      const agent = await service.createAgent(defaultParams);
      await expect(service.pauseAgent(agent.id)).rejects.toThrow('Invalid status transition');
    });

    it('rejects invalid transition: created → stopped', async () => {
      const agent = await service.createAgent(defaultParams);
      await expect(service.stopAgent(agent.id)).rejects.toThrow('Invalid status transition');
    });

    it('rejects invalid transition: destroyed → running', async () => {
      const agent = await service.createAgent(defaultParams);
      await service.startAgent(agent.id);
      await service.stopAgent(agent.id);
      await service.destroyAgent(agent.id);
      await expect(service.startAgent(agent.id)).rejects.toThrow('Invalid status transition');
    });
  });

  describe('updateAgent', () => {
    it('updates agent fields', async () => {
      const agent = await service.createAgent(defaultParams);
      const updated = await service.updateAgent(agent.id, { name: 'Updated Name' });
      expect(updated.name).toBe('Updated Name');
    });

    it('throws for missing agent', async () => {
      await expect(service.updateAgent('nonexistent', { name: 'x' })).rejects.toThrow('Agent not found');
    });
  });
});
