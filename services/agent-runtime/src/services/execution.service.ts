import { SolAgentError } from '@solagent/common';
import type { AgentInput, AgentOutput, AgentConfig } from '../types/index.js';
import type { AgentService } from './agent.service.js';
import type { StateManager } from './state-manager.service.js';
import type { LLMProvider as ILLMProvider } from '../llm/provider.interface.js';
import type { Tool } from '../tools/tool.interface.js';
import type { AgentFramework } from '../framework/framework.interface.js';
import { SolAgentAdapter } from '../framework/langchain.adapter.js';
import { VercelAIAdapter } from '../framework/vercel-ai.adapter.js';
import { OpenAIProvider } from '../llm/openai.provider.js';
import { AnthropicProvider } from '../llm/anthropic.provider.js';
import type { ToolRegistry } from '../tools/tool-registry.js';
import { createCreateWalletTool } from '../tools/create-wallet.tool.js';
import { env } from '../config/env.js';

export interface ExecutionDeps {
  agentService: AgentService;
  stateManager: StateManager;
  toolRegistry: ToolRegistry;
  providerFactory?: (provider: string, model: string) => ILLMProvider;
}

const defaultProviderFactory = (providerName: string, model: string): ILLMProvider => {
  if (providerName === 'anthropic') {
    const key = env.ANTHROPIC_API_KEY;
    if (!key) throw new SolAgentError('ANTHROPIC_API_KEY not configured', 'LLM_CONFIG_ERROR', 500);
    return new AnthropicProvider(key, model);
  }

  const key = env.OPENAI_API_KEY;
  if (!key) throw new SolAgentError('OPENAI_API_KEY not configured', 'LLM_CONFIG_ERROR', 500);
  return new OpenAIProvider(key, model);
};

const createFrameworkAdapter = (framework: string): AgentFramework => {
  if (framework === 'vercel-ai') return new VercelAIAdapter();
  return new SolAgentAdapter();
};

export const createExecutionService = (deps: ExecutionDeps) => {
  const { agentService, stateManager, toolRegistry } = deps;
  const providerFactory = deps.providerFactory ?? defaultProviderFactory;

  const executeAgent = async (agentId: string, input: AgentInput): Promise<AgentOutput[]> => {
    const agent = await agentService.getAgent(agentId);

    if (agent.status !== 'running') {
      throw new SolAgentError(
        `Agent ${agentId} is not running (status: ${agent.status})`,
        'AGENT_NOT_RUNNING',
        409,
      );
    }

    const state = await stateManager.getState(agentId);
    const provider = providerFactory(agent.llmProvider, agent.model);
    const tools: Tool[] = toolRegistry.getByNames(agent.tools);

    const agentTools = tools.map((t) => {
      if (t.name !== 'create_wallet') return t;
      return createCreateWalletTool(env.WALLET_ENGINE_URL, agent.id);
    });

    const effectiveWalletId = input.walletId || agent.walletId;

    const config: AgentConfig = {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      walletId: effectiveWalletId,
      framework: agent.framework,
      llmProvider: agent.llmProvider,
      model: agent.model,
      systemPrompt:
        agent.systemPrompt +
        `\n\nYour assigned wallet ID is: ${effectiveWalletId}. Use this exact ID for all balance checks, transfers, and swaps.`,
      tools: agent.tools,
      maxTokens: (agent.config as Record<string, unknown> | undefined)?.maxTokens as
        | number
        | undefined,
      temperature: (agent.config as Record<string, unknown> | undefined)?.temperature as
        | number
        | undefined,
    };

    const adapter = createFrameworkAdapter(agent.framework);
    await adapter.initialize(config, provider, agentTools);

    const outputs: AgentOutput[] = [];
    for await (const output of adapter.execute(input, state)) {
      outputs.push(output);
    }

    await stateManager.saveState(adapter.getState());

    return outputs;
  };

  return { executeAgent };
};

export type ExecutionService = ReturnType<typeof createExecutionService>;
