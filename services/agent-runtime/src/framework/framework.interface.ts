import type { AgentConfig, AgentInput, AgentOutput, AgentState, AgentFrameworkType } from '../types/index.js';
import type { LLMProvider } from '../llm/provider.interface.js';
import type { Tool } from '../tools/tool.interface.js';

export interface AgentFramework {
  readonly name: AgentFrameworkType;
  initialize(config: AgentConfig, provider: LLMProvider, tools: Tool[]): Promise<void>;
  execute(input: AgentInput, state: AgentState): AsyncGenerator<AgentOutput>;
  getState(): AgentState;
  pause(): Promise<void>;
  resume(): Promise<void>;
  destroy(): Promise<void>;
}
