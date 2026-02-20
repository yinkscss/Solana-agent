import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Dispatcher } from '../src/services/dispatcher.service.js';
import { WSHub } from '../src/services/ws-hub.service.js';
import { WebhookService } from '../src/services/webhook.service.js';
import { AlertService } from '../src/services/alert.service.js';
import type { NotificationEvent } from '../src/types/index.js';

const makeEvent = (overrides: Partial<NotificationEvent> = {}): NotificationEvent => ({
  type: 'transaction.confirmed',
  orgId: 'org-1',
  data: { txId: 'tx-1' },
  timestamp: new Date().toISOString(),
  ...overrides,
});

describe('Dispatcher', () => {
  let wsHub: WSHub;
  let webhookService: WebhookService;
  let alertService: AlertService;
  let dispatcher: Dispatcher;

  beforeEach(() => {
    wsHub = new WSHub();
    webhookService = new WebhookService({ retryCount: 0, timeoutMs: 5000 });
    alertService = new AlertService();
    dispatcher = new Dispatcher(wsHub, webhookService, alertService);
  });

  it('fans out to WebSocket hub', async () => {
    const broadcastSpy = vi.spyOn(wsHub, 'broadcast');

    await dispatcher.dispatch(makeEvent());

    expect(broadcastSpy).toHaveBeenCalledOnce();
  });

  it('fans out to webhook service', async () => {
    const deliverSpy = vi.spyOn(webhookService, 'deliverEvent').mockResolvedValue();

    await dispatcher.dispatch(makeEvent());

    expect(deliverSpy).toHaveBeenCalledOnce();
  });

  it('routes alerts for known severity events', async () => {
    const routeSpy = vi.spyOn(alertService, 'routeEvent').mockResolvedValue();

    await dispatcher.dispatch(makeEvent({ type: 'policy.denied' }));

    expect(routeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'policy.denied' }),
      'warning',
    );
  });

  it('routes alerts for critical events', async () => {
    const routeSpy = vi.spyOn(alertService, 'routeEvent').mockResolvedValue();

    await dispatcher.dispatch(makeEvent({ type: 'policy.violation' }));

    expect(routeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'policy.violation' }),
      'critical',
    );
  });

  it('skips alert routing for unmapped events', async () => {
    const routeSpy = vi.spyOn(alertService, 'routeEvent').mockResolvedValue();

    await dispatcher.dispatch(makeEvent({ type: 'transaction.confirmed' }));

    expect(routeSpy).not.toHaveBeenCalled();
  });

  it('uses severity from event data when not in static map', async () => {
    const routeSpy = vi.spyOn(alertService, 'routeEvent').mockResolvedValue();

    await dispatcher.dispatch(
      makeEvent({
        type: 'custom.event',
        data: { severity: 'warning' },
      }),
    );

    expect(routeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'custom.event' }),
      'warning',
    );
  });

  it('isolates channel failures', async () => {
    vi.spyOn(webhookService, 'deliverEvent').mockRejectedValue(new Error('webhook down'));
    const broadcastSpy = vi.spyOn(wsHub, 'broadcast');

    await dispatcher.dispatch(makeEvent());

    expect(broadcastSpy).toHaveBeenCalledOnce();
  });

  it('runs all channels in parallel', async () => {
    const order: string[] = [];

    vi.spyOn(wsHub, 'broadcast').mockImplementation(() => {
      order.push('ws');
    });
    vi.spyOn(webhookService, 'deliverEvent').mockImplementation(async () => {
      order.push('webhook');
    });
    vi.spyOn(alertService, 'routeEvent').mockImplementation(async () => {
      order.push('alert');
    });

    await dispatcher.dispatch(makeEvent({ type: 'policy.denied' }));

    expect(order).toContain('ws');
    expect(order).toContain('webhook');
    expect(order).toContain('alert');
  });
});
