import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPriceFeedService } from '../src/services/price-feed.service';

const PYTH_URL = 'https://hermes.pyth.network/v2';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const mockPythResponse = {
  parsed: [
    {
      id: 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
      price: {
        price: '14523000000',
        conf: '12000000',
        expo: -8,
        publish_time: 1700000000,
      },
    },
  ],
};

const createMockRedis = () => {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, _ex: string, _ttl: number) => {
      store.set(key, value);
      return 'OK';
    }),
    _store: store,
  };
};

describe('PriceFeedService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches price from Pyth when cache is empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockPythResponse), { status: 200 }),
    );

    const redis = createMockRedis();
    const service = createPriceFeedService(PYTH_URL, redis as never);
    const price = await service.getPrice(SOL_MINT);

    expect(price.symbol).toBe('SOL/USD');
    expect(price.price).toBeCloseTo(145.23, 2);
    expect(price.timestamp).toBe(1700000000);

    expect(redis.set).toHaveBeenCalledOnce();
    expect(redis.get).toHaveBeenCalledOnce();
  });

  it('returns cached price on cache hit', async () => {
    const cachedFeed = {
      symbol: 'SOL/USD',
      price: 145.23,
      confidence: 0.12,
      timestamp: 1700000000,
    };

    const redis = createMockRedis();
    redis._store.set(`pyth:price:${SOL_MINT}`, JSON.stringify(cachedFeed));

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const service = createPriceFeedService(PYTH_URL, redis as never);
    const price = await service.getPrice(SOL_MINT);

    expect(price.symbol).toBe('SOL/USD');
    expect(price.price).toBe(145.23);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('throws for unknown mint', async () => {
    const redis = createMockRedis();
    const service = createPriceFeedService(PYTH_URL, redis as never);

    await expect(service.getPrice('unknown_mint')).rejects.toThrow('No price feed for mint');
  });

  it('fetches multiple prices batching uncached ones', async () => {
    const multiResponse = {
      parsed: [
        {
          id: 'eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
          price: { price: '100000000', conf: '50000', expo: -8, publish_time: 1700000001 },
        },
      ],
    };

    const redis = createMockRedis();
    const cachedSol = { symbol: 'SOL/USD', price: 145.23, confidence: 0.12, timestamp: 1700000000 };
    redis._store.set(`pyth:price:${SOL_MINT}`, JSON.stringify(cachedSol));

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(multiResponse), { status: 200 }),
    );

    const service = createPriceFeedService(PYTH_URL, redis as never);
    const prices = await service.getPrices([SOL_MINT, USDC_MINT]);

    expect(prices).toHaveLength(2);
    expect(prices.find((p) => p.symbol === 'SOL/USD')).toBeTruthy();
    expect(prices.find((p) => p.symbol === 'USDC/USD')).toBeTruthy();
  });

  it('throws on Pyth API failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Service Error', { status: 500 }),
    );

    const redis = createMockRedis();
    const service = createPriceFeedService(PYTH_URL, redis as never);

    await expect(service.getPrice(SOL_MINT)).rejects.toThrow('Pyth');
  });
});
