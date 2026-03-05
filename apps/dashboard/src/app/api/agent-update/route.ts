import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireApiKey, isAuthFailure, authErrorResponse } from '../_lib/auth';

const AGENT_RUNTIME_URL = process.env.AGENT_RUNTIME_URL || 'http://localhost:3001';
const ALLOWED_UPDATE_FIELDS = ['walletId', 'name', 'description', 'systemPrompt', 'model'] as const;

export async function PUT(req: NextRequest) {
  const auth = requireApiKey(req);
  if (isAuthFailure(auth)) return authErrorResponse(auth);

  try {
    const body = await req.json();
    const { agentId, ...raw } = body;

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (key in raw) updates[key] = raw[key];
    }

    const res = await fetch(`${AGENT_RUNTIME_URL}/api/v1/agents/${agentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown');
      return NextResponse.json({ error: `Update failed: ${text}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data.data ?? data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
