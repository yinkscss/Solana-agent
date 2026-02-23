export type AgentStatus = 'created' | 'running' | 'paused' | 'stopped';
export type AgentFramework = 'solagent' | 'vercel-ai';
export type AgentModel = 'gpt-4o' | 'claude-3';

export interface Agent {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  framework: AgentFramework;
  model: AgentModel;
  walletId: string;
  systemPrompt: string;
  createdAt: string;
  updatedAt: string;
}

export type WalletStatus = 'active' | 'inactive' | 'locked';
export type WalletNetwork = 'mainnet-beta' | 'devnet' | 'testnet';

export interface Wallet {
  id: string;
  address: string;
  label: string;
  network: WalletNetwork;
  status: WalletStatus;
  balance: number;
  keyProvider: string;
  createdAt: string;
}

export type TransactionStatus = 'pending' | 'confirmed' | 'failed';
export type TransactionType = 'transfer' | 'swap' | 'stake' | 'other';

export interface Transaction {
  id: string;
  walletId: string;
  type: TransactionType;
  status: TransactionStatus;
  signature: string;
  amount: number;
  token: string;
  to: string;
  from: string;
  createdAt: string;
}

export interface PolicyRule {
  id: string;
  type: 'max_amount' | 'allowed_tokens' | 'time_window' | 'whitelist';
  params: Record<string, unknown>;
}

export interface Policy {
  id: string;
  name: string;
  walletId: string;
  rules: PolicyRule[];
  version: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceHealth {
  name: string;
  url: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  latency?: number;
}

export interface DashboardStats {
  totalAgents: number;
  runningAgents: number;
  totalWallets: number;
  totalTransactions24h: number;
  activePolicies: number;
}
