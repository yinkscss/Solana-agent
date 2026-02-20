import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { LangChainAdapter } from '../src/framework/langchain.adapter';
import type { LLMProvider, LLMResponse } from '../src/llm/provider.interface';
import type { Tool } from '../src/tools/tool.interface';
import type { AgentConfig, AgentState, ToolResult } from '../src/types';

const makeConfig = (overrides?: Partial<AgentConfig>): AgentConfig => ({
  id: 'agent-1',
  name: 'Test Agent',
  description: 'test',
  walletId: 'wallet-1',
  framework: 'langchain',
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
  content: 'Hello there!',
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

describe('LangChainAdapter', () => {
  it('returns text response for simple query', async () => {
    const adapter = new LangChainAdapter();
    const mockProvider: LLMProvider = { name: 'mock', chat: vi.fn().mockResolvedValueOnce(textResponse) };

    await adapter.initialize(makeConfig(), mockProvider, []);
    const outputs = [];
    for await (const out of adapter.execute({ message: 'Hi' }, makeState())) {
      outputs.push(out);
    }

    expect(outputs).toHaveLength(1);
    expect(outputs[0]!.type).toBe('text');
    expect(outputs[0]!.content).toBe('Hello there!');
  });

  it('executes tool call loop (Reason-Act-Observe)', async () => {
    const adapter = new LangChainAdapter();
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

  it('handles multiple sequential tool calls', async () => {
    const adapter = new LangChainAdapter();
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
    for await (const out of adapter.execute({ message: 'both balances?' }, makeState())) {
      outputs.push(out);
    }

    expect(tool.execute).toHaveBeenCalledTimes(2);
    expect(outputs.filter((o) => o.type === 'tool_call')).toHaveLength(2);
    expect(outputs.filter((o) => o.type === 'tool_result')).toHaveLength(2);
  });

  it('handles missing tool gracefully', async () => {
    const adapter = new LangChainAdapter();
    const badToolCall: LLMResponse = {
      content: null,
      toolCalls: [{ id: 'tc_1', name: 'nonexistent', arguments: {} }],
      finishReason: 'tool_calls',
      usage: { promptTokens: 10, completionTokens: 5 },
    };

    const mockProvider: LLMProvider = {
      name: 'mock',
      chat: vi.fn()
        .mockResolvedValueOnce(badToolCall)
        .mockResolvedValueOnce(textResponse),
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
    const adapter = new LangChainAdapter();
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
    const adapter = new LangChainAdapter();
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
