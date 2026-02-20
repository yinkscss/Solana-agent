import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AlertService } from '../src/services/alert.service.js';
import type { NotificationEvent } from '../src/types/index.js';

const makeEvent = (overrides: Partial<NotificationEvent> = {}): NotificationEvent => ({
  type: 'policy.violation',
  orgId: 'org-1',
  data: { policyId: 'p-1', reason: 'limit exceeded' },
  timestamp: new Date().toISOString(),
  ...overrides,
});

describe('AlertService', () => {
  let service: AlertService;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    service = new AlertService();
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('creates an alert config', async () => {
    const alert = await service.createAlert({
      orgId: 'org-1',
      channel: 'slack',
      severity: ['critical'],
      webhookUrl: 'https://hooks.slack.com/services/test',
      isActive: true,
    });

    expect(alert.id).toBeDefined();
    expect(alert.channel).toBe('slack');
  });

  it('lists alerts by org', async () => {
    await service.createAlert({
      orgId: 'org-1',
      channel: 'slack',
      severity: ['critical'],
      webhookUrl: 'https://hooks.slack.com/test',
      isActive: true,
    });
    await service.createAlert({
      orgId: 'org-2',
      channel: 'pagerduty',
      severity: ['warning'],
      webhookUrl: 'https://pd.example.com',
      isActive: true,
    });

    expect(await service.listAlerts('org-1')).toHaveLength(1);
    expect(await service.listAlerts('org-2')).toHaveLength(1);
  });

  it('routes critical event to Slack', async () => {
    await service.createAlert({
      orgId: 'org-1',
      channel: 'slack',
      severity: ['critical'],
      webhookUrl: 'https://hooks.slack.com/services/test',
      isActive: true,
    });

    await service.routeEvent(makeEvent(), 'critical');

    expect(globalThis.fetch).toHaveBeenCalledOnce();
    const [url, opts] = vi.mocked(globalThis.fetch).mock.calls[0]!;
    expect(url).toBe('https://hooks.slack.com/services/test');

    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body.blocks).toBeDefined();
    expect(body.blocks[0].text.text).toContain('CRITICAL');
  });

  it('routes event to PagerDuty', async () => {
    await service.createAlert({
      orgId: 'org-1',
      channel: 'pagerduty',
      severity: ['warning', 'critical'],
      webhookUrl: 'pd-routing-key-123',
      isActive: true,
    });

    await service.routeEvent(makeEvent(), 'warning');

    expect(globalThis.fetch).toHaveBeenCalledOnce();
    const [url, opts] = vi.mocked(globalThis.fetch).mock.calls[0]!;
    expect(url).toBe('https://events.pagerduty.com/v2/enqueue');

    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body.routing_key).toBe('pd-routing-key-123');
    expect(body.payload.severity).toBe('warning');
  });

  it('skips inactive alerts', async () => {
    await service.createAlert({
      orgId: 'org-1',
      channel: 'slack',
      severity: ['critical'],
      webhookUrl: 'https://hooks.slack.com/test',
      isActive: false,
    });

    await service.routeEvent(makeEvent(), 'critical');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('skips alerts for non-matching severity', async () => {
    await service.createAlert({
      orgId: 'org-1',
      channel: 'slack',
      severity: ['info'],
      webhookUrl: 'https://hooks.slack.com/test',
      isActive: true,
    });

    await service.routeEvent(makeEvent(), 'critical');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('skips alerts for different org', async () => {
    await service.createAlert({
      orgId: 'org-other',
      channel: 'slack',
      severity: ['critical'],
      webhookUrl: 'https://hooks.slack.com/test',
      isActive: true,
    });

    await service.routeEvent(makeEvent({ orgId: 'org-1' }), 'critical');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
