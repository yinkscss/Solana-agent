import { z } from 'zod';

export interface WebhookConfig {
  id: string;
  orgId: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
  statusCode: number | null;
  response: string | null;
  attempts: number;
  deliveredAt: Date | null;
  createdAt: Date;
}

export interface NotificationEvent {
  type: string;
  orgId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface WSSubscription {
  orgId: string;
  events?: string[];
}

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertConfig {
  id: string;
  orgId: string;
  channel: 'slack' | 'pagerduty' | 'email';
  severity: AlertSeverity[];
  webhookUrl: string;
  isActive: boolean;
}

export const createWebhookSchema = z.object({
  orgId: z.string().min(1),
  url: z.string().url(),
  secret: z.string().min(16),
  events: z.array(z.string()).min(1),
});

export type CreateWebhookParams = z.infer<typeof createWebhookSchema>;

export const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  secret: z.string().min(16).optional(),
  events: z.array(z.string()).min(1).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateWebhookParams = z.infer<typeof updateWebhookSchema>;

export const createAlertSchema = z.object({
  orgId: z.string().min(1),
  channel: z.enum(['slack', 'pagerduty', 'email']),
  severity: z.array(z.enum(['info', 'warning', 'critical'])).min(1),
  webhookUrl: z.string().url(),
  isActive: z.boolean().default(true),
});

export type CreateAlertParams = z.infer<typeof createAlertSchema>;
