import { SolAgentError } from '@solagent/common';
import type { LLMProvider, LLMMessage, LLMToolDef, LLMResponse } from './provider.interface.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface OpenAIMessage {
  role: string;
  content: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: OpenAIToolCall[];
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OpenAIResponse {
  choices: {
    message: { content: string | null; tool_calls?: OpenAIToolCall[] };
    finish_reason: string;
  }[];
  usage: { prompt_tokens: number; completion_tokens: number };
}

const mapMessages = (messages: LLMMessage[]): OpenAIMessage[] =>
  messages.map((m) => {
    if (m.role === 'tool') {
      return { role: 'tool', content: m.content, tool_call_id: m.toolCallId ?? '', name: m.name };
    }
    return { role: m.role, content: m.content };
  });

const mapTools = (tools: LLMToolDef[]) =>
  tools.map((t) => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

const parseFinishReason = (reason: string): LLMResponse['finishReason'] => {
  if (reason === 'tool_calls') return 'tool_calls';
  if (reason === 'length') return 'length';
  return 'stop';
};

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model = 'gpt-4o') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(
    messages: LLMMessage[],
    tools?: LLMToolDef[],
    opts?: { maxTokens?: number; temperature?: number },
  ): Promise<LLMResponse> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: mapMessages(messages),
      ...(opts?.maxTokens && { max_tokens: opts.maxTokens }),
      ...(opts?.temperature !== undefined && { temperature: opts.temperature }),
    };

    if (tools?.length) {
      body.tools = mapTools(tools);
    }

    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new SolAgentError(
        `OpenAI API error: ${res.status} ${text}`,
        'LLM_PROVIDER_ERROR',
        res.status === 429 ? 429 : 502,
      );
    }

    const data = (await res.json()) as OpenAIResponse;
    const choice = data.choices[0];
    if (!choice) throw new SolAgentError('OpenAI returned empty response', 'LLM_PROVIDER_ERROR', 502);

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
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
      },
    };
  }
}
