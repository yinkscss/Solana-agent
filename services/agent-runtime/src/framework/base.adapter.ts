import type {
  AgentConfig,
  AgentInput,
  AgentOutput,
  AgentState,
  AgentFrameworkType,
} from '../types/index.js';
import type { LLMProvider, LLMMessage } from '../llm/provider.interface.js';
import type { Tool } from '../tools/tool.interface.js';
import type { AgentFramework } from './framework.interface.js';
import { zodToJsonSchema } from '../tools/zod-to-schema.js';
import type { ZodObject, ZodRawShape } from 'zod';

const MAX_ITERATIONS_DEFAULT = 10;

export abstract class BaseAdapter implements AgentFramework {
  abstract readonly name: AgentFrameworkType;

  protected config!: AgentConfig;
  protected provider!: LLMProvider;
  protected tools: Tool[] = [];
  protected state!: AgentState;
  protected paused = false;

  async initialize(config: AgentConfig, provider: LLMProvider, tools: Tool[]): Promise<void> {
    this.config = config;
    this.provider = provider;
    this.tools = tools;
    this.state = {
      agentId: config.id,
      conversationHistory: [],
      metadata: {},
      lastActiveAt: new Date(),
    };
  }

  async *execute(input: AgentInput, state: AgentState): AsyncGenerator<AgentOutput> {
    if (this.paused) {
      yield { type: 'error', content: 'Agent is paused' };
      return;
    }

    this.state = state;
    const maxIterations = this.config.maxTokens ? MAX_ITERATIONS_DEFAULT : MAX_ITERATIONS_DEFAULT;

    this.state.conversationHistory.push({
      role: 'user',
      content: input.message,
      timestamp: new Date(),
    });

    const messages = this.buildMessages();
    const toolDefs = this.tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: zodToJsonSchema(t.parameters as ZodObject<ZodRawShape>),
    }));

    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      const response = await this.provider.chat(
        messages,
        toolDefs.length > 0 ? toolDefs : undefined,
        {
          maxTokens: this.config.maxTokens,
          temperature: this.config.temperature,
        },
      );

      if (response.finishReason === 'tool_calls' && response.toolCalls?.length) {
        messages.push({
          role: 'assistant',
          content: response.content ?? '',
          toolCalls: response.toolCalls,
        });

        this.state.conversationHistory.push({
          role: 'assistant',
          content: response.content ?? '',
          toolCalls: response.toolCalls.map((tc) => ({
            id: tc.id,
            name: tc.name,
            arguments: tc.arguments,
          })),
          timestamp: new Date(),
        });

        for (const toolCall of response.toolCalls) {
          yield* this.executeToolCall(toolCall, messages);
        }
        continue;
      }

      const text = response.content ?? '';
      this.state.conversationHistory.push({
        role: 'assistant',
        content: text,
        timestamp: new Date(),
      });
      this.state.lastActiveAt = new Date();

      yield { type: 'text', content: text };
      return;
    }

    yield {
      type: 'error',
      content: `Max tool iterations (${maxIterations}) exceeded`,
    };
  }

  private async *executeToolCall(
    toolCall: { id: string; name: string; arguments: Record<string, unknown> },
    messages: LLMMessage[],
  ): AsyncGenerator<AgentOutput> {
    yield {
      type: 'tool_call',
      content: `Calling ${toolCall.name}`,
      toolName: toolCall.name,
      toolArgs: toolCall.arguments,
    };

    const tool = this.tools.find((t) => t.name === toolCall.name);
    if (!tool) {
      const errorResult = { success: false, error: `Tool not found: ${toolCall.name}` };
      messages.push({
        role: 'tool',
        content: JSON.stringify(errorResult),
        toolCallId: toolCall.id,
        name: toolCall.name,
      });
      this.state.conversationHistory.push({
        role: 'tool',
        content: JSON.stringify(errorResult),
        toolName: toolCall.name,
        toolCallId: toolCall.id,
        timestamp: new Date(),
      });
      yield {
        type: 'tool_result',
        content: JSON.stringify(errorResult),
        toolName: toolCall.name,
        toolResult: errorResult,
      };
      return;
    }

    const result = await tool.execute(toolCall.arguments);
    messages.push({
      role: 'tool',
      content: JSON.stringify(result),
      toolCallId: toolCall.id,
      name: toolCall.name,
    });
    this.state.conversationHistory.push({
      role: 'tool',
      content: JSON.stringify(result),
      toolName: toolCall.name,
      toolCallId: toolCall.id,
      timestamp: new Date(),
    });
    yield {
      type: 'tool_result',
      content: JSON.stringify(result),
      toolName: toolCall.name,
      toolResult: result,
    };
  }

  getState(): AgentState {
    return this.state;
  }

  async pause(): Promise<void> {
    this.paused = true;
  }

  async resume(): Promise<void> {
    this.paused = false;
  }

  async destroy(): Promise<void> {
    this.tools = [];
    this.state = {
      agentId: this.config?.id ?? '',
      conversationHistory: [],
      metadata: {},
      lastActiveAt: new Date(),
    };
  }

  protected buildMessages(): LLMMessage[] {
    const messages: LLMMessage[] = [];

    if (this.config.systemPrompt) {
      messages.push({ role: 'system', content: this.config.systemPrompt });
    }

    for (const msg of this.state.conversationHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
        ...(msg.toolCallId && { toolCallId: msg.toolCallId }),
        ...(msg.toolName && { name: msg.toolName }),
        ...(msg.toolCalls?.length && { toolCalls: msg.toolCalls }),
      });
    }

    return messages;
  }
}
