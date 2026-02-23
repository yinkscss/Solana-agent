import type Redis from 'ioredis';
import type { StateManager } from '../services/state-manager.service.js';
import type { AgentState } from '../types/index.js';

const KEY_PREFIX = 'agent:state:';

export class RedisStateManager implements StateManager {
  constructor(private readonly redis: Redis) {}

  async getState(agentId: string): Promise<AgentState> {
    const raw = await this.redis.get(`${KEY_PREFIX}${agentId}`);
    if (!raw) {
      return {
        agentId,
        conversationHistory: [],
        metadata: {},
        lastActiveAt: new Date(),
      };
    }

    const parsed = JSON.parse(raw) as AgentState;
    parsed.lastActiveAt = new Date(parsed.lastActiveAt);
    for (const msg of parsed.conversationHistory) {
      msg.timestamp = new Date(msg.timestamp);
    }
    return parsed;
  }

  async saveState(state: AgentState): Promise<void> {
    const value = JSON.stringify({ ...state, lastActiveAt: new Date() });
    await this.redis.set(`${KEY_PREFIX}${state.agentId}`, value);
  }

  async clearState(agentId: string): Promise<void> {
    await this.redis.del(`${KEY_PREFIX}${agentId}`);
  }
}
