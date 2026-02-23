import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import { SolAgentError } from '@solagent/common';
import type { LLMProvider, LLMMessage, LLMToolDef, LLMResponse } from './provider.interface.js';

const mapMessages = (messages: LLMMessage[]): ChatCompletionMessageParam[] =>
  messages.map((m): ChatCompletionMessageParam => {
    if (m.role === 'tool') {
      return { role: 'tool', content: m.content, tool_call_id: m.toolCallId ?? '' };
    }
    if (m.role === 'assistant' && m.toolCalls?.length) {
      return {
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      };
    }
    return { role: m.role, content: m.content };
  });

const mapTools = (tools: LLMToolDef[]): ChatCompletionTool[] =>
  tools.map((t) => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

const parseFinishReason = (reason: string | null): LLMResponse['finishReason'] => {
  if (reason === 'tool_calls') return 'tool_calls';
  if (reason === 'length') return 'length';
  return 'stop';
};

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, model = 'gpt-4o') {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async chat(
    messages: LLMMessage[],
    tools?: LLMToolDef[],
    opts?: { maxTokens?: number; temperature?: number },
  ): Promise<LLMResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: mapMessages(messages),
        ...(tools?.length && { tools: mapTools(tools) }),
        ...(opts?.maxTokens && { max_tokens: opts.maxTokens }),
        ...(opts?.temperature !== undefined && { temperature: opts.temperature }),
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new SolAgentError('OpenAI returned empty response', 'LLM_PROVIDER_ERROR', 502);
      }

      const toolCalls = choice.message.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
      }));

      return {
        content: choice.message.content,
        toolCalls,
        finishReason: parseFinishReason(choice.finish_reason),
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
        },
      };
    } catch (error) {
      if (error instanceof SolAgentError) throw error;

      if (error instanceof OpenAI.APIError) {
        throw new SolAgentError(
          `OpenAI API error: ${error.status} ${error.message}`,
          'LLM_PROVIDER_ERROR',
          error.status === 429 ? 429 : 502,
        );
      }

      throw new SolAgentError(
        `OpenAI provider error: ${error instanceof Error ? error.message : 'unknown'}`,
        'LLM_PROVIDER_ERROR',
        502,
      );
    }
  }
}
