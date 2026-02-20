import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'crypto';
import { WebhookService } from '../src/services/webhook.service.js';
import type { NotificationEvent } from '../src/types/index.js';

const makeEvent = (overrides: Partial<NotificationEvent> = {}): NotificationEvent => ({
  type: 'transaction.confirmed',
  orgId: 'org-1',
  data: { txId: 'tx-123' },
  timestamp: new Date().toISOString(),
  ...overrides,
});

describe('WebhookService', () => {
  let service: WebhookService;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    service = new WebhookService({ retryCount: 2, timeoutMs: 5000 });
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('CRUD', () => {
    it('creates a webhook', async () => {
      const wh = await service.createWebhook({
        orgId: 'org-1',
        url: 'https://example.com/hook',
        secret: 'super-secret-key-1234',
        events: ['transaction.confirmed'],
      });

      expect(wh.id).toBeDefined();
      expect(wh.orgId).toBe('org-1');
      expect(wh.isActive).toBe(true);
    });

    it('gets a webhook by id', async () => {
      const created = await service.createWebhook({
        orgId: 'org-1',
        url: 'https://example.com/hook',
        secret: 'super-secret-key-1234',
        events: ['transaction.confirmed'],
      });

      const fetched = await service.getWebhook(created.id);
      expect(fetched?.id).toBe(created.id);
    });

    it('returns null for missing webhook', async () => {
      const result = await service.getWebhook('nonexistent');
      expect(result).toBeNull();
    });

    it('lists webhooks by org', async () => {
      await service.createWebhook({
        orgId: 'org-1',
        url: 'https://a.com/hook',
        secret: 'super-secret-key-1234',
        events: ['a'],
      });
      await service.createWebhook({
        orgId: 'org-2',
        url: 'https://b.com/hook',
        secret: 'super-secret-key-5678',
        events: ['b'],
      });

      expect(await service.listWebhooks('org-1')).toHaveLength(1);
      expect(await service.listWebhooks('org-2')).toHaveLength(1);
    });

    it('updates a webhook', async () => {
      const created = await service.createWebhook({
        orgId: 'org-1',
        url: 'https://example.com/hook',
        secret: 'super-secret-key-1234',
        events: ['transaction.confirmed'],
      });

      const updated = await service.updateWebhook(created.id, {
        url: 'https://updated.com/hook',
        isActive: false,
      });

      expect(updated?.url).toBe('https://updated.com/hook');
      expect(updated?.isActive).toBe(false);
    });

    it('returns null updating nonexistent webhook', async () => {
      const result = await service.updateWebhook('nope', { url: 'https://x.com' });
      expect(result).toBeNull();
    });

    it('deletes a webhook', async () => {
      const created = await service.createWebhook({
        orgId: 'org-1',
        url: 'https://example.com/hook',
        secret: 'super-secret-key-1234',
        events: ['a'],
      });

      expect(await service.deleteWebhook(created.id)).toBe(true);
      expect(await service.getWebhook(created.id)).toBeNull();
    });
  });

  describe('HMAC signing', () => {
    it('produces valid HMAC-SHA256 signature', () => {
      const payload = '{"test": true}';
      const secret = 'my-secret';
      const timestamp = 1700000000;

      const sig = service.signPayload(payload, secret, timestamp);
      const expected = createHmac('sha256', secret)
        .update(`${timestamp}.${payload}`)
        .digest('hex');

      expect(sig).toBe(expected);
    });
  });

  describe('delivery', () => {
    it('delivers event to matching webhook', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response('OK', { status: 200 }),
      );

      await service.createWebhook({
        orgId: 'org-1',
        url: 'https://example.com/hook',
        secret: 'super-secret-key-1234',
        events: ['transaction.confirmed'],
      });

      await service.deliverEvent(makeEvent());

      expect(globalThis.fetch).toHaveBeenCalledOnce();
      const [url, opts] = vi.mocked(globalThis.fetch).mock.calls[0]!;
      expect(url).toBe('https://example.com/hook');
      expect((opts as RequestInit).method).toBe('POST');

      const headers = (opts as RequestInit).headers as Record<string, string>;
      expect(headers['X-SolAgent-Signature']).toMatch(/^sha256=[0-9a-f]+$/);
      expect(headers['X-SolAgent-Timestamp']).toBeDefined();
    });

    it('skips inactive webhooks', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response('OK', { status: 200 }),
      );

      const wh = await service.createWebhook({
        orgId: 'org-1',
        url: 'https://example.com/hook',
        secret: 'super-secret-key-1234',
        events: ['transaction.confirmed'],
      });
      await service.updateWebhook(wh.id, { isActive: false });

      await service.deliverEvent(makeEvent());
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('skips webhooks not subscribed to event type', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response('OK', { status: 200 }),
      );

      await service.createWebhook({
        orgId: 'org-1',
        url: 'https://example.com/hook',
        secret: 'super-secret-key-1234',
        events: ['policy.denied'],
      });

      await service.deliverEvent(makeEvent({ type: 'transaction.confirmed' }));
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('retries on failure', async () => {
      vi.mocked(globalThis.fetch)
        .mockResolvedValueOnce(new Response('Error', { status: 500 }))
        .mockResolvedValueOnce(new Response('Error', { status: 500 }))
        .mockResolvedValueOnce(new Response('OK', { status: 200 }));

      const svc = new WebhookService({ retryCount: 2, timeoutMs: 5000 });

      await svc.createWebhook({
        orgId: 'org-1',
        url: 'https://example.com/hook',
        secret: 'super-secret-key-1234',
        events: ['transaction.confirmed'],
      });

      // Override backoff for test speed
      (svc as any).backoff = () => Promise.resolve();

      await svc.deliverEvent(makeEvent());

      expect(globalThis.fetch).toHaveBeenCalledTimes(3);

      const deliveries = svc.getDeliveries();
      expect(deliveries).toHaveLength(1);
      expect(deliveries[0]!.attempts).toBe(3);
      expect(deliveries[0]!.deliveredAt).not.toBeNull();
    });

    it('records failure after all retries exhausted', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue(
        new Response('Error', { status: 500 }),
      );

      const svc = new WebhookService({ retryCount: 1, timeoutMs: 5000 });

      await svc.createWebhook({
        orgId: 'org-1',
        url: 'https://example.com/hook',
        secret: 'super-secret-key-1234',
        events: ['transaction.confirmed'],
      });

      (svc as any).backoff = () => Promise.resolve();

      await svc.deliverEvent(makeEvent());

      const deliveries = svc.getDeliveries();
      expect(deliveries).toHaveLength(1);
      expect(deliveries[0]!.statusCode).toBe(500);
      expect(deliveries[0]!.deliveredAt).toBeNull();
    });
  });
});
