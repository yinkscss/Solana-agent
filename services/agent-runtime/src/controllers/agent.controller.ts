import type { Context } from 'hono';
import type { AgentService } from '../services/agent.service.js';
import type { ExecutionService } from '../services/execution.service.js';
import type { CreateAgentParams } from '../types/index.js';
import { env } from '../config/env.js';

export const createAgentController = (
  agentService: AgentService,
  executionService: ExecutionService,
) => {
  const create = async (c: Context) => {
    const body = c.get('validatedBody') as CreateAgentParams;

    let { walletId } = body;

    if (walletId) {
      const agent = await agentService.createAgent({ ...body, walletId });
      return c.json({ data: agent }, 201);
    }

    const agent = await agentService.createAgent({ ...body, walletId: '' });

    try {
      const walletRes = await fetch(`${env.WALLET_ENGINE_URL}/api/v1/wallets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          label: `${body.name} Wallet`,
          network: 'devnet',
          provider: 'local',
        }),
      });

      if (walletRes.ok) {
        const walletJson = (await walletRes.json()) as { data?: { id: string }; id?: string };
        const wallet = walletJson.data ?? walletJson;
        walletId = wallet.id;
        const updated = await agentService.updateAgent(agent.id, { walletId });
        return c.json({ data: updated }, 201);
      }

      console.error('Wallet-engine responded with', walletRes.status);
    } catch (err) {
      console.error('Auto-wallet creation failed:', err);
    }

    return c.json({ data: agent }, 201);
  };

  const getById = async (c: Context) => {
    const { agentId } = c.req.param();
    const agent = await agentService.getAgent(agentId!);
    return c.json({ data: agent });
  };

  const listAll = async (c: Context) => {
    const page = Number(c.req.query('page') ?? '1');
    const pageSize = Number(c.req.query('pageSize') ?? '20');
    const result = await agentService.listAllAgents({ page, pageSize });
    return c.json(result.data);
  };

  const list = async (c: Context) => {
    const { orgId } = c.req.param();
    const page = Number(c.req.query('page') ?? '1');
    const pageSize = Number(c.req.query('pageSize') ?? '20');
    const result = await agentService.listAgents(orgId!, { page, pageSize });
    return c.json({ data: result.data, total: result.total });
  };

  const update = async (c: Context) => {
    const { agentId } = c.req.param();
    const body = await c.req.json();
    const agent = await agentService.updateAgent(agentId!, body);
    return c.json({ data: agent });
  };

  const start = async (c: Context) => {
    const { agentId } = c.req.param();
    const agent = await agentService.startAgent(agentId!);
    return c.json({ data: agent });
  };

  const pause = async (c: Context) => {
    const { agentId } = c.req.param();
    const agent = await agentService.pauseAgent(agentId!);
    return c.json({ data: agent });
  };

  const stop = async (c: Context) => {
    const { agentId } = c.req.param();
    const agent = await agentService.stopAgent(agentId!);
    return c.json({ data: agent });
  };

  const destroy = async (c: Context) => {
    const { agentId } = c.req.param();
    const agent = await agentService.destroyAgent(agentId!);
    return c.json({ data: agent });
  };

  const execute = async (c: Context) => {
    const { agentId } = c.req.param();
    const body = c.get('validatedBody') as {
      message: string;
      conversationId?: string;
      walletId?: string;
      metadata?: Record<string, unknown>;
    };
    const outputs = await executionService.executeAgent(agentId!, {
      message: body.message,
      conversationId: body.conversationId,
      walletId: body.walletId,
      metadata: body.metadata,
    });
    return c.json({ data: outputs });
  };

  return { create, getById, listAll, list, update, start, pause, stop, destroy, execute };
};

export type AgentController = ReturnType<typeof createAgentController>;
