import type { AgentStatus } from '@solagent/common';

export type AgentFrameworkType = 'langchain' | 'vercel-ai' | 'eliza';
export type LLMProviderType = 'openai' | 'anthropic';

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  walletId: string;
  framework: AgentFrameworkType;
  llmProvider: LLMProviderType;
  model: string;
  systemPrompt: string;
  tools: string[];
  maxTokens?: number;
  temperature?: number;
}

export interface AgentRecord {
  id: string;
  orgId: string;
  walletId: string;
  name: string;
  description: string;
  status: AgentStatus;
  framework: AgentFrameworkType;
  llmProvider: LLMProviderType;
  model: string;
  systemPrompt: string;
  tools: string[];
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentInput {
  message: string;
  conversationId?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentOutput {
  type: 'text' | 'tool_call' | 'tool_result' | 'error';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolName?: string;
  toolCallId?: string;
  timestamp: Date;
}

export interface AgentState {
  agentId: string;
  conversationHistory: ConversationMessage[];
  metadata: Record<string, unknown>;
  lastActiveAt: Date;
}

export interface ListOptions {
  page?: number;
  pageSize?: number;
}

export interface CreateAgentParams {
  orgId: string;
  walletId: string;
  name: string;
  description: string;
  framework: AgentFrameworkType;
  llmProvider: LLMProviderType;
  model: string;
  systemPrompt: string;
  tools: string[];
  config?: Record<string, unknown>;
}
