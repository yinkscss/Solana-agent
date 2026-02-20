import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../services/wallet-engine/src/config/env', () => ({
  env: {
    PORT: 3002,
    DATABASE_URL: 'postgresql://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    SOLANA_RPC_URL: 'https://api.devnet.solana.com',
    SOLANA_NETWORK: 'devnet' as const,
    DEFAULT_KEY_PROVIDER: 'local' as const,
  },
}));

import { createApp } from '../../services/wallet-engine/src/app';

const createMockRedis = () => ({
  get: vi.fn().mockResolvedValue(null),
  setex: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  status: 'ready',
});

const createMockConnection = () => ({
  getBalance: vi.fn().mockResolvedValue(0),
  getParsedTokenAccountsByOwner: vi.fn().mockResolvedValue({ value: [] }),
});

describe('Wallet Lifecycle E2E', () => {
  let app: ReturnType<typeof createApp>['app'];

  beforeEach(() => {
    vi.clearAllMocks();
    const ctx = createApp({
      redis: createMockRedis() as any,
      connection: createMockConnection() as any,
    });
    app = ctx.app;
  });

  const createWallet = async (overrides: Record<string, string> = {}) => {
    const res = await app.request('/api/v1/wallets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'agent-e2e-1',
        label: 'E2E Wallet',
        network: 'devnet',
        ...overrides,
      }),
    });
    expect(res.status).toBe(201);
    const { data } = await res.json();
    return data;
  };

  it('creates a wallet and retrieves it with correct fields', async () => {
    const wallet = await createWallet();

    expect(wallet.id).toBeTruthy();
    expect(wallet.publicKey).toBeTruthy();
    expect(wallet.status).toBe('active');
    expect(wallet.agentId).toBe('agent-e2e-1');
    expect(wallet.label).toBe('E2E Wallet');
    expect(wallet.network).toBe('devnet');

    const getRes = await app.request(`/api/v1/wallets/${wallet.id}`);
    expect(getRes.status).toBe(200);
    const { data: fetched } = await getRes.json();
    expect(fetched.id).toBe(wallet.id);
    expect(fetched.publicKey).toBe(wallet.publicKey);
    expect(fetched.status).toBe('active');
  });

  it('returns zero balance for new wallet', async () => {
    const wallet = await createWallet();

    const balanceRes = await app.request(`/api/v1/wallets/${wallet.id}/balance`);
    expect(balanceRes.status).toBe(200);
    const { data: balance } = await balanceRes.json();
    expect(balance.solBalance).toBe(0);
    expect(balance.publicKey).toBe(wallet.publicKey);
  });

  it('freezes wallet and verifies it cannot sign', async () => {
    const wallet = await createWallet();

    const freezeRes = await app.request(`/api/v1/wallets/${wallet.id}`, {
      method: 'DELETE',
    });
    expect(freezeRes.status).toBe(200);
    const { data: frozen } = await freezeRes.json();
    expect(frozen.status).toBe('frozen');

    const signRes = await app.request(`/api/v1/wallets/${wallet.id}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction: Buffer.from([1, 2, 3]).toString('base64'),
      }),
    });
    expect(signRes.status).toBe(403);
  });

  it('recovers a frozen wallet', async () => {
    const wallet = await createWallet();

    await app.request(`/api/v1/wallets/${wallet.id}`, { method: 'DELETE' });

    const recoverRes = await app.request(`/api/v1/wallets/${wallet.id}/recover`, {
      method: 'POST',
    });
    expect(recoverRes.status).toBe(200);
    const { data: recovered } = await recoverRes.json();
    expect(recovered.status).toBe('recovering');
  });
});
