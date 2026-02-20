import type { AgentState } from '../types/index.js';

export interface StateManager {
  getState(agentId: string): Promise<AgentState>;
  saveState(state: AgentState): Promise<void>;
  clearState(agentId: string): Promise<void>;
}

export class InMemoryStateManager implements StateManager {
  private states = new Map<string, AgentState>();

  async getState(agentId: string): Promise<AgentState> {
    const existing = this.states.get(agentId);
    if (existing) return existing;

    const fresh: AgentState = {
      agentId,
      conversationHistory: [],
      metadata: {},
      lastActiveAt: new Date(),
    };
    this.states.set(agentId, fresh);
    return fresh;
  }

  async saveState(state: AgentState): Promise<void> {
    this.states.set(state.agentId, { ...state, lastActiveAt: new Date() });
  }

  async clearState(agentId: string): Promise<void> {
    this.states.delete(agentId);
  }
}
