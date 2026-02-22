// ── Wallet ──────────────────────────────────────────────────────────────────

export interface Wallet {
  id: string;
  agentId: string;
  publicKey: string;
  keyProvider: string;
  network: string;
  label: string;
  status: string;
  createdAt: string;
}

export interface WalletBalance {
  balance: number;
  lamports: string;
}

export interface TokenBalance {
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: number;
}

export interface CreateWalletParams {
  agentId: string;
  provider?: string;
  label: string;
  network?: string;
}

// ── Policy ──────────────────────────────────────────────────────────────────

export interface Policy {
  id: string;
  walletId: string;
  name: string;
  rules: PolicyRule[];
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SpendingLimitRule {
  type: "spending_limit";
  maxPerTransaction: string;
  maxPerWindow: string;
  windowDuration: number;
  tokenMint: string;
}

export interface ProgramAllowlistRule {
  type: "program_allowlist";
  programIds: string[];
}

export interface TokenAllowlistRule {
  type: "token_allowlist";
  tokenMints: string[];
}

export interface AddressBlocklistRule {
  type: "address_blocklist";
  addresses: string[];
}

export type PolicyRule =
  | SpendingLimitRule
  | ProgramAllowlistRule
  | TokenAllowlistRule
  | AddressBlocklistRule;

export interface CreatePolicyParams {
  walletId: string;
  name: string;
  rules: PolicyRule[];
}

export interface UpdatePolicyParams {
  name?: string;
  rules?: PolicyRule[];
}

export interface PolicyEvaluation {
  decision: "allow" | "deny" | "require_approval";
  reasons: string[];
  approvalId?: string;
}

export interface EvaluateTransactionParams {
  walletId: string;
  amount: string;
  tokenMint: string;
  destinationAddress: string;
  programIds: string[];
}

// ── Transaction ─────────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  walletId: string;
  agentId?: string;
  type: string;
  status: string;
  signature?: string;
  gasless: boolean;
  createdAt: string;
  confirmedAt?: string;
}

export interface CreateTransactionParams {
  walletId: string;
  type: string;
  destination?: string;
  amount?: string;
  tokenMint?: string;
  instructions?: unknown[];
  gasless?: boolean;
  urgency?: "low" | "medium" | "high";
}

// ── Agent ───────────────────────────────────────────────────────────────────

export interface Agent {
  id: string;
  orgId: string;
  walletId: string;
  name: string;
  description: string;
  status: string;
  framework: string;
  llmProvider: string;
  model: string;
  systemPrompt: string;
  tools: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentParams {
  orgId: string;
  walletId: string;
  name: string;
  description: string;
  framework: "langchain" | "vercel-ai";
  llmProvider: "openai" | "anthropic";
  model: string;
  systemPrompt: string;
  tools?: string[];
}

export interface AgentExecution {
  outputs: { type: string; content: string; toolName?: string }[];
}

// ── DeFi ────────────────────────────────────────────────────────────────────

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  outputAmount: string;
  priceImpactPct: number;
  fee: string;
}

export interface SwapParams {
  walletId: string;
  protocol: string;
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
}

export interface StakeParams {
  walletId: string;
  protocol: string;
  amount: string;
  validator?: string;
}

export interface PriceFeed {
  symbol: string;
  price: number;
  confidence: number;
  timestamp: number;
}

export interface DeFiProtocol {
  name: string;
  programIds: string[];
  capabilities: string[];
}

// ── Client Config ───────────────────────────────────────────────────────────

export interface SolAgentConfig {
  baseUrl?: string;
  services?: {
    walletEngine?: string;
    policyEngine?: string;
    transactionEngine?: string;
    agentRuntime?: string;
    defiIntegration?: string;
    notification?: string;
  };
  apiKey?: string;
  orgId?: string;
  timeout?: number;
  retries?: number;
}
