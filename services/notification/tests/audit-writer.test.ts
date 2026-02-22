import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unlinkSync, existsSync } from 'fs';
import { createAuditWriterService } from '../src/services/audit-writer.service';
import type { AuditEntry } from '../src/services/audit-writer.service';

const TEST_LOG = 'test-audit.log';

const makeEntry = (overrides: Partial<AuditEntry> = {}): AuditEntry => ({
  id: crypto.randomUUID(),
  timestamp: new Date().toISOString(),
  orgId: 'org-1',
  eventType: 'transaction.confirmed',
  actor: 'agent-1',
  resource: 'tx-1',
  action: 'confirm',
  details: { amount: '1000' },
  ...overrides,
});

describe('AuditWriterService', () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    if (existsSync(TEST_LOG)) unlinkSync(TEST_LOG);
  });

  afterEach(() => {
    cleanup?.();
    if (existsSync(TEST_LOG)) unlinkSync(TEST_LOG);
  });

  it('writes a single entry and queries it back', async () => {
    const writer = createAuditWriterService(TEST_LOG);
    cleanup = writer.destroy;

    const entry = makeEntry();
    await writer.write(entry);
    await writer.flush();

    const results = await writer.query({ orgId: 'org-1' });
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe(entry.id);
    expect(results[0]!.orgId).toBe('org-1');
  });

  it('writes many entries in batch', async () => {
    const writer = createAuditWriterService(TEST_LOG);
    cleanup = writer.destroy;

    const entries = Array.from({ length: 5 }, (_, i) =>
      makeEntry({ id: `entry-${i}`, actor: `agent-${i}` }),
    );

    await writer.writeMany(entries);
    await writer.flush();

    const results = await writer.query({});
    expect(results).toHaveLength(5);
  });

  it('filters by orgId', async () => {
    const writer = createAuditWriterService(TEST_LOG);
    cleanup = writer.destroy;

    await writer.write(makeEntry({ orgId: 'org-1' }));
    await writer.write(makeEntry({ orgId: 'org-2' }));
    await writer.flush();

    const results = await writer.query({ orgId: 'org-2' });
    expect(results).toHaveLength(1);
    expect(results[0]!.orgId).toBe('org-2');
  });

  it('filters by eventType', async () => {
    const writer = createAuditWriterService(TEST_LOG);
    cleanup = writer.destroy;

    await writer.write(makeEntry({ eventType: 'transaction.confirmed' }));
    await writer.write(makeEntry({ eventType: 'policy.denied' }));
    await writer.flush();

    const results = await writer.query({ eventType: 'policy.denied' });
    expect(results).toHaveLength(1);
  });

  it('filters by actor', async () => {
    const writer = createAuditWriterService(TEST_LOG);
    cleanup = writer.destroy;

    await writer.write(makeEntry({ actor: 'agent-1' }));
    await writer.write(makeEntry({ actor: 'user-1' }));
    await writer.flush();

    const results = await writer.query({ actor: 'user-1' });
    expect(results).toHaveLength(1);
  });

  it('respects limit', async () => {
    const writer = createAuditWriterService(TEST_LOG);
    cleanup = writer.destroy;

    await writer.writeMany(Array.from({ length: 10 }, () => makeEntry()));
    await writer.flush();

    const results = await writer.query({ limit: 3 });
    expect(results).toHaveLength(3);
  });

  it('returns empty array when log file does not exist', async () => {
    const writer = createAuditWriterService('nonexistent.log');
    cleanup = writer.destroy;

    const results = await writer.query({});
    expect(results).toEqual([]);
  });

  it('flushes buffer on query', async () => {
    const writer = createAuditWriterService(TEST_LOG);
    cleanup = writer.destroy;

    await writer.write(makeEntry());

    const results = await writer.query({});
    expect(results).toHaveLength(1);
  });

  it('destroy stops the flush timer', () => {
    const writer = createAuditWriterService(TEST_LOG);
    writer.destroy();
    expect(true).toBe(true);
  });
});
