import { Hono } from 'hono';
import { z } from 'zod';
import type { TransactionController } from '../controllers/transaction.controller';
import { validateBody, validateQuery } from '../middleware/validation';

const createTransactionBodySchema = z.object({
  walletId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
  type: z.enum(['transfer', 'swap', 'stake', 'unstake', 'lend', 'borrow', 'nft', 'custom']),
  instructions: z.array(z.unknown()).optional(),
  destination: z.string().optional(),
  amount: z.string().optional(),
  tokenMint: z.string().optional(),
  gasless: z.boolean().optional(),
  urgency: z.enum(['low', 'medium', 'high']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.string().optional(),
  type: z.string().optional(),
});

export const createTransactionRoutes = (controller: TransactionController): Hono => {
  const router = new Hono();

  router.post('/', validateBody(createTransactionBodySchema), controller.create);
  router.get('/:txId', controller.getById);
  router.post('/:txId/retry', controller.retry);

  return router;
};

export const createWalletTransactionRoutes = (controller: TransactionController): Hono => {
  const router = new Hono();

  router.get('/:walletId/transactions', validateQuery(listQuerySchema), controller.getByWallet);

  return router;
};
