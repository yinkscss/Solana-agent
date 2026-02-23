import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const WALLET_ENGINE_URL = process.env.WALLET_ENGINE_URL || 'http://localhost:3002';
const AGENT_RUNTIME_URL = process.env.AGENT_RUNTIME_URL || 'http://localhost:3001';

async function lookupWalletById(walletId: string) {
  const res = await fetch(`${WALLET_ENGINE_URL}/api/v1/wallets`);
  if (!res.ok) return null;
  const wallets = await res.json();
  const list = Array.isArray(wallets) ? wallets : (wallets.data ?? []);
  return list.find((w: { id: string }) => w.id === walletId) ?? null;
}

async function getFirstAgentId(): Promise<string | null> {
  try {
    const res = await fetch(`${AGENT_RUNTIME_URL}/api/v1/agents`);
    if (!res.ok) return null;
    const agents = await res.json();
    const list = agents.data ?? agents;
    if (Array.isArray(list) && list.length > 0) return list[0].id;
  } catch {}
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    if (body.existingWalletId) {
      const wallet = await lookupWalletById(body.existingWalletId);
      if (wallet) {
        return NextResponse.json({
          id: wallet.id,
          publicKey: wallet.publicKey,
        });
      }
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const agentId = await getFirstAgentId();
    if (!agentId) {
      return NextResponse.json({ error: 'No agents available to assign wallet' }, { status: 503 });
    }

    const label = body.label || 'My Wallet';
    const res = await fetch(`${WALLET_ENGINE_URL}/api/v1/wallets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId,
        label,
        provider: 'local',
        network: 'devnet',
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'unknown');
      return NextResponse.json(
        { error: `Wallet creation failed: ${text}` },
        { status: res.status },
      );
    }

    const wallet = await res.json();
    const data = wallet.data ?? wallet;

    return NextResponse.json({
      id: data.id,
      publicKey: data.publicKey,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Provisioning failed: ${message}` }, { status: 500 });
  }
}
