import { createHmac } from 'crypto';
import type {
  WebhookConfig,
  WebhookDelivery,
  NotificationEvent,
  CreateWebhookParams,
  UpdateWebhookParams,
} from '../types/index.js';

export type WebhookServiceConfig = {
  retryCount: number;
  timeoutMs: number;
};

export class WebhookService {
  private webhooks = new Map<string, WebhookConfig>();
  private deliveries: WebhookDelivery[] = [];
  private config: WebhookServiceConfig;

  constructor(config: WebhookServiceConfig) {
    this.config = config;
  }

  async createWebhook(params: CreateWebhookParams): Promise<WebhookConfig> {
    const webhook: WebhookConfig = {
      id: crypto.randomUUID(),
      orgId: params.orgId,
      url: params.url,
      secret: params.secret,
      events: params.events,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.webhooks.set(webhook.id, webhook);
    return webhook;
  }

  async getWebhook(webhookId: string): Promise<WebhookConfig | null> {
    return this.webhooks.get(webhookId) ?? null;
  }

  async listWebhooks(orgId: string): Promise<WebhookConfig[]> {
    return [...this.webhooks.values()].filter((w) => w.orgId === orgId);
  }

  async updateWebhook(
    webhookId: string,
    params: UpdateWebhookParams,
  ): Promise<WebhookConfig | null> {
    const existing = this.webhooks.get(webhookId);
    if (!existing) return null;

    const updated: WebhookConfig = {
      ...existing,
      ...params,
      updatedAt: new Date(),
    };

    this.webhooks.set(webhookId, updated);
    return updated;
  }

  async deleteWebhook(webhookId: string): Promise<boolean> {
    return this.webhooks.delete(webhookId);
  }

  async deliverEvent(event: NotificationEvent): Promise<void> {
    const webhooks = [...this.webhooks.values()].filter(
      (w) => w.orgId === event.orgId && w.isActive && w.events.includes(event.type),
    );

    await Promise.allSettled(webhooks.map((w) => this.deliverToWebhook(w, event)));
  }

  signPayload(payload: string, secret: string, timestamp: number): string {
    const data = `${timestamp}.${payload}`;
    return createHmac('sha256', secret).update(data).digest('hex');
  }

  getDeliveries(): WebhookDelivery[] {
    return this.deliveries;
  }

  private async deliverToWebhook(
    webhook: WebhookConfig,
    event: NotificationEvent,
  ): Promise<void> {
    const body = JSON.stringify(event);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.signPayload(body, webhook.secret, timestamp);

    const delivery: WebhookDelivery = {
      id: crypto.randomUUID(),
      webhookId: webhook.id,
      event: event.type,
      payload: event.data,
      statusCode: null,
      response: null,
      attempts: 0,
      deliveredAt: null,
      createdAt: new Date(),
    };

    for (let attempt = 0; attempt <= this.config.retryCount; attempt++) {
      delivery.attempts = attempt + 1;

      try {
        const res = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-SolAgent-Signature': `sha256=${signature}`,
            'X-SolAgent-Timestamp': String(timestamp),
          },
          body,
          signal: AbortSignal.timeout(this.config.timeoutMs),
        });

        delivery.statusCode = res.status;
        delivery.response = await res.text();

        if (res.ok) {
          delivery.deliveredAt = new Date();
          break;
        }
      } catch (err) {
        delivery.response = err instanceof Error ? err.message : 'Unknown error';
      }

      if (attempt < this.config.retryCount) {
        await this.backoff(attempt);
      }
    }

    this.deliveries.push(delivery);
  }

  private backoff(attempt: number): Promise<void> {
    const ms = Math.min(1000 * 2 ** attempt, 30_000);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
