import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRaydiumAdapter } from '../src/adapters/raydium.adapter';

const RPC_URL = 'https://api.devnet.solana.com';

const mockQuoteResponse = {
  amountOut: '45000000',
  priceImpact: 0.08,
  fee: '2500',
};

const mockPoolResponse = {
  id: 'pool123',
  baseMint: 'So11111111111111111111111111111111111111112',
  quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  baseAmount: 1500000,
  quoteAmount: 35000000,
  tvl: 2500000,
  apr24h: 12.5,
};

describe('Raydium Adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches a swap quote', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockQuoteResponse), { status: 200 }),
    );

    const adapter = createRaydiumAdapter(RPC_URL);
    const quote = await adapter.getSwapQuote!({
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amount: '1000000000',
      slippageBps: 50,
      walletAddress: 'WaLLet111111111111111111111111111111111111',
    });

    expect(quote.inputAmount).toBe('1000000000');
    expect(quote.outputAmount).toBe('45000000');
    expect(quote.priceImpactPct).toBe(0.08);
    expect(quote.fee).toBe('2500');
  });

  it('throws on quote API failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Service unavailable', { status: 503 }),
    );

    const adapter = createRaydiumAdapter(RPC_URL);
    await expect(
      adapter.getSwapQuote!({
        inputMint: 'x',
        outputMint: 'y',
        amount: '0',
        walletAddress: 'z',
      }),
    ).rejects.toThrow('Raydium');
  });

  it('fetches pool info', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockPoolResponse), { status: 200 }),
    );

    const adapter = createRaydiumAdapter(RPC_URL);
    const pool = await adapter.getPoolInfo!('pool123');

    expect(pool.id).toBe('pool123');
    expect(pool.tokenA.mint).toBe('So11111111111111111111111111111111111111112');
    expect(pool.tokenB.mint).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    expect(pool.tvl).toBe('2500000');
    expect(pool.apy).toBe(12.5);
  });

  it('throws on pool fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Not Found', { status: 404 }),
    );

    const adapter = createRaydiumAdapter(RPC_URL);
    await expect(adapter.getPoolInfo!('nonexistent')).rejects.toThrow('Raydium');
  });
});
