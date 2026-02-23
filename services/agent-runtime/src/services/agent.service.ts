import type { AgentStatus } from '@solagent/common';
import { AgentNotFoundError, SolAgentError } from '@solagent/common';
import { generateId } from '@solagent/common';
import type { AgentRecord, CreateAgentParams, ListOptions } from '../types/index.js';

export interface AgentRepository {
  insert(record: Omit<AgentRecord, 'createdAt' | 'updatedAt'>): Promise<AgentRecord>;
  findById(id: string): Promise<AgentRecord | null>;
  findAll(opts: ListOptions): Promise<{ data: AgentRecord[]; total: number }>;
  findByOrgId(orgId: string, opts: ListOptions): Promise<{ data: AgentRecord[]; total: number }>;
  updateStatus(id: string, status: AgentStatus): Promise<AgentRecord | null>;
  update(id: string, patch: Partial<AgentRecord>): Promise<AgentRecord | null>;
  delete(id: string): Promise<boolean>;
}

const VALID_TRANSITIONS: Record<AgentStatus, AgentStatus[]> = {
  created: ['running'],
  running: ['paused', 'stopped'],
  paused: ['running', 'stopped'],
  stopped: ['destroyed'],
  destroyed: [],
};

const assertTransition = (current: AgentStatus, next: AgentStatus): void => {
  const allowed = VALID_TRANSITIONS[current];
  if (!allowed?.includes(next)) {
    throw new SolAgentError(
      `Invalid status transition: ${current} → ${next}`,
      'INVALID_STATE_TRANSITION',
      409,
    );
  }
};

export const createAgentService = (repo: AgentRepository) => {
  const createAgent = async (params: CreateAgentParams): Promise<AgentRecord> =>
    repo.insert({
      id: generateId(),
      orgId: params.orgId,
      walletId: params.walletId ?? '',
      name: params.name,
      description: params.description,
      status: 'created',
      framework: params.framework,
      llmProvider: params.llmProvider,
      model: params.model,
      systemPrompt: params.systemPrompt,
      tools: params.tools,
      config: params.config ?? {},
    });

  const getAgent = async (agentId: string): Promise<AgentRecord> => {
    const record = await repo.findById(agentId);
    if (!record) throw new AgentNotFoundError(agentId);
    return record;
  };

  const listAllAgents = async (
    opts: ListOptions,
  ): Promise<{ data: AgentRecord[]; total: number }> => repo.findAll(opts);

  const listAgents = async (
    orgId: string,
    opts: ListOptions,
  ): Promise<{ data: AgentRecord[]; total: number }> => repo.findByOrgId(orgId, opts);

  const transitionStatus = async (agentId: string, target: AgentStatus): Promise<AgentRecord> => {
    const agent = await getAgent(agentId);
    assertTransition(agent.status, target);
    const updated = await repo.updateStatus(agentId, target);
    if (!updated) throw new AgentNotFoundError(agentId);
    return updated;
  };

  const startAgent = (agentId: string) => transitionStatus(agentId, 'running');
  const pauseAgent = (agentId: string) => transitionStatus(agentId, 'paused');
  const stopAgent = (agentId: string) => transitionStatus(agentId, 'stopped');
  const destroyAgent = (agentId: string) => transitionStatus(agentId, 'destroyed');

  const updateAgent = async (
    agentId: string,
    patch: Partial<AgentRecord>,
  ): Promise<AgentRecord> => {
    await getAgent(agentId);
    const updated = await repo.update(agentId, patch);
    if (!updated) throw new AgentNotFoundError(agentId);
    return updated;
  };

  return {
    createAgent,
    getAgent,
    listAllAgents,
    listAgents,
    startAgent,
    pauseAgent,
    stopAgent,
    destroyAgent,
    updateAgent,
  };
};

export type AgentService = ReturnType<typeof createAgentService>;
