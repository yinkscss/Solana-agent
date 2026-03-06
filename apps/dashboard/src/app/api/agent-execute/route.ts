import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireApiKey, isAuthFailure, authErrorResponse } from '../_lib/auth';

interface AgentRuntimeOutput {
  type: 'text' | 'tool_call' | 'tool_result' | 'error';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
}

interface ToolResultEntry {
  name: string;
  result: unknown;
}

function parseToolResult(toolResult: unknown, content: string): unknown {
  if (toolResult != null) return toolResult;
  try {
    return content ? JSON.parse(content) : undefined;
  } catch {
    return undefined;
  }
}

function normalizeAgentRuntimeResponse(outputs: AgentRuntimeOutput[]): NormalizedResponse {
  const textParts: string[] = [];
  const toolCalls: Array<{ name: string; arguments: string }> = [];
  const toolResults: ToolResultEntry[] = [];

  for (const output of outputs) {
    if (output.type === 'text') {
      textParts.push(output.content);
    } else if (output.type === 'tool_call' && output.toolName) {
      toolCalls.push({
        name: output.toolName,
        arguments: JSON.stringify(output.toolArgs ?? {}),
      });
    } else if (output.type === 'tool_result' && output.toolName) {
      const parsed = parseToolResult(output.toolResult, output.content);
      toolResults.push({ name: output.toolName, result: parsed ?? output.content });
    } else if (output.type === 'error') {
      textParts.push(`Error: ${output.content}`);
    }
  }

  return {
    content: textParts.join('\n') || '(No response)',
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    toolResults: toolResults.length > 0 ? toolResults : undefined,
  };
}

interface NormalizedResponse {
  content: string;
  toolCalls?: Array<{ name: string; arguments: string }>;
  toolResults?: ToolResultEntry[];
}

async function handleAgentRuntimeResponse(response: Response): Promise<NextResponse> {
  if (response.ok) {
    const json = await response.json();
    const outputs: AgentRuntimeOutput[] = json.data ?? json.outputs ?? [];
    const normalized = normalizeAgentRuntimeResponse(outputs);
    return NextResponse.json(normalized);
  }
  const errText = await response.text().catch(() => 'unknown');
  console.warn(`[agent-execute] Agent runtime returned ${response.status}: ${errText}`);
  return NextResponse.json(
    { content: `Something went wrong (${response.status}). Please try again.`, error: errText },
    { status: response.status >= 500 ? 502 : 400 },
  );
}

type ExecuteBody = {
  agentId?: string;
  walletId?: string;
  walletPublicKey?: string;
  confirmedTools?: string[];
  messages?: Array<{ role: string; content: string }>;
};

async function parseBody(req: NextRequest): Promise<NextResponse | ExecuteBody> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const b = body as ExecuteBody;
  if (!Array.isArray(b.messages) || b.messages.length === 0) {
    return NextResponse.json(
      { error: 'messages array is required and must not be empty' },
      { status: 400 },
    );
  }
  return b;
}

export async function POST(req: NextRequest) {
  const auth = requireApiKey(req);
  if (isAuthFailure(auth)) return authErrorResponse(auth);

  const bodyResult = await parseBody(req);
  if (bodyResult instanceof NextResponse) return bodyResult;
  const body = bodyResult;

  const agentRuntimeUrl = process.env.AGENT_RUNTIME_URL || 'http://localhost:3001';
  if (!body.agentId) {
    return NextResponse.json(
      { content: 'No agent configured. Please refresh the page to set up your SolAgent.' },
      { status: 400 },
    );
  }

  try {
    const messages = body.messages ?? [];
    const lastMessage = messages[messages.length - 1];
    const response = await fetch(`${agentRuntimeUrl}/api/v1/agents/${body.agentId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: lastMessage?.content ?? '',
        ...(body.walletId && { walletId: body.walletId }),
        ...(body.walletPublicKey && { walletPublicKey: body.walletPublicKey }),
        ...(body.confirmedTools && { confirmedTools: body.confirmedTools }),
      }),
    });
    return handleAgentRuntimeResponse(response);
  } catch (err) {
    console.warn(
      `[agent-execute] Agent runtime unavailable:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { content: 'SolAgent is temporarily unavailable. Please try again in a moment.' },
      { status: 502 },
    );
  }
}
