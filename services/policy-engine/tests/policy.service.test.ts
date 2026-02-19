import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PolicyService } from '../src/services/policy.service.js';
import type { CacheService } from '../src/services/cache.service.js';
import type { PolicyRule } from '../src/types/index.js';

const mockRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'policy-1',
  walletId: 'wallet-1',
  name: 'Test',
  rules: [{ type: 'token_allowlist', allowedMints: ['SOL'] }],
  version: 1,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockDb = () => {
  const returning = vi.fn();
  const values = vi.fn().mockReturnValue({ returning });
  const where = vi.fn().mockReturnValue({ returning, limit: vi.fn().mockResolvedValue([mockRow()]) });
  const set = vi.fn().mockReturnValue({ where });
  const from = vi.fn().mockReturnValue({ where });

  return {
    insert: vi.fn().mockReturnValue({ values }),
    select: vi.fn().mockReturnValue({ from }),
    update: vi.fn().mockReturnValue({ set }),
    _returning: returning,
    _values: values,
    _where: where,
    _set: set,
    _from: from,
  };
};

const createMockCache = (): CacheService =>
  ({
    getActivePolicies: vi.fn().mockResolvedValue(null),
    cachePolicies: vi.fn().mockResolvedValue(undefined),
    invalidatePolicies: vi.fn().mockResolvedValue(undefined),
  }) as unknown as CacheService;

describe('PolicyService', () => {
  let service: PolicyService;
  let db: ReturnType<typeof createMockDb>;
  let cache: CacheService;

  beforeEach(() => {
    db = createMockDb();
    cache = createMockCache();
    service = new PolicyService(db as any, cache);
  });

  it('creates a policy and invalidates cache', async () => {
    const row = mockRow();
    db._returning.mockResolvedValue([row]);

    const rules: PolicyRule[] = [{ type: 'token_allowlist', allowedMints: ['SOL'] }];
    const result = await service.createPolicy('wallet-1', 'Test', rules);

    expect(result.id).toBe('policy-1');
    expect(result.name).toBe('Test');
    expect(db.insert).toHaveBeenCalled();
    expect(vi.mocked(cache.invalidatePolicies)).toHaveBeenCalledWith('wallet-1');
  });

  it('returns null when policy not found', async () => {
    db._from.mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    });

    const result = await service.getPolicy('nonexistent');

    expect(result).toBeNull();
  });

  it('updates a policy and increments version', async () => {
    db._from.mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([mockRow()]),
      }),
    });
    const updatedRow = mockRow({ version: 2, name: 'Updated' });
    db._returning.mockResolvedValue([updatedRow]);

    const result = await service.updatePolicy('policy-1', { name: 'Updated' });

    expect(result).not.toBeNull();
    expect(result!.version).toBe(2);
    expect(vi.mocked(cache.invalidatePolicies)).toHaveBeenCalled();
  });

  it('deactivates a policy and invalidates cache', async () => {
    const deactivated = mockRow({ isActive: false });
    db._returning.mockResolvedValue([deactivated]);

    const result = await service.deactivatePolicy('policy-1');

    expect(result).not.toBeNull();
    expect(result!.isActive).toBe(false);
    expect(vi.mocked(cache.invalidatePolicies)).toHaveBeenCalled();
  });

  it('activates a policy and invalidates cache', async () => {
    const activated = mockRow({ isActive: true });
    db._returning.mockResolvedValue([activated]);

    const result = await service.activatePolicy('policy-1');

    expect(result).not.toBeNull();
    expect(result!.isActive).toBe(true);
    expect(vi.mocked(cache.invalidatePolicies)).toHaveBeenCalled();
  });

  it('fetches active policies from cache first', async () => {
    const cached = [mockRow()];
    vi.mocked(cache.getActivePolicies).mockResolvedValue(cached as any);

    const result = await service.getActivePoliciesForWallet('wallet-1');

    expect(result).toEqual(cached);
    expect(db.select).not.toHaveBeenCalled();
  });
});
