import type { HttpClient } from "../http/http-client.js";
import type { Agent, CreateAgentParams, AgentExecution } from "../types/index.js";

export class AgentModule {
  constructor(private readonly http: HttpClient) {}

  create = (params: CreateAgentParams): Promise<Agent> =>
    this.http.post<Agent>("/api/v1/agents", params);

  get = (agentId: string): Promise<Agent> =>
    this.http.get<Agent>(`/api/v1/agents/${agentId}`);

  list = (orgId: string): Promise<Agent[]> =>
    this.http.get<Agent[]>(`/api/v1/orgs/${orgId}/agents`);

  update = (agentId: string, params: Partial<CreateAgentParams>): Promise<Agent> =>
    this.http.put<Agent>(`/api/v1/agents/${agentId}`, params);

  start = (agentId: string): Promise<Agent> =>
    this.http.post<Agent>(`/api/v1/agents/${agentId}/start`, {});

  pause = (agentId: string): Promise<Agent> =>
    this.http.post<Agent>(`/api/v1/agents/${agentId}/pause`, {});

  stop = (agentId: string): Promise<Agent> =>
    this.http.post<Agent>(`/api/v1/agents/${agentId}/stop`, {});

  destroy = (agentId: string): Promise<Agent> =>
    this.http.delete<Agent>(`/api/v1/agents/${agentId}`);

  execute = (agentId: string, message: string, conversationId?: string): Promise<AgentExecution> =>
    this.http.post<AgentExecution>(`/api/v1/agents/${agentId}/execute`, {
      message,
      conversationId,
    });
}
