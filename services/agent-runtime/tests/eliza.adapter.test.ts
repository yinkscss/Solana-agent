import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { ElizaAdapter } from '../src/framework/eliza.adapter';
import type { LLMProvider, LLMResponse } from '../src/llm/provider.interface';
import type { Tool } from '../src/tools/tool.interface';
import type { AgentConfig, AgentState, ToolResult } from '../src/types';

const makeConfig = (overrides?: Partial<AgentConfig>): AgentConfig => ({
  id: 'agent-1',
  name: 'Eliza Agent',
  description: 'test',
  walletId: 'wallet-1',
  framework: 'eliza',
  llmProvider: 'openai',
  model: 'gpt-4o',
  systemPrompt: 'You are helpful.',
  tools: ['get_balance'],
  ...overrides,
});

const makeState = (): AgentState => ({
  agentId: 'agent-1',
  conversationHistory: [],
  metadata: {},
  lastActiveAt: new Date(),
});

const textResponse: LLMResponse = {
  content: 'Hello from Eliza!',
  finishReason: 'stop',
  usage: { promptTokens: 10, completionTokens: 5 },
};

const toolCallResponse: LLMResponse = {
  content: null,
  toolCalls: [{ id: 'tc_1', name: 'get_balance', arguments: { walletId: 'w1' } }],
  finishReason: 'tool_calls',
  usage: { promptTokens: 10, completionTokens: 5 },
};

const afterToolResponse: LLMResponse = {
  content: 'Your balance is 2.5 SOL.',
  finishReason: 'stop',
  usage: { promptTokens: 20, completionTokens: 10 },
};

const makeMockTool = (): Tool => ({
  name: 'get_balance',
  description: 'Get balance',
  parameters: z.object({ walletId: z.string() }),
  execute: vi.fn(async (): Promise<ToolResult> => ({ success: true, data: { balance: 2.5 } })),
});

describe('ElizaAdapter', () => {
  it('returns text response for simple query', async () => {
    const adapter = new ElizaAdapter();
    const mockProvider: LLMProvider = { name: 'mock', chat: vi.fn().mockResolvedValueOnce(textResponse) };

    await adapter.initialize(makeConfig(), mockProvider, []);
    const outputs = [];
    for await (const out of adapter.execute({ message: 'Hi' }, makeState())) {
      outputs.push(out);
    }

    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('text');
    expect(outputs[0]!.content).toBe('Hello from Eliza!');
  });

  it('includes character context in system prompt', async () => {
    const adapter = new ElizaAdapter();
    const chatFn = vi.fn().mockResolvedValueOnce(textResponse);
    const mockProvider: LLMProvider = { name: 'mock', chat: chatFn };

    await adapter.initialize(makeConfig(), mockProvider, []);
    const outputs = [];
    for await (const out of adapter.execute({ message: 'Hi' }, makeState())) {
      outputs.push(out);
    }

    const messages = chatFn.mock.calls[0]![0];
    const systemMsg = messages.find((m: { role: string }) => m.role === 'system');
    expect(systemMsg.content).toContain('Eliza');
    expect(systemMsg.content).toContain('friendly');
  });

  it('executes at most one tool call per turn', async () => {
    const adapter = new ElizaAdapter();
    const tool = makeMockTool();

    const multiToolResponse: LLMResponse = {
      content: null,
      toolCalls: [
        { id: 'tc_1', name: 'get_balance', arguments: { walletId: 'w1' } },
        { id: 'tc_2', name: 'get_balance', arguments: { walletId: 'w2' } },
      ],
      finishReason: 'tool_calls',
      usage: { promptTokens: 10, completionTokens: 5 },
    };

    const mockProvider: LLMProvider = {
      name: 'mock',
      chat: vi.fn()
        .mockResolvedValueOnce(multiToolResponse)
        .mockResolvedValueOnce(afterToolResponse),
    };

    await adapter.initialize(makeConfig(), mockProvider, [tool]);
    const outputs = [];
    for await (const out of adapter.execute({ message: 'both?' }, makeState())) {
      outputs.push(out);
    }

    expect(tool.execute).toHaveBeenCalledTimes(1);
    expect(outputs.filter((o) => o.type === 'tool_call')).toHaveLength(1);
  });

  it('handles tool call and returns follow-up text', async () => {
    const adapter = new ElizaAdapter();
    const tool = makeMockTool();
    const mockProvider: LLMProvider = {
      name: 'mock',
      chat: vi.fn()
        .mockResolvedValueOnce(toolCallResponse)
        .mockResolvedValueOnce(afterToolResponse),
    };

    await adapter.initialize(makeConfig(), mockProvider, [tool]);
    const outputs = [];
    for await (const out of adapter.execute({ message: 'balance?' }, makeState())) {
      outputs.push(out);
    }

    expect(tool.execute).toHaveBeenCalledWith({ walletId: 'w1' });

    const types = outputs.map((o) => o.type);
    expect(types).toContain('tool_call');
    expect(types).toContain('tool_result');
    expect(types).toContain('text');
    expect(outputs.find((o) => o.type === 'text')!.content).toBe('Your balance is 2.5 SOL.');
  });

  it('handles missing tool gracefully', async () => {
    const adapter = new ElizaAdapter();
    const mockProvider: LLMProvider = {
      name: 'mock',
      chat: vi.fn().mockResolvedValueOnce(toolCallResponse),
    };

    await adapter.initialize(makeConfig(), mockProvider, []);
    const outputs = [];
    for await (const out of adapter.execute({ message: 'test' }, makeState())) {
      outputs.push(out);
    }

    const toolResult = outputs.find((o) => o.type === 'tool_result');
    expect(toolResult).toBeDefined();
    expect(toolResult!.content).toContain('not found');
  });

  it('yields error when paused', async () => {
    const adapter = new ElizaAdapter();
    const mockProvider: LLMProvider = { name: 'mock', chat: vi.fn() };

    await adapter.initialize(makeConfig(), mockProvider, []);
    await adapter.pause();

    const outputs = [];
    for await (const out of adapter.execute({ message: 'Hi' }, makeState())) {
      outputs.push(out);
    }

    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('error');
    expect(outputs[0]!.content).toContain('paused');
  });

  it('resumes after pause', async () => {
    const adapter = new ElizaAdapter();
    const mockProvider: LLMProvider = { name: 'mock', chat: vi.fn().mockResolvedValue(textResponse) };

    await adapter.initialize(makeConfig(), mockProvider, []);
    await adapter.pause();
    await adapter.resume();

    const outputs = [];
    for await (const out of adapter.execute({ message: 'Hi' }, makeState())) {
      outputs.push(out);
    }

    expect(outputs[0]!.type).toBe('text');
  });
});
