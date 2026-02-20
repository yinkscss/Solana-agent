import { Hono } from 'hono';
import type { WebhookController } from '../controllers/webhook.controller.js';
import { validateBody } from '../middleware/validation.js';
import { createWebhookSchema, updateWebhookSchema, createAlertSchema } from '../types/index.js';

export const createWebhookRoutes = (controller: WebhookController) => {
  const router = new Hono();

  router.post('/', validateBody(createWebhookSchema), controller.createWebhook);
  router.get('/:webhookId', controller.getWebhook);
  router.put('/:webhookId', validateBody(updateWebhookSchema), controller.updateWebhook);
  router.delete('/:webhookId', controller.deleteWebhook);

  return router;
};

export const createOrgWebhookRoutes = (controller: WebhookController) => {
  const router = new Hono();

  router.get('/:orgId/webhooks', controller.listWebhooks);
  router.get('/:orgId/alerts', controller.listAlerts);

  return router;
};

export const createAlertRoutes = (controller: WebhookController) => {
  const router = new Hono();

  router.post('/', validateBody(createAlertSchema), controller.createAlert);

  return router;
};
