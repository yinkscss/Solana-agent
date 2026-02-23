import { eq, count } from 'drizzle-orm';
import { createDb, wallets } from '@solagent/db';
import type { WalletRepository } from '../services/wallet.service';
import type { WalletRecord } from '../types';

type WalletRow = typeof wallets.$inferSelect;

const mapToRecord = (row: WalletRow): WalletRecord => ({
  id: row.id,
  agentId: row.agentId,
  publicKey: row.publicKey,
  provider: row.keyProvider,
  providerRef: row.keyProviderRef,
  label: row.label,
  network: row.network,
  status: row.status,
  createdAt: row.createdAt,
  updatedAt: row.createdAt,
});

export const createDrizzleWalletRepo = (dbUrl?: string): WalletRepository => {
  const db = createDb(dbUrl);

  return {
    insert: async (record) => {
      const [row] = await db
        .insert(wallets)
        .values({
          id: record.id,
          agentId: record.agentId,
          publicKey: record.publicKey,
          keyProvider: record.provider as WalletRow['keyProvider'],
          keyProviderRef: record.providerRef,
          network: record.network as WalletRow['network'],
          label: record.label,
          status: record.status as WalletRow['status'],
        })
        .returning();
      return mapToRecord(row);
    },

    findById: async (id) => {
      const row = await db.query.wallets.findFirst({
        where: eq(wallets.id, id),
      });
      return row ? mapToRecord(row) : null;
    },

    findByPublicKey: async (publicKey) => {
      const row = await db.query.wallets.findFirst({
        where: eq(wallets.publicKey, publicKey),
      });
      return row ? mapToRecord(row) : null;
    },

    findByAgentId: async (agentId) => {
      const rows = await db.query.wallets.findMany({
        where: eq(wallets.agentId, agentId),
      });
      return rows.map(mapToRecord);
    },

    findAll: async (opts) => {
      const page = opts.page ?? 1;
      const pageSize = opts.pageSize ?? 50;
      const [rows, [{ value: total }]] = await Promise.all([
        db
          .select()
          .from(wallets)
          .limit(pageSize)
          .offset((page - 1) * pageSize)
          .orderBy(wallets.createdAt),
        db.select({ value: count() }).from(wallets),
      ]);
      return { data: rows.map(mapToRecord), total };
    },

    updateStatus: async (id, status) => {
      const [row] = await db
        .update(wallets)
        .set({ status: status as WalletRow['status'] })
        .where(eq(wallets.id, id))
        .returning();
      return row ? mapToRecord(row) : null;
    },
  };
};
