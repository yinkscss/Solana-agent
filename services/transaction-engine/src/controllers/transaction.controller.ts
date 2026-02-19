import type { Context } from 'hono';
import type { TransactionService } from '../services/transaction.service';
import type { CreateTransactionParams, TransactionListOptions } from '../types';

export const createTransactionController = (txService: TransactionService) => {
  const create = async (c: Context) => {
    const body = c.get('validatedBody') as CreateTransactionParams;
    const record = await txService.createAndExecuteTransaction(body);
    return c.json({ data: record }, 201);
  };

  const getById = async (c: Context) => {
    const txId = c.req.param('txId')!;
    const record = await txService.getTransaction(txId);
    return c.json({ data: record });
  };

  const getByWallet = async (c: Context) => {
    const walletId = c.req.param('walletId')!;
    const query = c.get('validatedQuery') as TransactionListOptions | undefined;
    const result = await txService.getTransactionsByWallet(walletId, {
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
      status: query?.status,
      type: query?.type,
    });
    return c.json({
      data: result.data,
      total: result.total,
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
      hasMore: result.total > (query?.page ?? 1) * (query?.pageSize ?? 20),
    });
  };

  const retry = async (c: Context) => {
    const txId = c.req.param('txId')!;
    const record = await txService.retryTransaction(txId);
    return c.json({ data: record });
  };

  return { create, getById, getByWallet, retry };
};

export type TransactionController = ReturnType<typeof createTransactionController>;
