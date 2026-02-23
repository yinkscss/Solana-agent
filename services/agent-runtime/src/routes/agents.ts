import { Hono } from 'hono';
import { z } from 'zod';
import type { AgentController } from '../controllers/agent.controller.js';
import { validateBody } from '../middleware/validation.js';

const createAgentBodySchema = z.object({
  orgId: z.string().min(1),
  walletId: z.string().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(''),
  framework: z.enum(['solagent', 'vercel-ai', 'eliza']).default('solagent'),
  llmProvider: z.enum(['openai', 'anthropic']).default('openai'),
  model: z.string().min(1).default('gpt-4o'),
  systemPrompt: z.string().min(1),
  tools: z.array(z.string()).default([]),
  config: z.record(z.unknown()).optional(),
});

const executeBodySchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(),
  walletId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createAgentRoutes = (controller: AgentController): Hono => {
  const router = new Hono();

  router.get('/', controller.listAll);
  router.post('/', validateBody(createAgentBodySchema), controller.create);
  router.get('/:agentId', controller.getById);
  router.put('/:agentId', controller.update);
  router.post('/:agentId/start', controller.start);
  router.post('/:agentId/pause', controller.pause);
  router.post('/:agentId/stop', controller.stop);
  router.delete('/:agentId', controller.destroy);
  router.post('/:agentId/execute', validateBody(executeBodySchema), controller.execute);

  return router;
};

export const createOrgAgentRoutes = (controller: AgentController): Hono => {
  const router = new Hono();
  router.get('/:orgId/agents', controller.list);
  return router;
};
