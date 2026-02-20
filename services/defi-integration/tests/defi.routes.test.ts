import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createDeFiRoutes } from '../src/routes/defi';
import { createDeFiController } from '../src/controllers/defi.controller';
import type { DeFiService } from '../src/services/defi.service';
import { errorHandler } from '../src/middleware/error-handler';

const mockDeFiService: DeFiService = {
  getSwapQuote: vi.fn(async () => ({
    inputMint: 'SOL',
    outputMint: 'USDC',
    inputAmount: '1000000000',
    outputAmount: '23450000',
    priceImpactPct: 0.1,
    fee: '5000',
    route: [],
  })),
  executeSwap: vi.fn(async () => ({ transactionId: 'tx-123' })),
  stake: vi.fn(async () => ({ transactionId: 'tx-stake-1' })),
  unstake: vi.fn(async () => ({ transactionId: 'tx-unstake-1' })),
  getPrice: vi.fn(async () => ({
    symbol: 'SOL/USD',
    price: 145.23,
    confidence: 0.12,
    timestamp: 1700000000,
  })),
  listProtocols: vi.fn(() => [
    { name: 'jupiter', programIds: ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'], capabilities: ['swap'] },
  ]),
  getPoolInfo: vi.fn(async () => ({
    id: 'pool1',
    tokenA: { mint: 'SOL', amount: '1000' },
    tokenB: { mint: 'USDC', amount: '50000' },
    tvl: '100000',
    apy: 8.5,
  })),
};

const createTestApp = () => {
  const controller = createDeFiController(mockDeFiService);
  const app = new Hono();
  app.route('/api/v1/defi', createDeFiRoutes(controller));
  app.onError(errorHandler);
  return app;
};

describe('DeFi Routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/v1/defi/quote returns swap quote', async () => {
    const app = createTestApp();
    const params = new URLSearchParams({
      protocol: 'jupiter',
      inputMint: 'SOL',
      outputMint: 'USDC',
      amount: '1000000000',
      walletAddress: 'wallet1',
    });

    const res = await app.request(`/api/v1/defi/quote?${params.toString()}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.outputAmount).toBe('23450000');
  });

  it('GET /api/v1/defi/quote validates required params', async () => {
    const app = createTestApp();
    const res = await app.request('/api/v1/defi/quote?protocol=jupiter');
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/defi/swap executes swap', async () => {
    const app = createTestApp();
    const res = await app.request('/api/v1/defi/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletId: '550e8400-e29b-41d4-a716-446655440000',
        protocol: 'jupiter',
        walletAddress: 'wallet1',
        quote: {
          inputMint: 'SOL',
          outputMint: 'USDC',
          inputAmount: '1000000000',
          outputAmount: '23450000',
          priceImpactPct: 0.1,
          fee: '5000',
          route: [],
        },
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.transactionId).toBe('tx-123');
  });

  it('POST /api/v1/defi/swap validates walletId as UUID', async () => {
    const app = createTestApp();
    const res = await app.request('/api/v1/defi/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletId: 'not-a-uuid',
        protocol: 'jupiter',
        walletAddress: 'wallet1',
        quote: {
          inputMint: 'SOL',
          outputMint: 'USDC',
          inputAmount: '1000',
          outputAmount: '23',
          priceImpactPct: 0,
          fee: '0',
          route: [],
        },
      }),
    });

    expect(res.status).toBe(400);
  });

  it('POST /api/v1/defi/stake stakes tokens', async () => {
    const app = createTestApp();
    const res = await app.request('/api/v1/defi/stake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletId: '550e8400-e29b-41d4-a716-446655440000',
        protocol: 'marinade',
        walletAddress: 'wallet1',
        amount: '2000000000',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.transactionId).toBe('tx-stake-1');
  });

  it('POST /api/v1/defi/unstake unstakes tokens', async () => {
    const app = createTestApp();
    const res = await app.request('/api/v1/defi/unstake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletId: '550e8400-e29b-41d4-a716-446655440000',
        protocol: 'marinade',
        walletAddress: 'wallet1',
        amount: '1000000000',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.transactionId).toBe('tx-unstake-1');
  });

  it('GET /api/v1/defi/price/:mint returns price', async () => {
    const app = createTestApp();
    const res = await app.request('/api/v1/defi/price/So11111111111111111111111111111111111111112');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.symbol).toBe('SOL/USD');
    expect(body.data.price).toBe(145.23);
  });

  it('GET /api/v1/defi/protocols lists all protocols', async () => {
    const app = createTestApp();
    const res = await app.request('/api/v1/defi/protocols');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe('jupiter');
  });

  it('GET /api/v1/defi/pools/:protocol/:poolId returns pool info', async () => {
    const app = createTestApp();
    const res = await app.request('/api/v1/defi/pools/raydium/pool1');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe('pool1');
    expect(body.data.apy).toBe(8.5);
  });
});
