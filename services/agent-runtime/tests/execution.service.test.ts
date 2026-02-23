import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { createExecutionService } from '../src/services/execution.service';
import { createAgentService } from '../src/services/agent.service';
import type { AgentRepository } from '../src/services/agent.service';
import { InMemoryStateManager } from '../src/services/state-manager.service';
import { ToolRegistry } from '../src/tools/tool-registry';
import type { Tool } from '../src/tools/tool.interface';
import type { LLMProvider, LLMResponse } from '../src/llm/provider.interface';
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
    findAll: async (_opts: ListOptions) => {
      const all = [...store.values()];
      return { data: all, total: all.length };
    },
    findByOrgId: async (orgId, _opts: ListOptions) => {
      const all = [...store.values()].filter((a) => a.orgId === orgId);
      return { data: all, total: all.length };
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

const mockTool: Tool = {
  name: 'get_balance',
  description: 'Get balance',
  parameters: z.object({ walletId: z.string() }),
  execute: vi.fn(async () => ({ success: true, data: { balance: 1.5 } })),
};

const textResponse: LLMResponse = {
  content: 'Your balance is 1.5 SOL',
  finishReason: 'stop',
  usage: { promptTokens: 10, completionTokens: 5 },
};

const toolCallResponse: LLMResponse = {
  content: null,
  toolCalls: [{ id: 'tc_1', name: 'get_balance', arguments: { walletId: 'w1' } }],
  finishReason: 'tool_calls',
  usage: { promptTokens: 10, completionTokens: 5 },
};

describe('ExecutionService', () => {
  let agentService: ReturnType<typeof createAgentService>;
  let executionService: ReturnType<typeof createExecutionService>;
  let mockProvider: LLMProvider;

  beforeEach(() => {
    const repo = createMockRepo();
    agentService = createAgentService(repo);

    const stateManager = new InMemoryStateManager();
    const toolRegistry = new ToolRegistry();
    toolRegistry.register(mockTool);

    mockProvider = {
      name: 'mock',
      chat: vi.fn(),
    };

    executionService = createExecutionService({
      agentService,
      stateManager,
      toolRegistry,
      providerFactory: () => mockProvider,
    });
  });

  const createRunningAgent = async () => {
    const agent = await agentService.createAgent({
      orgId: 'org-1',
      walletId: 'w1',
      name: 'Test Agent',
      description: 'test',
      framework: 'solagent',
      llmProvider: 'openai',
      model: 'gpt-4o',
      systemPrompt: 'You are helpful.',
      tools: ['get_balance'],
    });
    await agentService.startAgent(agent.id);
    return agent;
  };

  it('executes a simple text response', async () => {
    const agent = await createRunningAgent();
    vi.mocked(mockProvider.chat).mockResolvedValueOnce(textResponse);

    const outputs = await executionService.executeAgent(agent.id, {
      message: 'What is my balance?',
    });
    expect(outputs.some((o) => o.type === 'text' && o.content === 'Your balance is 1.5 SOL')).toBe(
      true,
    );
  });

  it('handles tool call loop', async () => {
    const agent = await createRunningAgent();
    vi.mocked(mockProvider.chat)
      .mockResolvedValueOnce(toolCallResponse)
      .mockResolvedValueOnce(textResponse);

    const outputs = await executionService.executeAgent(agent.id, { message: 'Check my balance' });

    const types = outputs.map((o) => o.type);
    expect(types).toContain('tool_call');
    expect(types).toContain('tool_result');
    expect(types).toContain('text');
  });

  it('rejects execution for non-running agent', async () => {
    const agent = await agentService.createAgent({
      orgId: 'org-1',
      walletId: 'w1',
      name: 'Idle Agent',
      description: 'idle',
      framework: 'solagent',
      llmProvider: 'openai',
      model: 'gpt-4o',
      systemPrompt: 'You are helpful.',
      tools: [],
    });

    await expect(executionService.executeAgent(agent.id, { message: 'hello' })).rejects.toThrow(
      'not running',
    );
  });

  it('enforces max tool iterations', async () => {
    const agent = await createRunningAgent();
    vi.mocked(mockProvider.chat).mockResolvedValue(toolCallResponse);

    const outputs = await executionService.executeAgent(agent.id, { message: 'loop forever' });
    expect(
      outputs.some((o) => o.type === 'error' && o.content.includes('Max tool iterations')),
    ).toBe(true);
  });
});
