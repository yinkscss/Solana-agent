import { SolAgentError } from '@solagent/common';
import type { LLMProvider, LLMMessage, LLMToolDef, LLMResponse } from './provider.interface.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

interface AnthropicResponse {
  content: AnthropicContentBlock[];
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

const extractSystemPrompt = (messages: LLMMessage[]): { system?: string; rest: LLMMessage[] } => {
  const systemMsgs = messages.filter((m) => m.role === 'system');
  const rest = messages.filter((m) => m.role !== 'system');
  return {
    system: systemMsgs.length ? systemMsgs.map((m) => m.content).join('\n') : undefined,
    rest,
  };
};

const mapMessages = (messages: LLMMessage[]): AnthropicMessage[] => {
  const result: AnthropicMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'tool') {
      const block: AnthropicContentBlock = {
        type: 'tool_result',
        tool_use_id: msg.toolCallId ?? '',
        content: msg.content,
      };
      const last = result[result.length - 1];
      if (last?.role === 'user' && Array.isArray(last.content)) {
        last.content.push(block);
      } else {
        result.push({ role: 'user', content: [block] });
      }
      continue;
    }

    if (msg.role === 'assistant') {
      result.push({ role: 'assistant', content: msg.content });
      continue;
    }

    result.push({ role: 'user', content: msg.content });
  }

  return result;
};

const mapTools = (tools: LLMToolDef[]) =>
  tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));

const parseStopReason = (reason: string): LLMResponse['finishReason'] => {
  if (reason === 'tool_use') return 'tool_calls';
  if (reason === 'max_tokens') return 'length';
  return 'stop';
};

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model = 'claude-sonnet-4-20250514') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(
    messages: LLMMessage[],
    tools?: LLMToolDef[],
    opts?: { maxTokens?: number; temperature?: number },
  ): Promise<LLMResponse> {
    const { system, rest } = extractSystemPrompt(messages);

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: opts?.maxTokens ?? 4096,
      messages: mapMessages(rest),
      ...(system && { system }),
      ...(opts?.temperature !== undefined && { temperature: opts.temperature }),
    };

    if (tools?.length) {
      body.tools = mapTools(tools);
    }

    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new SolAgentError(
        `Anthropic API error: ${res.status} ${text}`,
        'LLM_PROVIDER_ERROR',
        res.status === 429 ? 429 : 502,
      );
    }

    const data = (await res.json()) as AnthropicResponse;

    let textContent: string | null = null;
    const toolCalls: LLMResponse['toolCalls'] = [];

    for (const block of data.content) {
      if (block.type === 'text') {
        textContent = block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({ id: block.id, name: block.name, arguments: block.input });
      }
    }

    return {
      content: textContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: parseStopReason(data.stop_reason),
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
      },
    };
  }
}
