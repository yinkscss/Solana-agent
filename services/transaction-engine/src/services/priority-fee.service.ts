import { Connection } from '@solana/web3.js';
import type Redis from 'ioredis';
import type { Urgency } from '../types';

const FEE_CACHE_KEY = 'tx-engine:priority-fees';
const FEE_CACHE_TTL_MS = 2000;

const URGENCY_PERCENTILE: Record<Urgency, number> = {
  low: 25,
  medium: 50,
  high: 75,
};

export interface PriorityFeeService {
  calculatePriorityFee: (programIds: string[], urgency: Urgency) => Promise<number>;
}

export const createPriorityFeeService = (
  connection: Connection,
  redis: Redis,
): PriorityFeeService => {
  const fetchRecentFees = async (): Promise<number[]> => {
    const cached = await redis.get(FEE_CACHE_KEY);
    if (cached) return JSON.parse(cached) as number[];

    const fees = await connection.getRecentPrioritizationFees();
    const sorted = fees
      .map((f) => f.prioritizationFee)
      .sort((a, b) => a - b);

    if (sorted.length > 0) {
      await redis.set(FEE_CACHE_KEY, JSON.stringify(sorted), 'PX', FEE_CACHE_TTL_MS);
    }

    return sorted;
  };

  const percentile = (sorted: number[], p: number): number => {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)] ?? 0;
  };

  const calculatePriorityFee = async (
    _programIds: string[],
    urgency: Urgency,
  ): Promise<number> => {
    const fees = await fetchRecentFees();
    return percentile(fees, URGENCY_PERCENTILE[urgency]);
  };

  return { calculatePriorityFee };
};
