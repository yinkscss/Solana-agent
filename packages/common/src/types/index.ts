export type WalletStatus = 'active' | 'frozen' | 'recovering';
export type KeyProvider = 'turnkey' | 'crossmint' | 'privy' | 'local';
export type Network = 'mainnet-beta' | 'devnet' | 'testnet';

export type AgentStatus = 'created' | 'running' | 'paused' | 'stopped' | 'destroyed';

export type TransactionStatus =
  | 'pending'
  | 'simulating'
  | 'simulation_failed'
  | 'policy_eval'
  | 'rejected'
  | 'awaiting_approval'
  | 'signing'
  | 'signing_failed'
  | 'submitting'
  | 'submitted'
  | 'confirmed'
  | 'failed'
  | 'retrying'
  | 'permanently_failed';

export type TransactionType =
  | 'transfer'
  | 'swap'
  | 'stake'
  | 'unstake'
  | 'lend'
  | 'borrow'
  | 'nft'
  | 'custom';

export type PolicyDecision = 'allow' | 'deny' | 'require_approval';

export type PolicyRuleType =
  | 'spending_limit'
  | 'program_allowlist'
  | 'token_allowlist'
  | 'address_blocklist'
  | 'time_restriction'
  | 'human_approval'
  | 'rate_limit';

export type OrgTier = 'free' | 'pro' | 'enterprise';
export type UserRole = 'viewer' | 'developer' | 'operator' | 'admin';

export interface Wallet {
  id: string;
  orgId: string;
  address: string;
  name: string;
  status: WalletStatus;
  keyProvider: KeyProvider;
  network: Network;
  createdAt: Date;
  updatedAt: Date;
}

export interface Agent {
  id: string;
  orgId: string;
  walletId: string;
  name: string;
  description: string;
  status: AgentStatus;
  model: string;
  systemPrompt: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  walletId: string;
  agentId: string | null;
  type: TransactionType;
  status: TransactionStatus;
  signature: string | null;
  amount: bigint | null;
  token: string | null;
  destination: string | null;
  rawTransaction: string;
  error: string | null;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyRule {
  id: string;
  orgId: string;
  walletId: string | null;
  agentId: string | null;
  name: string;
  type: PolicyRuleType;
  decision: PolicyDecision;
  parameters: Record<string, unknown>;
  priority: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  tier: OrgTier;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  orgId: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
