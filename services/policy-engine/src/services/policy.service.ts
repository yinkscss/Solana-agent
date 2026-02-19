import { eq } from 'drizzle-orm';
import type { Database } from '@solagent/db';
import { policies } from '@solagent/db';
import type { CacheService } from './cache.service.js';
import type { Policy, PolicyRule } from '../types/index.js';

const toPolicy = (row: typeof policies.$inferSelect): Policy => ({
  id: row.id,
  walletId: row.walletId,
  name: row.name,
  rules: (row.rules ?? []) as unknown as PolicyRule[],
  version: row.version,
  isActive: row.isActive,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export class PolicyService {
  constructor(
    private db: Database,
    private cache: CacheService,
  ) {}

  createPolicy = async (
    walletId: string,
    name: string,
    rules: PolicyRule[],
  ): Promise<Policy> => {
    const [row] = await this.db
      .insert(policies)
      .values({
        walletId,
        name,
        rules: rules as any,
        version: 1,
        isActive: true,
      })
      .returning();

    if (!row) throw new Error('Failed to create policy');

    await this.cache.invalidatePolicies(walletId);
    return toPolicy(row);
  };

  getPolicy = async (policyId: string): Promise<Policy | null> => {
    const [row] = await this.db
      .select()
      .from(policies)
      .where(eq(policies.id, policyId))
      .limit(1);

    return row ? toPolicy(row) : null;
  };

  getPoliciesForWallet = async (walletId: string): Promise<Policy[]> => {
    const rows = await this.db
      .select()
      .from(policies)
      .where(eq(policies.walletId, walletId));

    return rows.map(toPolicy);
  };

  getActivePoliciesForWallet = async (walletId: string): Promise<Policy[]> => {
    const cached = await this.cache.getActivePolicies(walletId);
    if (cached) return cached;

    const rows = await this.db
      .select()
      .from(policies)
      .where(eq(policies.walletId, walletId));

    const active = rows.filter((r) => r.isActive).map(toPolicy);
    await this.cache.cachePolicies(walletId, active);
    return active;
  };

  updatePolicy = async (
    policyId: string,
    updates: { name?: string; rules?: PolicyRule[] },
  ): Promise<Policy | null> => {
    const existing = await this.getPolicy(policyId);
    if (!existing) return null;

    const [row] = await this.db
      .update(policies)
      .set({
        ...(updates.name && { name: updates.name }),
        ...(updates.rules && { rules: updates.rules as any }),
        version: existing.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(policies.id, policyId))
      .returning();

    if (!row) return null;

    await this.cache.invalidatePolicies(row.walletId);
    return toPolicy(row);
  };

  deactivatePolicy = async (policyId: string): Promise<Policy | null> => {
    const [row] = await this.db
      .update(policies)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(policies.id, policyId))
      .returning();

    if (!row) return null;

    await this.cache.invalidatePolicies(row.walletId);
    return toPolicy(row);
  };

  activatePolicy = async (policyId: string): Promise<Policy | null> => {
    const [row] = await this.db
      .update(policies)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(policies.id, policyId))
      .returning();

    if (!row) return null;

    await this.cache.invalidatePolicies(row.walletId);
    return toPolicy(row);
  };
}
