import { describe, it, expect, beforeAll, vi } from 'vitest';
import { Transaction, SystemProgram, PublicKey } from '@solana/web3.js';

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

vi.mock('../../services/transaction-engine/src/config/env', () => ({
  env: {
    PORT: 3004,
    DATABASE_URL: 'postgresql://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    REDPANDA_BROKERS: 'localhost:9092',
    SOLANA_RPC_URL: 'https://api.devnet.solana.com',
    SOLANA_NETWORK: 'devnet' as const,
    WALLET_ENGINE_URL: 'http://localhost:3002',
    POLICY_ENGINE_URL: 'http://localhost:3003',
    KORA_URL: 'http://localhost:8911',
    MAX_RETRIES: 5,
    CONFIRMATION_TIMEOUT_MS: 60_000,
  },
}));

const createMockRedis = () =>
  ({
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    status: 'ready',
  }) as any;

const createMockConnection = () =>
  ({
    getBalance: vi.fn().mockResolvedValue(5_000_000_000),
    getParsedTokenAccountsByOwner: vi.fn().mockResolvedValue({ value: [] }),
    getRecentBlockhash: vi.fn().mockResolvedValue({
      blockhash: 'EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N',
      feeCalculator: { lamportsPerSignature: 5000 },
    }),
    getLatestBlockhash: vi.fn().mockResolvedValue({
      blockhash: 'EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N',
      lastValidBlockHeight: 200_000_000,
    }),
  }) as any;

describe('Cross-Service Integration', () => {
  let walletApp: Awaited<ReturnType<typeof import('../../services/wallet-engine/src/app').createApp>>['app'];

  beforeAll(async () => {
    const { createApp: createWalletApp } = await import('../../services/wallet-engine/src/app');
    const walletCtx = createWalletApp({
      redis: createMockRedis(),
      connection: createMockConnection(),
    });
    walletApp = walletCtx.app;
  });

  describe('wallet-engine request/response contract', () => {
    let walletId: string;
    let walletPublicKey: string;

    it('POST /api/v1/wallets creates a wallet with publicKey', async () => {
      const res = await walletApp.request('/api/v1/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'agent-cross-service-1',
          label: 'Cross-Service Test Wallet',
          network: 'devnet',
        }),
      });

      expect(res.status).toBe(201);
      const { data } = await res.json();

      expect(data.id).toEqual(expect.any(String));
      expect(data.publicKey).toEqual(expect.any(String));
      expect(data.publicKey.length).toBeGreaterThanOrEqual(32);
      expect(data.agentId).toBe('agent-cross-service-1');
      expect(data.label).toBe('Cross-Service Test Wallet');
      expect(data.network).toBe('devnet');
      expect(data.status).toBe('active');
      expect(data.provider).toBe('local');

      walletId = data.id;
      walletPublicKey = data.publicKey;
    });

    it('GET /api/v1/wallets/:id returns the same wallet', async () => {
      const res = await walletApp.request(`/api/v1/wallets/${walletId}`);

      expect(res.status).toBe(200);
      const { data } = await res.json();

      expect(data.id).toBe(walletId);
      expect(data.publicKey).toBe(walletPublicKey);
      expect(data.agentId).toBe('agent-cross-service-1');
      expect(data.status).toBe('active');
    });

    it('GET /api/v1/wallets/:id/balance returns balance for the wallet', async () => {
      const res = await walletApp.request(`/api/v1/wallets/${walletId}/balance`);

      expect(res.status).toBe(200);
      const { data } = await res.json();

      expect(data.publicKey).toBe(walletPublicKey);
      expect(data.walletId).toBe(walletId);
      expect(typeof data.solBalance).toBe('number');
    });

    it('POST /api/v1/wallets/:id/sign accepts base64 tx and returns signed tx', async () => {
      const tx = new Transaction();
      tx.recentBlockhash = 'EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N';
      tx.feePayer = new PublicKey(walletPublicKey);
      tx.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(walletPublicKey),
          toPubkey: new PublicKey(walletPublicKey),
          lamports: 0,
        }),
      );
      const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });

      const res = await walletApp.request(`/api/v1/wallets/${walletId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction: serialized.toString('base64'),
        }),
      });

      expect(res.status).toBe(200);
      const { data } = await res.json();

      expect(data.signature).toEqual(expect.any(String));
      const sigBytes = Buffer.from(data.signature, 'base64');
      expect(sigBytes.length).toBeGreaterThan(0);
    });

    it('wallet ID from creation is consistent across all endpoints', async () => {
      const getRes = await walletApp.request(`/api/v1/wallets/${walletId}`);
      const { data: fetched } = await getRes.json();

      const balanceRes = await walletApp.request(`/api/v1/wallets/${walletId}/balance`);
      const { data: balance } = await balanceRes.json();

      expect(fetched.id).toBe(walletId);
      expect(fetched.publicKey).toBe(walletPublicKey);
      expect(balance.walletId).toBe(walletId);
      expect(balance.publicKey).toBe(walletPublicKey);
    });
  });

  describe('error contract', () => {
    it('GET /api/v1/wallets/:id returns 404 for missing wallet', async () => {
      const res = await walletApp.request('/api/v1/wallets/nonexistent-wallet-id');

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe('WALLET_NOT_FOUND');
    });

    it('POST /api/v1/wallets returns 400 for invalid body', async () => {
      const res = await walletApp.request('/api/v1/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it('POST /api/v1/wallets/:id/sign returns 403 for frozen wallet', async () => {
      const createRes = await walletApp.request('/api/v1/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'agent-frozen-test',
          label: 'Frozen Test',
          network: 'devnet',
        }),
      });
      const { data: wallet } = await createRes.json();

      await walletApp.request(`/api/v1/wallets/${wallet.id}`, { method: 'DELETE' });

      const signRes = await walletApp.request(`/api/v1/wallets/${wallet.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction: Buffer.from([1, 2, 3]).toString('base64'),
        }),
      });

      expect(signRes.status).toBe(403);
    });
  });
});
