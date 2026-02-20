import type {
  AlertConfig,
  AlertSeverity,
  CreateAlertParams,
  NotificationEvent,
} from '../types/index.js';

export class AlertService {
  private alerts = new Map<string, AlertConfig>();

  async createAlert(params: CreateAlertParams): Promise<AlertConfig> {
    const alert: AlertConfig = {
      id: crypto.randomUUID(),
      orgId: params.orgId,
      channel: params.channel,
      severity: params.severity,
      webhookUrl: params.webhookUrl,
      isActive: params.isActive ?? true,
    };

    this.alerts.set(alert.id, alert);
    return alert;
  }

  async listAlerts(orgId: string): Promise<AlertConfig[]> {
    return [...this.alerts.values()].filter((a) => a.orgId === orgId);
  }

  async routeEvent(event: NotificationEvent, severity: AlertSeverity): Promise<void> {
    const matching = [...this.alerts.values()].filter(
      (a) => a.orgId === event.orgId && a.isActive && a.severity.includes(severity),
    );

    await Promise.allSettled(matching.map((a) => this.sendAlert(a, event, severity)));
  }

  private async sendAlert(
    alert: AlertConfig,
    event: NotificationEvent,
    severity: AlertSeverity,
  ): Promise<void> {
    if (alert.channel === 'slack') {
      return this.sendSlack(alert, event, severity);
    }
    if (alert.channel === 'pagerduty') {
      return this.sendPagerDuty(alert, event, severity);
    }
  }

  private async sendSlack(
    alert: AlertConfig,
    event: NotificationEvent,
    severity: AlertSeverity,
  ): Promise<void> {
    const emoji = severity === 'critical' ? '🚨' : severity === 'warning' ? '⚠️' : 'ℹ️';

    await fetch(alert.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: `${emoji} ${severity.toUpperCase()}: ${event.type}` },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Org:* ${event.orgId}\n*Event:* ${event.type}\n*Time:* ${event.timestamp}`,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `\`\`\`${JSON.stringify(event.data, null, 2)}\`\`\``,
            },
          },
        ],
      }),
    });
  }

  private async sendPagerDuty(
    alert: AlertConfig,
    event: NotificationEvent,
    severity: AlertSeverity,
  ): Promise<void> {
    const pdSeverity = severity === 'critical' ? 'critical' : severity === 'warning' ? 'warning' : 'info';

    await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routing_key: alert.webhookUrl,
        event_action: 'trigger',
        payload: {
          summary: `[${severity.toUpperCase()}] ${event.type} — org ${event.orgId}`,
          severity: pdSeverity,
          source: 'solagent-notification',
          timestamp: event.timestamp,
          custom_details: event.data,
        },
      }),
    });
  }
}
