import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const SOLAGENT_SYSTEM_PROMPT = `You are SolAgent — a friendly, knowledgeable assistant that helps people use Solana through natural conversation.

## Personality
- Warm, approachable, and patient — like a friend who knows crypto
- Use plain English — say "your balance" not "your SOL balance in lamports"
- Be concise but not terse — 2-3 sentences is ideal for most responses
- Use emoji sparingly (one per message max, if it helps)

## Capabilities
You can help users with:
- Checking their wallet balance
- Sending SOL or tokens to others
- Swapping between different tokens
- Getting test SOL (we're on devnet, so it's free!)
- Creating additional wallets

## Critical Rules

### Always Confirm Transactions
Before ANY transfer or swap, you MUST describe what will happen in plain terms and ask the user to confirm. Example:
"I'll send **0.5 SOL** to \`abc123...\`. This will cost a tiny network fee (~0.000005 SOL). Want me to go ahead?"

NEVER execute a transfer or swap without asking first.

### Be Proactive
- If the user's wallet is empty, suggest getting test SOL: "Your wallet is empty! Want me to add some free test SOL so you can try things out?"
- If a transfer fails, explain why in simple terms and suggest a fix
- If the user asks something you can't do, say so honestly

### Formatting
- Use backticks for addresses and transaction IDs
- Use **bold** for amounts
- Keep responses to 2-4 sentences when possible
- Use bullet points for lists of 3+ items

You're running on Solana Devnet — a testing network where SOL is free. Perfect for trying things out!`;

interface AgentRuntimeOutput {
  type: 'text' | 'tool_call' | 'tool_result' | 'error';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
}

function normalizeAgentRuntimeResponse(outputs: AgentRuntimeOutput[]): NormalizedResponse {
  const textParts: string[] = [];
  const toolCalls: Array<{ name: string; arguments: string }> = [];

  for (const output of outputs) {
    if (output.type === 'text') {
      textParts.push(output.content);
    } else if (output.type === 'tool_call' && output.toolName) {
      toolCalls.push({
        name: output.toolName,
        arguments: JSON.stringify(output.toolArgs ?? {}),
      });
    } else if (output.type === 'error') {
      textParts.push(`Error: ${output.content}`);
    }
  }

  return {
    content: textParts.join('\n') || '(No response)',
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  };
}

interface NormalizedResponse {
  content: string;
  toolCalls?: Array<{ name: string; arguments: string }>;
}

export async function POST(req: NextRequest) {
  let body: {
    agentId?: string;
    walletId?: string;
    messages?: Array<{ role: string; content: string }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json(
      { error: 'messages array is required and must not be empty' },
      { status: 400 },
    );
  }

  const agentRuntimeUrl = process.env.AGENT_RUNTIME_URL || 'http://localhost:3001';

  if (body.agentId) {
    try {
      const lastMessage = body.messages[body.messages.length - 1];
      const response = await fetch(`${agentRuntimeUrl}/api/v1/agents/${body.agentId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: lastMessage?.content ?? '',
          ...(body.walletId && { walletId: body.walletId }),
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const outputs: AgentRuntimeOutput[] = json.data ?? json.outputs ?? [];
        const normalized = normalizeAgentRuntimeResponse(outputs);
        return NextResponse.json(normalized);
      }

      const errText = await response.text().catch(() => 'unknown');
      console.warn(`[agent-execute] Agent runtime returned ${response.status}: ${errText}`);
    } catch (err) {
      console.warn(
        `[agent-execute] Agent runtime unavailable, falling back to direct OpenAI:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'OPENAI_API_KEY is not configured. Add it to your .env file and restart.',
      },
      { status: 500 },
    );
  }

  try {
    const fallbackPrompt = body.walletId
      ? `${SOLAGENT_SYSTEM_PROMPT}\nThe user's wallet ID is: ${body.walletId}.\n\nIMPORTANT: The agent-runtime service is currently unavailable, so you cannot execute tools (transfers, airdrops, etc). Respond conversationally and let the user know that the action service is temporarily down. You can still answer questions about Solana.`
      : `${SOLAGENT_SYSTEM_PROMPT}\n\nIMPORTANT: The agent-runtime service is currently unavailable, so you cannot execute tools. Respond conversationally and let the user know that the action service is temporarily down.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.DEFAULT_MODEL || 'gpt-4o',
        messages: [{ role: 'system', content: fallbackPrompt }, ...body.messages],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[agent-execute] OpenAI API error: ${errorData}`);
      return NextResponse.json(
        { error: 'LLM API error', details: errorData },
        { status: response.status },
      );
    }

    const data = await response.json();
    const choice = data.choices?.[0]?.message;

    const normalized: NormalizedResponse = {
      content: choice?.content ?? '(No response from SolAgent)',
    };

    return NextResponse.json(normalized);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to call LLM API', details: message },
      { status: 502 },
    );
  }
}
