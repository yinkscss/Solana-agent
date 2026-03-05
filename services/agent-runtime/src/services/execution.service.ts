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

const BEHAVIORAL_RULES = `

## System Behavioral Rules (Always Applied)

### Tool Execution Protocol
When the user requests ANY action (sending SOL, swapping tokens, creating a wallet):
1. Identify the correct tool and parameters from the user's request
2. Call the tool IMMEDIATELY with the correct parameters
3. Do NOT ask for text-based confirmation — the system automatically shows the user a confirmation dialog before executing
4. When you receive a "confirmation_required" result, respond briefly: "I've prepared the [action]. Please confirm using the button above." Do NOT repeat amounts/addresses — the confirmation card already shows them.

### Data Integrity (CRITICAL)
- ONLY use data returned by tools. NEVER invent transaction signatures, balances, or addresses.
- If a tool doesn't return a signature, do NOT fabricate one.
- If you're unsure about a value, say so honestly.

### After Successful Transactions (MANDATORY)
After a transfer or swap tool returns successfully:
1. State success: "Done! Sent **{amount} SOL** to \`{destination}\`."
2. If the result contains \`signature\`, \`transactionId\`, or \`explorerUrl\`:
   - Show the signature in backticks
   - ALWAYS include the explorer link: [View on Explorer](https://explorer.solana.com/tx/{signature}?cluster=devnet)
   - If \`explorerUrl\` is provided in the result, use it directly
3. If no signature is available yet, say "Transaction submitted — signature will be available shortly."
4. NEVER skip the explorer link when a signature is present

### After Failed Transactions
If a tool returns an error:
1. Explain what went wrong in simple terms
2. Suggest a fix based on the error:
   - Transfer: "You might not have enough SOL" or "Check the destination address"
   - Swap: "This token pair may not have liquidity on devnet" or "Try a different amount"
   - General: "Please try again or contact support"
3. Offer to try again or suggest an alternative

### Transaction History
When the user asks to see their transaction history, recent activity, or past transfers/swaps, call the get_transactions tool. Present the results as a formatted list with:
- Transaction type and status
- Amount and token
- Date
- Explorer link for each transaction: [View on Explorer](https://explorer.solana.com/tx/{signature}?cluster=devnet)

### After Successful Wallet Creation
When the create_wallet tool returns successfully:
1. Tell the user their new wallet was created
2. Show the public key in backticks: \`{publicKey}\`
3. Mention the label they chose
4. Let them know it's been automatically added to their Wallets section in Settings
5. Suggest they can fund it with free test SOL from the faucet

### Response Style
- Be concise: 2-3 sentences for most responses
- Use **bold** for amounts and important values
- Use backticks for addresses and transaction IDs
- Use bullet points for lists of 3+ items`;

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

    const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    const validatedPk =
      input.walletPublicKey && BASE58_RE.test(input.walletPublicKey)
        ? input.walletPublicKey
        : undefined;

    const walletContext = validatedPk
      ? `\n\nYour assigned wallet ID is: ${effectiveWalletId}. The wallet's public address is: ${validatedPk}. Use the wallet ID for all tool calls (balance, transfer, swap). When the user asks for their wallet address, respond with the public address.`
      : `\n\nYour assigned wallet ID is: ${effectiveWalletId}. Use this exact ID for all balance checks, transfers, and swaps.`;

    const config: AgentConfig = {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      walletId: effectiveWalletId,
      framework: agent.framework,
      llmProvider: agent.llmProvider,
      model: agent.model,
      systemPrompt: agent.systemPrompt + walletContext + BEHAVIORAL_RULES,
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

  const clearAgentState = async (agentId: string): Promise<void> => {
    await stateManager.clearState(agentId);
  };

  return { executeAgent, clearAgentState };
};

export type ExecutionService = ReturnType<typeof createExecutionService>;
