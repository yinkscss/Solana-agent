import type Redis from 'ioredis';
import { ExternalServiceError } from '../types';

export interface PriceFeed {
  symbol: string;
  price: number;
  confidence: number;
  timestamp: number;
}

export interface PriceFeedService {
  getPrice(mint: string): Promise<PriceFeed>;
  getPrices(mints: string[]): Promise<PriceFeed[]>;
}

const MINT_TO_PYTH_ID: Record<string, { id: string; symbol: string }> = {
  So11111111111111111111111111111111111111112: {
    id: 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
    symbol: 'SOL/USD',
  },
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
    id: 'eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
    symbol: 'USDC/USD',
  },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: {
    id: '2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
    symbol: 'USDT/USD',
  },
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: {
    id: 'c2289a6a43d2ce91c6f55caec370f4acc38a2ed477f58813334c6d03749ff2a4',
    symbol: 'MSOL/USD',
  },
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': {
    id: 'd6b3bc030a346f28a15e8e1d0a0e62c5b4d2e3f35a0e5b6c1e6d8c7b8a9f0e1',
    symbol: 'ETH/USD',
  },
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: {
    id: 'dcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c',
    symbol: 'BONK/USD',
  },
};

const CACHE_PREFIX = 'pyth:price:';
const CACHE_TTL_SECONDS = 5;

interface PythPriceUpdate {
  parsed: Array<{
    id: string;
    price: {
      price: string;
      conf: string;
      expo: number;
      publish_time: number;
    };
  }>;
}

export const createPriceFeedService = (pythApiUrl: string, redis: Redis): PriceFeedService => {
  const fetchFromPyth = async (feedIds: string[]): Promise<Map<string, PriceFeed>> => {
    const url = new URL('/updates/price/latest', pythApiUrl);
    for (const id of feedIds) {
      url.searchParams.append('ids[]', id);
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new ExternalServiceError('Pyth', `Price fetch failed: ${await res.text().catch(() => 'Unknown')}`);
    }

    const data = (await res.json()) as PythPriceUpdate;
    const results = new Map<string, PriceFeed>();

    for (const entry of data.parsed) {
      const mapping = Object.entries(MINT_TO_PYTH_ID).find(([, v]) => v.id === entry.id);
      if (!mapping) continue;

      const [mint, { symbol }] = mapping;
      const expo = entry.price.expo;
      const price = Number(entry.price.price) * Math.pow(10, expo);
      const confidence = Number(entry.price.conf) * Math.pow(10, expo);

      const feed: PriceFeed = {
        symbol,
        price,
        confidence,
        timestamp: entry.price.publish_time,
      };

      results.set(mint, feed);
    }

    return results;
  };

  const getCached = async (mint: string): Promise<PriceFeed | null> => {
    const cached = await redis.get(`${CACHE_PREFIX}${mint}`);
    if (!cached) return null;
    return JSON.parse(cached) as PriceFeed;
  };

  const setCached = async (mint: string, feed: PriceFeed): Promise<void> => {
    await redis.set(`${CACHE_PREFIX}${mint}`, JSON.stringify(feed), 'EX', CACHE_TTL_SECONDS);
  };

  return {
    async getPrice(mint: string): Promise<PriceFeed> {
      const cached = await getCached(mint);
      if (cached) return cached;

      const mapping = MINT_TO_PYTH_ID[mint];
      if (!mapping) {
        throw new ExternalServiceError('Pyth', `No price feed for mint: ${mint}`);
      }

      const results = await fetchFromPyth([mapping.id]);
      const feed = results.get(mint);
      if (!feed) {
        throw new ExternalServiceError('Pyth', `No price returned for mint: ${mint}`);
      }

      await setCached(mint, feed);
      return feed;
    },

    async getPrices(mints: string[]): Promise<PriceFeed[]> {
      const results: PriceFeed[] = [];
      const uncached: string[] = [];

      for (const mint of mints) {
        const cached = await getCached(mint);
        if (cached) {
          results.push(cached);
        } else {
          uncached.push(mint);
        }
      }

      if (uncached.length === 0) return results;

      const feedIds = uncached
        .map((mint) => MINT_TO_PYTH_ID[mint]?.id)
        .filter((id): id is string => !!id);

      if (feedIds.length === 0) return results;

      const fetched = await fetchFromPyth(feedIds);
      for (const mint of uncached) {
        const feed = fetched.get(mint);
        if (feed) {
          await setCached(mint, feed);
          results.push(feed);
        }
      }

      return results;
    },
  };
};
