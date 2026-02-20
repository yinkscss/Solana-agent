import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDeFiService } from '../src/services/defi.service';
import { createAdapterRegistry } from '../src/adapters/adapter-registry';
import type { DeFiProtocolAdapter, SwapQuote } from '../src/adapters/adapter.interface';
import type { PriceFeedService } from '../src/services/price-feed.service';

const TX_ENGINE_URL = 'http://localhost:3004';

const mockSwapAdapter: DeFiProtocolAdapter = {
  name: 'mock-swap',
  programIds: ['MockSwapProgram111111111111111111111111111'],
  getSwapQuote: vi.fn(async () => ({
    inputMint: 'SOL',
    outputMint: 'USDC',
    inputAmount: '1000000000',
    outputAmount: '23450000',
    priceImpactPct: 0.1,
    fee: '5000',
    route: [],
  })),
  buildSwapInstructions: vi.fn(async () => [
    {
      programId: 'MockSwapProgram111111111111111111111111111',
      keys: [{ pubkey: 'wallet1', isSigner: true, isWritable: true }],
      data: 'AQID',
    },
  ]),
};

const mockStakeAdapter: DeFiProtocolAdapter = {
  name: 'mock-stake',
  programIds: ['MockStakeProgram111111111111111111111111111'],
  buildStakeInstructions: vi.fn(async () => [
    {
      programId: 'MockStakeProgram111111111111111111111111111',
      keys: [{ pubkey: 'wallet1', isSigner: true, isWritable: true }],
      data: 'BAUG',
    },
  ]),
  buildUnstakeInstructions: vi.fn(async () => [
    {
      programId: 'MockStakeProgram111111111111111111111111111',
      keys: [{ pubkey: 'wallet1', isSigner: true, isWritable: true }],
      data: 'BwgJ',
    },
  ]),
};

const mockPriceFeedService: PriceFeedService = {
  getPrice: vi.fn(async () => ({
    symbol: 'SOL/USD',
    price: 145.23,
    confidence: 0.12,
    timestamp: 1700000000,
  })),
  getPrices: vi.fn(async () => []),
};

const createTestService = () => {
  const registry = createAdapterRegistry();
  registry.register(mockSwapAdapter);
  registry.register(mockStakeAdapter);
  return createDeFiService(registry, mockPriceFeedService, TX_ENGINE_URL);
};

describe('DeFiService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('gets a swap quote from the correct adapter', async () => {
    const service = createTestService();
    const quote = await service.getSwapQuote('mock-swap', {
      inputMint: 'SOL',
      outputMint: 'USDC',
      amount: '1000000000',
      walletAddress: 'wallet1',
    });

    expect(quote.outputAmount).toBe('23450000');
    expect(mockSwapAdapter.getSwapQuote).toHaveBeenCalledOnce();
  });

  it('throws ProtocolNotFoundError for unknown protocol', async () => {
    const service = createTestService();
    await expect(
      service.getSwapQuote('nonexistent', {
        inputMint: 'SOL',
        outputMint: 'USDC',
        amount: '1000',
        walletAddress: 'wallet1',
      }),
    ).rejects.toThrow('Protocol not found');
  });

  it('throws OperationNotSupportedError for unsupported operation', async () => {
    const service = createTestService();
    await expect(
      service.getSwapQuote('mock-stake', {
        inputMint: 'SOL',
        outputMint: 'USDC',
        amount: '1000',
        walletAddress: 'wallet1',
      }),
    ).rejects.toThrow('does not support');
  });

  it('executes swap by building instructions and submitting to tx engine', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: 'tx-123' } }), { status: 201 }),
    );

    const service = createTestService();
    const quote: SwapQuote = {
      inputMint: 'SOL',
      outputMint: 'USDC',
      inputAmount: '1000000000',
      outputAmount: '23450000',
      priceImpactPct: 0.1,
      fee: '5000',
      route: [],
    };

    const result = await service.executeSwap('wallet-uuid-1', 'mock-swap', {
      walletAddress: 'wallet1',
      quote,
    });

    expect(result.transactionId).toBe('tx-123');
    expect(fetchSpy).toHaveBeenCalledOnce();

    const [url, opts] = fetchSpy.mock.calls[0]!;
    expect(url).toBe(`${TX_ENGINE_URL}/api/v1/transactions`);
    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body.walletId).toBe('wallet-uuid-1');
    expect(body.type).toBe('swap');
    expect(body.instructions).toHaveLength(1);
  });

  it('executes stake flow', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: 'tx-stake-1' } }), { status: 201 }),
    );

    const service = createTestService();
    const result = await service.stake('wallet-uuid-1', 'mock-stake', {
      walletAddress: 'wallet1',
      amount: '2000000000',
    });

    expect(result.transactionId).toBe('tx-stake-1');
    expect(mockStakeAdapter.buildStakeInstructions).toHaveBeenCalledOnce();
  });

  it('executes unstake flow', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: 'tx-unstake-1' } }), { status: 201 }),
    );

    const service = createTestService();
    const result = await service.unstake('wallet-uuid-1', 'mock-stake', {
      walletAddress: 'wallet1',
      amount: '1000000000',
    });

    expect(result.transactionId).toBe('tx-unstake-1');
    expect(mockStakeAdapter.buildUnstakeInstructions).toHaveBeenCalledOnce();
  });

  it('delegates getPrice to price feed service', async () => {
    const service = createTestService();
    const price = await service.getPrice('So11111111111111111111111111111111111111112');

    expect(price.symbol).toBe('SOL/USD');
    expect(mockPriceFeedService.getPrice).toHaveBeenCalledWith('So11111111111111111111111111111111111111112');
  });

  it('lists protocols with capabilities', () => {
    const service = createTestService();
    const protocols = service.listProtocols();

    expect(protocols).toHaveLength(2);

    const swapProto = protocols.find((p) => p.name === 'mock-swap');
    expect(swapProto!.capabilities).toContain('swap');

    const stakeProto = protocols.find((p) => p.name === 'mock-stake');
    expect(stakeProto!.capabilities).toContain('stake');
    expect(stakeProto!.capabilities).toContain('unstake');
  });

  it('throws ExternalServiceError when transaction engine fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Connection refused', { status: 502 }),
    );

    const service = createTestService();
    await expect(
      service.executeSwap('wallet-uuid-1', 'mock-swap', {
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
    ).rejects.toThrow('transaction-engine');
  });
});
