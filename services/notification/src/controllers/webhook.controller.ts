import type { Context } from 'hono';
import type { WebhookService } from '../services/webhook.service.js';
import type { AlertService } from '../services/alert.service.js';

export class WebhookController {
  constructor(
    private webhookService: WebhookService,
    private alertService: AlertService,
  ) {}

  createWebhook = async (c: Context) => {
    const body = c.get('validatedBody');
    const webhook = await this.webhookService.createWebhook(body);
    return c.json({ success: true, data: webhook }, 201);
  };

  getWebhook = async (c: Context) => {
    const webhookId = c.req.param('webhookId');
    const webhook = await this.webhookService.getWebhook(webhookId);

    if (!webhook) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Webhook not found' } },
        404,
      );
    }

    return c.json({ success: true, data: webhook });
  };

  listWebhooks = async (c: Context) => {
    const orgId = c.req.param('orgId');
    const webhooks = await this.webhookService.listWebhooks(orgId);
    return c.json({ success: true, data: webhooks });
  };

  updateWebhook = async (c: Context) => {
    const webhookId = c.req.param('webhookId');
    const body = c.get('validatedBody');
    const webhook = await this.webhookService.updateWebhook(webhookId, body);

    if (!webhook) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Webhook not found' } },
        404,
      );
    }

    return c.json({ success: true, data: webhook });
  };

  deleteWebhook = async (c: Context) => {
    const webhookId = c.req.param('webhookId');
    const deleted = await this.webhookService.deleteWebhook(webhookId);

    if (!deleted) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Webhook not found' } },
        404,
      );
    }

    return c.json({ success: true }, 200);
  };

  createAlert = async (c: Context) => {
    const body = c.get('validatedBody');
    const alert = await this.alertService.createAlert(body);
    return c.json({ success: true, data: alert }, 201);
  };

  listAlerts = async (c: Context) => {
    const orgId = c.req.param('orgId');
    const alerts = await this.alertService.listAlerts(orgId);
    return c.json({ success: true, data: alerts });
  };
}
