import { Hono } from 'hono';
import type { WalletController } from '../controllers/wallet.controller';
import { validateBody } from '../middleware/validation';
import { createWalletBodySchema, signTransactionBodySchema } from '../types';

export const createWalletRoutes = (controller: WalletController): Hono => {
  const router = new Hono();

  router.post('/', validateBody(createWalletBodySchema), controller.create);
  router.get('/:walletId', controller.getById);
  router.get('/:walletId/balance', controller.getBalance);
  router.get('/:walletId/tokens', controller.getTokenBalances);
  router.delete('/:walletId', controller.deactivate);
  router.post('/:walletId/recover', controller.recover);
  router.post('/:walletId/sign', validateBody(signTransactionBodySchema), controller.sign);

  return router;
};

export const createAgentWalletRoutes = (controller: WalletController): Hono => {
  const router = new Hono();
  router.get('/:agentId/wallets', controller.getByAgent);
  return router;
};
