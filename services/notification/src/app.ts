import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { WSHub } from './services/ws-hub.service.js';
import { WebhookService } from './services/webhook.service.js';
import { AlertService } from './services/alert.service.js';
import { EventConsumer } from './services/event-consumer.service.js';
import { Dispatcher } from './services/dispatcher.service.js';
import { WebhookController } from './controllers/webhook.controller.js';
import { createWebhookRoutes, createOrgWebhookRoutes, createAlertRoutes } from './routes/webhooks.js';
import { createWSRoute } from './routes/ws.js';
import { errorHandler } from './middleware/error-handler.js';
import { env } from './config/env.js';

export type AppContext = {
  wsHub: WSHub;
  webhookService: WebhookService;
  alertService: AlertService;
  eventConsumer: EventConsumer;
  dispatcher: Dispatcher;
};

export const createApp = () => {
  const app = new Hono();

  app.use('*', logger());
  app.use('*', cors());

  const wsHub = new WSHub();
  const webhookService = new WebhookService({
    retryCount: env.WEBHOOK_RETRY_COUNT,
    timeoutMs: env.WEBHOOK_TIMEOUT_MS,
  });
  const alertService = new AlertService();
  const eventConsumer = new EventConsumer();
  const dispatcher = new Dispatcher(wsHub, webhookService, alertService);

  eventConsumer.onEvent((event) => dispatcher.dispatch(event));

  const webhookController = new WebhookController(webhookService, alertService);

  app.route('/ws', createWSRoute(wsHub));
  app.route('/api/v1/webhooks', createWebhookRoutes(webhookController));
  app.route('/api/v1/orgs', createOrgWebhookRoutes(webhookController));
  app.route('/api/v1/alerts', createAlertRoutes(webhookController));

  app.get('/health', (c) => c.json({ status: 'ok', service: 'notification' }));

  app.onError(errorHandler);

  const context: AppContext = {
    wsHub,
    webhookService,
    alertService,
    eventConsumer,
    dispatcher,
  };

  return { app, context };
};
