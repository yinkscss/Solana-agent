import { Hono } from 'hono';
import type { PolicyController } from '../controllers/policy.controller.js';
import { validateBody } from '../middleware/validation.js';
import { createPolicySchema, updatePolicySchema } from '../types/index.js';

export const createPolicyRoutes = (controller: PolicyController) => {
  const router = new Hono();

  router.post('/', validateBody(createPolicySchema), controller.createPolicy);
  router.get('/:policyId', controller.getPolicy);
  router.put('/:policyId', validateBody(updatePolicySchema), controller.updatePolicy);
  router.delete('/:policyId', controller.deactivatePolicy);
  router.post('/:policyId/activate', controller.activatePolicy);

  return router;
};

export const createWalletPolicyRoutes = (controller: PolicyController) => {
  const router = new Hono();

  router.get('/:walletId/policies', controller.getPoliciesForWallet);

  return router;
};
