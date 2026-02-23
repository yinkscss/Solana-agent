import { eq, and, count } from 'drizzle-orm';
import { createDb, transactions } from '@solagent/db';
import type { TransactionRepository } from '../services/transaction.service';
import type { TransactionRecord } from '../types';

type TxRow = typeof transactions.$inferSelect;

const mapToRecord = (row: TxRow): TransactionRecord => ({
  id: row.id,
  walletId: row.walletId,
  agentId: row.agentId,
  signature: row.signature,
  type: row.type,
  status: row.status,
  instructions: row.instructions,
  feeLamports: row.feeLamports,
  gasless: row.gasless,
  metadata: row.metadata ?? {},
  errorMessage: row.errorMessage,
  retryCount: row.retryCount,
  createdAt: row.createdAt,
  confirmedAt: row.confirmedAt,
});

export const createDrizzleTransactionRepo = (dbUrl?: string): TransactionRepository => {
  const db = createDb(dbUrl);

  return {
    insert: async (record) => {
      const [row] = await db
        .insert(transactions)
        .values({
          id: record.id,
          walletId: record.walletId,
          agentId: record.agentId,
          signature: record.signature,
          type: record.type as TxRow['type'],
          status: record.status as TxRow['status'],
          instructions: record.instructions,
          feeLamports: record.feeLamports,
          gasless: record.gasless,
          metadata: record.metadata,
          errorMessage: record.errorMessage,
          retryCount: record.retryCount,
        })
        .returning();
      return mapToRecord(row);
    },

    findById: async (id) => {
      const row = await db.query.transactions.findFirst({
        where: eq(transactions.id, id),
      });
      return row ? mapToRecord(row) : null;
    },

    findByWalletId: async (walletId, opts) => {
      const page = opts.page ?? 1;
      const pageSize = opts.pageSize ?? 20;

      const conditions = [eq(transactions.walletId, walletId)];
      if (opts.status) conditions.push(eq(transactions.status, opts.status as TxRow['status']));
      if (opts.type) conditions.push(eq(transactions.type, opts.type as TxRow['type']));
      const where = and(...conditions)!;

      const [rows, [{ value: total }]] = await Promise.all([
        db
          .select()
          .from(transactions)
          .where(where)
          .limit(pageSize)
          .offset((page - 1) * pageSize)
          .orderBy(transactions.createdAt),
        db.select({ value: count() }).from(transactions).where(where),
      ]);

      return { data: rows.map(mapToRecord), total };
    },

    updateStatus: async (id, status, patch) => {
      const set: Record<string, unknown> = {
        status: status as TxRow['status'],
      };
      if (patch?.signature !== undefined) set.signature = patch.signature;
      if (patch?.feeLamports !== undefined) set.feeLamports = patch.feeLamports;
      if (patch?.errorMessage !== undefined) set.errorMessage = patch.errorMessage;
      if (patch?.retryCount !== undefined) set.retryCount = patch.retryCount;
      if (patch?.metadata !== undefined) set.metadata = patch.metadata;
      if (patch?.confirmedAt !== undefined) set.confirmedAt = patch.confirmedAt;

      const [row] = await db
        .update(transactions)
        .set(set)
        .where(eq(transactions.id, id))
        .returning();
      return row ? mapToRecord(row) : null;
    },
  };
};
