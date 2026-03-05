import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireApiKey, isAuthFailure, authErrorResponse } from '../_lib/auth';

const AGENT_RUNTIME_URL = process.env.AGENT_RUNTIME_URL || 'http://localhost:3001';

export async function POST(req: NextRequest) {
  const auth = requireApiKey(req);
  if (isAuthFailure(auth)) return authErrorResponse(auth);
  try {
    const body = await req.json();
    const { agentId } = body;

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
    }

    const res = await fetch(`${AGENT_RUNTIME_URL}/api/v1/agents/${agentId}/clear-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to clear state' }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
