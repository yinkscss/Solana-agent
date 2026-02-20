import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { WebhookService } from '../src/services/webhook.service.js';
import { AlertService } from '../src/services/alert.service.js';
import { WebhookController } from '../src/controllers/webhook.controller.js';
import {
  createWebhookRoutes,
  createOrgWebhookRoutes,
  createAlertRoutes,
} from '../src/routes/webhooks.js';

describe('Notification Routes', () => {
  let app: Hono;
  let webhookService: WebhookService;
  let alertService: AlertService;

  beforeEach(() => {
    webhookService = new WebhookService({ retryCount: 0, timeoutMs: 5000 });
    alertService = new AlertService();
    const controller = new WebhookController(webhookService, alertService);

    app = new Hono();
    app.route('/api/v1/webhooks', createWebhookRoutes(controller));
    app.route('/api/v1/orgs', createOrgWebhookRoutes(controller));
    app.route('/api/v1/alerts', createAlertRoutes(controller));
  });

  describe('POST /api/v1/webhooks', () => {
    it('creates a webhook', async () => {
      const res = await app.request('/api/v1/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: 'org-1',
          url: 'https://example.com/hook',
          secret: 'super-secret-key-1234',
          events: ['transaction.confirmed'],
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.orgId).toBe('org-1');
    });

    it('returns 400 on invalid body', async () => {
      const res = await app.request('/api/v1/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: 'org-1' }),
      });

      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid url', async () => {
      const res = await app.request('/api/v1/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: 'org-1',
          url: 'not-a-url',
          secret: 'super-secret-key-1234',
          events: ['a'],
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/webhooks/:webhookId', () => {
    it('returns a webhook', async () => {
      const created = await webhookService.createWebhook({
        orgId: 'org-1',
        url: 'https://example.com/hook',
        secret: 'super-secret-key-1234',
        events: ['a'],
      });

      const res = await app.request(`/api/v1/webhooks/${created.id}`);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.id).toBe(created.id);
    });

    it('returns 404 for missing webhook', async () => {
      const res = await app.request('/api/v1/webhooks/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/v1/webhooks/:webhookId', () => {
    it('updates a webhook', async () => {
      const created = await webhookService.createWebhook({
        orgId: 'org-1',
        url: 'https://example.com/hook',
        secret: 'super-secret-key-1234',
        events: ['a'],
      });

      const res = await app.request(`/api/v1/webhooks/${created.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://updated.com/hook' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.url).toBe('https://updated.com/hook');
    });

    it('returns 404 updating nonexistent webhook', async () => {
      const res = await app.request('/api/v1/webhooks/nope', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/webhooks/:webhookId', () => {
    it('deletes a webhook', async () => {
      const created = await webhookService.createWebhook({
        orgId: 'org-1',
        url: 'https://example.com/hook',
        secret: 'super-secret-key-1234',
        events: ['a'],
      });

      const res = await app.request(`/api/v1/webhooks/${created.id}`, {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
    });

    it('returns 404 deleting nonexistent webhook', async () => {
      const res = await app.request('/api/v1/webhooks/nope', { method: 'DELETE' });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/orgs/:orgId/webhooks', () => {
    it('lists webhooks for an org', async () => {
      await webhookService.createWebhook({
        orgId: 'org-1',
        url: 'https://example.com/hook',
        secret: 'super-secret-key-1234',
        events: ['a'],
      });

      const res = await app.request('/api/v1/orgs/org-1/webhooks');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toHaveLength(1);
    });
  });

  describe('POST /api/v1/alerts', () => {
    it('creates an alert', async () => {
      const res = await app.request('/api/v1/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: 'org-1',
          channel: 'slack',
          severity: ['critical'],
          webhookUrl: 'https://hooks.slack.com/services/test',
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.channel).toBe('slack');
    });

    it('returns 400 on invalid alert body', async () => {
      const res = await app.request('/api/v1/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: 'org-1' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/orgs/:orgId/alerts', () => {
    it('lists alerts for an org', async () => {
      await alertService.createAlert({
        orgId: 'org-1',
        channel: 'slack',
        severity: ['critical'],
        webhookUrl: 'https://hooks.slack.com/test',
        isActive: true,
      });

      const res = await app.request('/api/v1/orgs/org-1/alerts');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toHaveLength(1);
    });
  });
});
