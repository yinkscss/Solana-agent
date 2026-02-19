import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import Redis from 'ioredis';
import type { Database } from '@solagent/db';
import { createEventClient, EventPublisher } from '@solagent/events';
import { PolicyController } from './controllers/policy.controller.js';
import { EvaluationController } from './controllers/evaluation.controller.js';
import { CacheService } from './services/cache.service.js';
import { PolicyService } from './services/policy.service.js';
import { EvaluatorService } from './services/evaluator.service.js';
import { createPolicyRoutes, createWalletPolicyRoutes } from './routes/policies.js';
import { createEvaluationRoutes } from './routes/evaluations.js';
import { errorHandler } from './middleware/error-handler.js';
import { env } from './config/env.js';

export type AppDeps = {
  db: Database;
  redis: Redis;
};

export const createApp = (deps: AppDeps) => {
  const app = new Hono();

  app.use('*', logger());
  app.use('*', cors());

  const eventClient = createEventClient({
    brokers: env.REDPANDA_BROKERS.split(','),
    clientId: 'policy-engine',
  });
  const eventPublisher = new EventPublisher(eventClient.producer);

  const cacheService = new CacheService(deps.redis);
  const policyService = new PolicyService(deps.db, cacheService);
  const evaluatorService = new EvaluatorService(policyService, deps.redis, eventPublisher);

  const policyController = new PolicyController(policyService);
  const evaluationController = new EvaluationController(evaluatorService);

  app.route('/api/v1/policies', createPolicyRoutes(policyController));
  app.route('/api/v1/wallets', createWalletPolicyRoutes(policyController));
  app.route('/api/v1/evaluate', createEvaluationRoutes(evaluationController));

  app.get('/health', (c) => c.json({ status: 'ok', service: 'policy-engine' }));

  app.onError(errorHandler);

  return app;
};
