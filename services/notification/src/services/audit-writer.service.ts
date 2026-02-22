import { appendFile, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

export interface AuditEntry {
  id: string;
  timestamp: string;
  orgId: string;
  eventType: string;
  actor: string;
  resource: string;
  action: string;
  details: Record<string, unknown>;
  ipAddress?: string;
}

export interface AuditQueryFilter {
  orgId?: string;
  eventType?: string;
  actor?: string;
  resource?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export interface AuditWriterService {
  write(entry: AuditEntry): Promise<void>;
  writeMany(entries: AuditEntry[]): Promise<void>;
  query(filter: AuditQueryFilter): Promise<AuditEntry[]>;
  flush(): Promise<void>;
  destroy(): void;
}

const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_THRESHOLD = 100;

export const createAuditWriterService = (logPath = 'audit.log'): AuditWriterService => {
  let buffer: AuditEntry[] = [];
  let flushTimer: ReturnType<typeof setInterval> | null = null;

  const flushBuffer = async (): Promise<void> => {
    if (buffer.length === 0) return;

    const entries = buffer;
    buffer = [];

    const lines = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
    await appendFile(logPath, lines, 'utf-8');
  };

  flushTimer = setInterval(() => {
    flushBuffer().catch(() => {});
  }, FLUSH_INTERVAL_MS);

  if (typeof flushTimer === 'object' && 'unref' in flushTimer) {
    (flushTimer as NodeJS.Timeout).unref();
  }

  const write = async (entry: AuditEntry): Promise<void> => {
    buffer.push(entry);
    if (buffer.length >= FLUSH_THRESHOLD) {
      await flushBuffer();
    }
  };

  const writeMany = async (entries: AuditEntry[]): Promise<void> => {
    buffer.push(...entries);
    if (buffer.length >= FLUSH_THRESHOLD) {
      await flushBuffer();
    }
  };

  const query = async (filter: AuditQueryFilter): Promise<AuditEntry[]> => {
    await flushBuffer();

    if (!existsSync(logPath)) return [];

    const raw = await readFile(logPath, 'utf-8');
    const lines = raw.trim().split('\n').filter(Boolean);

    let entries: AuditEntry[] = lines.map((line) => JSON.parse(line) as AuditEntry);

    if (filter.orgId) entries = entries.filter((e) => e.orgId === filter.orgId);
    if (filter.eventType) entries = entries.filter((e) => e.eventType === filter.eventType);
    if (filter.actor) entries = entries.filter((e) => e.actor === filter.actor);
    if (filter.resource) entries = entries.filter((e) => e.resource === filter.resource);
    if (filter.from) entries = entries.filter((e) => e.timestamp >= filter.from!);
    if (filter.to) entries = entries.filter((e) => e.timestamp <= filter.to!);
    if (filter.limit) entries = entries.slice(0, filter.limit);

    return entries;
  };

  const flush = async (): Promise<void> => {
    await flushBuffer();
  };

  const destroy = (): void => {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
  };

  return { write, writeMany, query, flush, destroy };
};
