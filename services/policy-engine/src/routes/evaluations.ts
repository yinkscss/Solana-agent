import { Hono } from 'hono';
import type { EvaluationController } from '../controllers/evaluation.controller.js';
import { validateBody } from '../middleware/validation.js';
import { evaluateTransactionSchema } from '../types/index.js';

export const createEvaluationRoutes = (controller: EvaluationController) => {
  const router = new Hono();

  router.post('/', validateBody(evaluateTransactionSchema), controller.evaluateTransaction);

  return router;
};
