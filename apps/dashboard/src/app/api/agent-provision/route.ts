import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireApiKey, isAuthFailure, authErrorResponse } from '../_lib/auth';

const AGENT_RUNTIME_URL = process.env.AGENT_RUNTIME_URL || 'http://localhost:3001';

const DEFAULT_AGENT = {
  name: 'SolAgent',
  description: 'Your personal Solana AI assistant',
  framework: 'solagent',
  llmProvider: 'openai',
  model: 'gpt-4o-mini',
  systemPrompt:
    'You are SolAgent, a helpful Solana blockchain assistant. Help users manage their wallets, check balances, transfer tokens, swap tokens, and explore transactions on the Solana devnet.',
  tools: [
    'get_balance',
    'transfer',
    'swap',
    'create_wallet',
    'request_airdrop',
    'get_transactions',
  ],
};

function agentResponse(agent: Record<string, unknown>) {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    model: agent.model,
    systemPrompt: agent.systemPrompt,
    tools: agent.tools,
    status: agent.status,
    walletId: agent.walletId || null,
  };
}

async function findAgentById(agentId: string) {
  const res = await fetch(`${AGENT_RUNTIME_URL}/api/v1/agents/${agentId}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.data ?? data;
}

async function findFirstAgent(orgId: string) {
  try {
    const res = await fetch(
      `${AGENT_RUNTIME_URL}/api/v1/agents?orgId=${encodeURIComponent(orgId)}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.data ?? []);
    return list.length > 0 ? list[0] : null;
  } catch {
    return null;
  }
}

async function createAgent(orgId: string) {
  const res = await fetch(`${AGENT_RUNTIME_URL}/api/v1/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgId, ...DEFAULT_AGENT }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown');
    throw new Error(`Agent creation failed: ${text}`);
  }
  const data = await res.json();
  return data.data ?? data;
}

export async function POST(req: NextRequest) {
  const auth = requireApiKey(req);
  if (isAuthFailure(auth)) return authErrorResponse(auth);

  try {
    const body = await req.json().catch(() => ({}));
    const orgId = body.orgId || 'default-org';

    if (body.existingAgentId) {
      const agent = await findAgentById(body.existingAgentId);
      if (agent) return NextResponse.json(agentResponse(agent));
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const existing = await findFirstAgent(orgId);
    if (existing) return NextResponse.json(agentResponse(existing));
    const agent = await createAgent(orgId);
    return NextResponse.json(agentResponse(agent));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Agent provisioning failed: ${message}` }, { status: 500 });
  }
}
