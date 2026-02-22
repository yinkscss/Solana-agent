import type { NotificationEvent, AlertSeverity } from '../types/index.js';
import type { WSHub } from './ws-hub.service.js';
import type { WebhookService } from './webhook.service.js';
import type { AlertService } from './alert.service.js';
import type { AuditWriterService, AuditEntry } from './audit-writer.service.js';

const SEVERITY_MAP: Record<string, AlertSeverity> = {
  'policy.denied': 'warning',
  'policy.violation': 'critical',
  'transaction.failed': 'warning',
  'agent.error': 'critical',
  'wallet.drained': 'critical',
};

export class Dispatcher {
  private auditWriter: AuditWriterService | null;

  constructor(
    private wsHub: WSHub,
    private webhookService: WebhookService,
    private alertService: AlertService,
    auditWriter?: AuditWriterService,
  ) {
    this.auditWriter = auditWriter ?? null;
  }

  async dispatch(event: NotificationEvent): Promise<void> {
    const tasks: Promise<void>[] = [
      this.broadcastWS(event),
      this.deliverWebhooks(event),
      this.routeAlerts(event),
    ];

    if (this.auditWriter) {
      tasks.push(this.writeAudit(event));
    }

    await Promise.allSettled(tasks);
  }

  private async broadcastWS(event: NotificationEvent): Promise<void> {
    this.wsHub.broadcast(event);
  }

  private async deliverWebhooks(event: NotificationEvent): Promise<void> {
    await this.webhookService.deliverEvent(event);
  }

  private async routeAlerts(event: NotificationEvent): Promise<void> {
    const severity = this.resolveSeverity(event);
    if (!severity) return;

    await this.alertService.routeEvent(event, severity);
  }

  private resolveSeverity(event: NotificationEvent): AlertSeverity | null {
    if (SEVERITY_MAP[event.type]) return SEVERITY_MAP[event.type]!;

    const data = event.data as Record<string, unknown>;
    if (typeof data['severity'] === 'string') {
      const s = data['severity'] as string;
      if (s === 'info' || s === 'warning' || s === 'critical') return s;
    }

    return null;
  }

  private async writeAudit(event: NotificationEvent): Promise<void> {
    if (!this.auditWriter) return;

    const entry: AuditEntry = {
      id: crypto.randomUUID(),
      timestamp: event.timestamp,
      orgId: event.orgId,
      eventType: event.type,
      actor: (event.data['agentId'] as string) ?? (event.data['userId'] as string) ?? 'system',
      resource: (event.data['walletId'] as string) ?? (event.data['txId'] as string) ?? '',
      action: event.type,
      details: event.data,
    };

    await this.auditWriter.write(entry);
  }
}
