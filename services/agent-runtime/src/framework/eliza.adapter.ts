import type { AgentConfig, AgentInput, AgentOutput, AgentState, AgentFrameworkType } from '../types/index.js';
import type { LLMProvider, LLMMessage } from '../llm/provider.interface.js';
import type { Tool } from '../tools/tool.interface.js';
import { BaseAdapter } from './base.adapter.js';
import { zodToJsonSchema } from '../tools/zod-to-schema.js';
import type { ZodObject, ZodRawShape } from 'zod';

export interface ElizaCharacter {
  name: string;
  bio: string;
  personality: string[];
  style: {
    tone: string;
    verbosity: 'concise' | 'normal' | 'verbose';
  };
}

const DEFAULT_CHARACTER: ElizaCharacter = {
  name: 'Eliza',
  bio: 'A helpful on-chain assistant for Solana.',
  personality: ['friendly', 'direct', 'knowledgeable'],
  style: { tone: 'professional', verbosity: 'concise' },
};

export class ElizaAdapter extends BaseAdapter {
  readonly name: AgentFrameworkType = 'eliza';

  private character: ElizaCharacter = DEFAULT_CHARACTER;

  async initialize(config: AgentConfig, provider: LLMProvider, tools: Tool[]): Promise<void> {
    await super.initialize(config, provider, tools);

    const cfgChar = (config as AgentConfig & { character?: Partial<ElizaCharacter> }).character;
    if (cfgChar) {
      this.character = { ...DEFAULT_CHARACTER, ...cfgChar };
    }
  }

  async *execute(input: AgentInput, state: AgentState): AsyncGenerator<AgentOutput> {
    if (this.paused) {
      yield { type: 'error', content: 'Agent is paused' };
      return;
    }

    this.state = state;

    this.state.conversationHistory.push({
      role: 'user',
      content: input.message,
      timestamp: new Date(),
    });

    const messages = this.buildCharacterMessages();
    const toolDefs = this.tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: zodToJsonSchema(t.parameters as ZodObject<ZodRawShape>),
    }));

    const response = await this.provider.chat(
      messages,
      toolDefs.length > 0 ? toolDefs : undefined,
      { maxTokens: this.config.maxTokens, temperature: this.config.temperature },
    );

    if (response.finishReason === 'tool_calls' && response.toolCalls?.length) {
      const toolCall = response.toolCalls[0]!;

      yield {
        type: 'tool_call',
        content: `Calling ${toolCall.name}`,
        toolName: toolCall.name,
        toolArgs: toolCall.arguments,
      };

      const tool = this.tools.find((t) => t.name === toolCall.name);
      if (!tool) {
        const errorResult = { success: false, error: `Tool not found: ${toolCall.name}` };
        yield { type: 'tool_result', content: JSON.stringify(errorResult), toolName: toolCall.name, toolResult: errorResult };

        this.state.conversationHistory.push({
          role: 'assistant',
          content: `Tool ${toolCall.name} not found`,
          timestamp: new Date(),
        });
        this.state.lastActiveAt = new Date();
        return;
      }

      const result = await tool.execute(toolCall.arguments);

      this.state.conversationHistory.push({
        role: 'assistant',
        content: `Tool call: ${toolCall.name}`,
        timestamp: new Date(),
      });
      this.state.conversationHistory.push({
        role: 'tool',
        content: JSON.stringify(result),
        toolName: toolCall.name,
        toolCallId: toolCall.id,
        timestamp: new Date(),
      });

      yield { type: 'tool_result', content: JSON.stringify(result), toolName: toolCall.name, toolResult: result };

      messages.push({ role: 'assistant', content: response.content ?? '' });
      messages.push({ role: 'tool', content: JSON.stringify(result), toolCallId: toolCall.id, name: toolCall.name });

      const followUp = await this.provider.chat(messages, undefined, {
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
      });

      const text = followUp.content ?? '';
      this.state.conversationHistory.push({ role: 'assistant', content: text, timestamp: new Date() });
      this.state.lastActiveAt = new Date();

      yield { type: 'text', content: text };
      return;
    }

    const text = response.content ?? '';
    this.state.conversationHistory.push({ role: 'assistant', content: text, timestamp: new Date() });
    this.state.lastActiveAt = new Date();

    yield { type: 'text', content: text };
  }

  private buildCharacterMessages(): LLMMessage[] {
    const { character } = this;
    const characterContext = [
      `You are ${character.name}. ${character.bio}`,
      `Personality: ${character.personality.join(', ')}.`,
      `Tone: ${character.style.tone}. Verbosity: ${character.style.verbosity}.`,
    ].join('\n');

    const systemPrompt = this.config.systemPrompt
      ? `${characterContext}\n\n${this.config.systemPrompt}`
      : characterContext;

    const messages: LLMMessage[] = [{ role: 'system', content: systemPrompt }];

    for (const msg of this.state.conversationHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
        ...(msg.toolCallId && { toolCallId: msg.toolCallId }),
        ...(msg.toolName && { name: msg.toolName }),
      });
    }

    return messages;
  }
}
