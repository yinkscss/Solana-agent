import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createJupiterAdapter } from '../src/adapters/jupiter.adapter';

const API_URL = 'https://quote-api.jup.ag/v6';

const mockQuoteResponse = {
  inputMint: 'So11111111111111111111111111111111111111112',
  outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  inAmount: '1000000000',
  outAmount: '23450000',
  priceImpactPct: '0.12',
  otherAmountThreshold: '23200000',
  routePlan: [
    { swapInfo: { feeAmount: '5000', ammKey: 'pool1' } },
    { swapInfo: { feeAmount: '3000', ammKey: 'pool2' } },
  ],
};

const mockSwapResponse = {
  swapTransaction: Buffer.from('fake-serialized-transaction').toString('base64'),
};

describe('Jupiter Adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches a swap quote with correct parameters', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockQuoteResponse), { status: 200 }),
    );

    const adapter = createJupiterAdapter(API_URL);
    const quote = await adapter.getSwapQuote!({
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amount: '1000000000',
      slippageBps: 100,
      walletAddress: 'WaLLet111111111111111111111111111111111111',
    });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const calledUrl = new URL(fetchSpy.mock.calls[0]![0] as string);
    expect(calledUrl.pathname).toBe('/v6/quote');
    expect(calledUrl.searchParams.get('inputMint')).toBe('So11111111111111111111111111111111111111112');
    expect(calledUrl.searchParams.get('amount')).toBe('1000000000');
    expect(calledUrl.searchParams.get('slippageBps')).toBe('100');

    expect(quote.inputMint).toBe('So11111111111111111111111111111111111111112');
    expect(quote.outputMint).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    expect(quote.inputAmount).toBe('1000000000');
    expect(quote.outputAmount).toBe('23450000');
    expect(quote.priceImpactPct).toBe(0.12);
    expect(quote.fee).toBe('8000');
  });

  it('uses default slippage of 50 bps', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockQuoteResponse), { status: 200 }),
    );

    const adapter = createJupiterAdapter(API_URL);
    await adapter.getSwapQuote!({
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amount: '1000000000',
      walletAddress: 'WaLLet111111111111111111111111111111111111',
    });

    const calledUrl = new URL(fetchSpy.mock.calls[0]![0] as string);
    expect(calledUrl.pathname).toBe('/v6/quote');
    expect(calledUrl.searchParams.get('slippageBps')).toBe('50');
  });

  it('throws ExternalServiceError on quote failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Bad Request', { status: 400 }),
    );

    const adapter = createJupiterAdapter(API_URL);
    await expect(
      adapter.getSwapQuote!({
        inputMint: 'invalid',
        outputMint: 'invalid',
        amount: '0',
        walletAddress: 'WaLLet111111111111111111111111111111111111',
      }),
    ).rejects.toThrow('Jupiter');
  });

  it('builds swap instructions from quote', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockSwapResponse), { status: 200 }),
    );

    const adapter = createJupiterAdapter(API_URL);
    const instructions = await adapter.buildSwapInstructions!({
      walletAddress: 'WaLLet111111111111111111111111111111111111',
      quote: {
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        inputAmount: '1000000000',
        outputAmount: '23450000',
        priceImpactPct: 0.12,
        fee: '8000',
        route: mockQuoteResponse,
      },
    });

    const fetchCall = vi.mocked(fetch).mock.calls[0]!;
    expect(fetchCall[0]).toBe(`${API_URL}/swap`);
    const sentBody = JSON.parse(fetchCall[1]!.body as string);
    expect(sentBody.quoteResponse).toEqual(mockQuoteResponse);
    expect(sentBody.userPublicKey).toBe('WaLLet111111111111111111111111111111111111');
    expect(sentBody.wrapAndUnwrapSol).toBe(true);

    expect(instructions).toHaveLength(1);
    expect(instructions[0]!.programId).toBe('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');
    expect(instructions[0]!.data).toBeTruthy();
  });

  it('throws ExternalServiceError on swap build failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Internal Error', { status: 500 }),
    );

    const adapter = createJupiterAdapter(API_URL);
    await expect(
      adapter.buildSwapInstructions!({
        walletAddress: 'WaLLet111111111111111111111111111111111111',
        quote: {
          inputMint: 'x',
          outputMint: 'y',
          inputAmount: '0',
          outputAmount: '0',
          priceImpactPct: 0,
          fee: '0',
          route: [],
        },
      }),
    ).rejects.toThrow('Jupiter');
  });
});
