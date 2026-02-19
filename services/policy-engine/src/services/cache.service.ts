import type Redis from 'ioredis';
import type { Policy } from '../types/index.js';

const POLICY_TTL_SECONDS = 60;
const keyFor = (walletId: string) => `policy:${walletId}`;

const serializePolicies = (policies: Policy[]): string =>
  JSON.stringify(policies, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  );

const deserializePolicies = (raw: string): Policy[] => {
  const parsed = JSON.parse(raw) as Policy[];
  return parsed.map((p) => ({
    ...p,
    createdAt: new Date(p.createdAt),
    updatedAt: new Date(p.updatedAt),
    rules: p.rules.map(reviveBigInts),
  }));
};

const reviveBigInts = (rule: Record<string, unknown>): Policy['rules'][number] => {
  const bigintFields = ['maxPerTransaction', 'maxPerWindow', 'threshold'];
  const revived = { ...rule };
  for (const field of bigintFields) {
    if (field in revived && revived[field] != null) {
      revived[field] = BigInt(revived[field] as string);
    }
  }
  return revived as Policy['rules'][number];
};

export class CacheService {
  constructor(private redis: Redis) {}

  getActivePolicies = async (walletId: string): Promise<Policy[] | null> => {
    try {
      const cached = await this.redis.get(keyFor(walletId));
      if (!cached) return null;
      return deserializePolicies(cached);
    } catch (err) {
      console.error(`Cache read failed for wallet ${walletId}:`, err);
      return null;
    }
  };

  cachePolicies = async (walletId: string, policies: Policy[]): Promise<void> => {
    try {
      await this.redis.set(
        keyFor(walletId),
        serializePolicies(policies),
        'EX',
        POLICY_TTL_SECONDS,
      );
    } catch (err) {
      console.error(`Cache write failed for wallet ${walletId}:`, err);
    }
  };

  invalidatePolicies = async (walletId: string): Promise<void> => {
    try {
      await this.redis.del(keyFor(walletId));
    } catch (err) {
      console.error(`Cache invalidation failed for wallet ${walletId}:`, err);
    }
  };
}
