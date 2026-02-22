export { SolAgentClient } from "./client.js";

export { WalletModule } from "./modules/wallet.module.js";
export { PolicyModule } from "./modules/policy.module.js";
export { TransactionModule } from "./modules/transaction.module.js";
export { AgentModule } from "./modules/agent.module.js";
export { DeFiModule } from "./modules/defi.module.js";
export { EventsModule } from "./modules/events.module.js";
export type { EventPayload, EventHandler } from "./modules/events.module.js";

export {
  SolAgentSDKError,
  WalletNotFoundError,
  PolicyViolationError,
  TransactionFailedError,
  NetworkError,
  TimeoutError,
} from "./http/errors.js";

export type {
  SolAgentConfig,
  Wallet,
  WalletBalance,
  TokenBalance,
  CreateWalletParams,
  Policy,
  PolicyRule,
  SpendingLimitRule,
  ProgramAllowlistRule,
  TokenAllowlistRule,
  AddressBlocklistRule,
  CreatePolicyParams,
  UpdatePolicyParams,
  PolicyEvaluation,
  EvaluateTransactionParams,
  Transaction,
  CreateTransactionParams,
  Agent,
  CreateAgentParams,
  AgentExecution,
  SwapQuote,
  SwapParams,
  StakeParams,
  PriceFeed,
  DeFiProtocol,
} from "./types/index.js";
