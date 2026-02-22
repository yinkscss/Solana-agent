import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { createApp } from '../src/app';

vi.mock('../src/config/env', () => ({
  env: {
    PORT: 3002,
    DATABASE_URL: 'postgresql://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    SOLANA_RPC_URL: 'https://api.devnet.solana.com',
    SOLANA_NETWORK: 'devnet' as const,
    DEFAULT_KEY_PROVIDER: 'local' as const,
  },
}));

const createMockRedis = () => ({
  get: vi.fn().mockResolvedValue(null),
  setex: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  status: 'ready',
});

const createMockConnection = () => ({
  getBalance: vi.fn().mockResolvedValue(2_500_000_000),
  getParsedTokenAccountsByOwner: vi.fn().mockResolvedValue({ value: [] }),
});

describe('Wallet Engine Integration', () => {
  let app: ReturnType<typeof createApp>['app'];

  beforeEach(() => {
    vi.clearAllMocks();
    const ctx = createApp({
      redis: createMockRedis() as any,
      connection: createMockConnection() as any,
    });
    app = ctx.app;
  });

  describe('create wallet → get → get balance flow', () => {
    it('creates a wallet then retrieves it and its balance consistently', async () => {
      const createRes = await app.request('/api/v1/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'agent-integration-1',
          label: 'Integration Wallet',
          network: 'devnet',
        }),
      });

      expect(createRes.status).toBe(201);
      const { data: created } = await createRes.json();
      expect(created.publicKey).toBeTruthy();
      expect(created.status).toBe('active');

      const getRes = await app.request(`/api/v1/wallets/${created.id}`);
      expect(getRes.status).toBe(200);
      const { data: fetched } = await getRes.json();
      expect(fetched.id).toBe(created.id);
      expect(fetched.publicKey).toBe(created.publicKey);
      expect(fetched.agentId).toBe('agent-integration-1');

      const balanceRes = await app.request(`/api/v1/wallets/${created.id}/balance`);
      expect(balanceRes.status).toBe(200);
      const { data: balance } = await balanceRes.json();
      expect(balance.solBalance).toBe(2.5);
      expect(balance.publicKey).toBe(created.publicKey);
    });
  });

  describe('create → deactivate → recover flow', () => {
    it('transitions wallet through active → frozen → recovering', async () => {
      const createRes = await app.request('/api/v1/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'agent-lifecycle',
          label: 'Lifecycle Wallet',
          network: 'devnet',
        }),
      });
      const { data: created } = await createRes.json();
      expect(created.status).toBe('active');

      const deactivateRes = await app.request(`/api/v1/wallets/${created.id}`, {
        method: 'DELETE',
      });
      expect(deactivateRes.status).toBe(200);
      const { data: frozen } = await deactivateRes.json();
      expect(frozen.status).toBe('frozen');

      const recoverRes = await app.request(`/api/v1/wallets/${created.id}/recover`, {
        method: 'POST',
      });
      expect(recoverRes.status).toBe(200);
      const { data: recovering } = await recoverRes.json();
      expect(recovering.status).toBe('recovering');
    });

    it('rejects recovery of an active wallet', async () => {
      const createRes = await app.request('/api/v1/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'agent-bad-recover',
          label: 'Bad Recover',
          network: 'devnet',
        }),
      });
      const { data: created } = await createRes.json();

      const recoverRes = await app.request(`/api/v1/wallets/${created.id}/recover`, {
        method: 'POST',
      });
      expect(recoverRes.status).toBe(502);
    });
  });

  describe('multiple wallets per agent', () => {
    it('creates 3 wallets for the same agent and lists all', async () => {
      const agentId = 'agent-multi-wallet';

      for (const label of ['Wallet A', 'Wallet B', 'Wallet C']) {
        const res = await app.request('/api/v1/wallets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId, label, network: 'devnet' }),
        });
        expect(res.status).toBe(201);
      }

      const listRes = await app.request(`/api/v1/agents/${agentId}/wallets`);
      expect(listRes.status).toBe(200);
      const { data: wallets } = await listRes.json();
      expect(wallets).toHaveLength(3);

      const labels = wallets.map((w: { label: string }) => w.label).sort();
      expect(labels).toEqual(['Wallet A', 'Wallet B', 'Wallet C']);
    });
  });

  describe('sign transaction flow', () => {
    it('creates a wallet then signs a real transaction, returning both fields', async () => {
      const createRes = await app.request('/api/v1/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'agent-signer',
          label: 'Sign Wallet',
          network: 'devnet',
        }),
      });
      expect(createRes.status).toBe(201);
      const { data: wallet } = await createRes.json();

      const feePayer = new PublicKey(wallet.publicKey);
      const tx = new Transaction({
        recentBlockhash: 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi',
        feePayer,
      });
      tx.add(
        SystemProgram.transfer({ fromPubkey: feePayer, toPubkey: feePayer, lamports: 1000n }),
      );
      const serialized = tx.serialize({ requireAllSignatures: false });

      const signRes = await app.request(`/api/v1/wallets/${wallet.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction: Buffer.from(serialized).toString('base64'),
        }),
      });

      expect(signRes.status).toBe(200);
      const { data: signed } = await signRes.json();
      expect(signed.signature).toBeTruthy();
      expect(signed.signedTransaction).toBeTruthy();

      const sigBuffer = Buffer.from(signed.signature, 'base64');
      expect(sigBuffer.length).toBe(64);

      const signedTx = Transaction.from(
        Buffer.from(signed.signedTransaction, 'base64'),
      );
      expect(signedTx.signature).not.toBeNull();
    });

    it('refuses to sign with a frozen wallet', async () => {
      const createRes = await app.request('/api/v1/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'agent-frozen-sign',
          label: 'Frozen Sign',
          network: 'devnet',
        }),
      });
      const { data: wallet } = await createRes.json();

      await app.request(`/api/v1/wallets/${wallet.id}`, { method: 'DELETE' });

      const feePayer = new PublicKey(wallet.publicKey);
      const tx = new Transaction({
        recentBlockhash: 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi',
        feePayer,
      });
      tx.add(
        SystemProgram.transfer({ fromPubkey: feePayer, toPubkey: feePayer, lamports: 1000n }),
      );
      const serialized = tx.serialize({ requireAllSignatures: false });

      const signRes = await app.request(`/api/v1/wallets/${wallet.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction: Buffer.from(serialized).toString('base64'),
        }),
      });

      expect(signRes.status).toBe(403);
    });
  });

  describe('error handling', () => {
    it('returns 404 for nonexistent wallet', async () => {
      const res = await app.request('/api/v1/wallets/nonexistent-id');
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe('WALLET_NOT_FOUND');
    });

    it('returns 400 for invalid create body', async () => {
      const res = await app.request('/api/v1/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: '' }),
      });
      expect(res.status).toBe(400);
    });
  });
});
