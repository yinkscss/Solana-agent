import { Hono } from 'hono';
import { z } from 'zod';
import type { DeFiController } from '../controllers/defi.controller';
import { validateBody, validateQuery } from '../middleware/validation';

const quoteQuerySchema = z.object({
  protocol: z.string().min(1),
  inputMint: z.string().min(1),
  outputMint: z.string().min(1),
  amount: z.string().min(1),
  slippage: z.string().optional(),
  walletAddress: z.string().min(1),
});

const swapBodySchema = z.object({
  walletId: z.string().uuid(),
  protocol: z.string().min(1),
  walletAddress: z.string().min(1),
  quote: z.object({
    inputMint: z.string(),
    outputMint: z.string(),
    inputAmount: z.string(),
    outputAmount: z.string(),
    priceImpactPct: z.number(),
    fee: z.string(),
    route: z.unknown(),
  }),
});

const stakeBodySchema = z.object({
  walletId: z.string().uuid(),
  protocol: z.string().min(1),
  walletAddress: z.string().min(1),
  amount: z.string().min(1),
  validator: z.string().optional(),
});

const unstakeBodySchema = z.object({
  walletId: z.string().uuid(),
  protocol: z.string().min(1),
  walletAddress: z.string().min(1),
  amount: z.string().min(1),
});

export const createDeFiRoutes = (controller: DeFiController): Hono => {
  const router = new Hono();

  router.get('/quote', validateQuery(quoteQuerySchema), controller.getSwapQuote);
  router.post('/swap', validateBody(swapBodySchema), controller.executeSwap);
  router.post('/stake', validateBody(stakeBodySchema), controller.stake);
  router.post('/unstake', validateBody(unstakeBodySchema), controller.unstake);
  router.get('/price/:mint', controller.getPrice);
  router.get('/protocols', controller.listProtocols);
  router.get('/pools/:protocol/:poolId', controller.getPoolInfo);

  return router;
};
