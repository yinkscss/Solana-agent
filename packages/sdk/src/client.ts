import { HttpClient } from "./http/http-client.js";
import { WalletModule } from "./modules/wallet.module.js";
import { PolicyModule } from "./modules/policy.module.js";
import { TransactionModule } from "./modules/transaction.module.js";
import { AgentModule } from "./modules/agent.module.js";
import { DeFiModule } from "./modules/defi.module.js";
import type { SolAgentConfig } from "./types/index.js";

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

const DEFAULTS = {
  walletEngine: "http://localhost:3002",
  policyEngine: "http://localhost:3003",
  transactionEngine: "http://localhost:3004",
  agentRuntime: "http://localhost:3001",
  defiIntegration: "http://localhost:3005",
} as const;

const buildHttpClient = (
  baseUrl: string,
  config: SolAgentConfig,
): HttpClient =>
  new HttpClient({
    baseUrl,
    apiKey: config.apiKey,
    timeout: config.timeout ?? DEFAULT_TIMEOUT,
    retries: config.retries ?? DEFAULT_RETRIES,
  });

const resolveUrl = (
  config: SolAgentConfig,
  serviceKey: keyof typeof DEFAULTS,
): string =>
  config.baseUrl ?? config.services?.[serviceKey] ?? DEFAULTS[serviceKey];

export class SolAgentClient {
  readonly wallets: WalletModule;
  readonly policies: PolicyModule;
  readonly transactions: TransactionModule;
  readonly agents: AgentModule;
  readonly defi: DeFiModule;

  constructor(config: SolAgentConfig) {
    this.wallets = new WalletModule(
      buildHttpClient(resolveUrl(config, "walletEngine"), config),
    );
    this.policies = new PolicyModule(
      buildHttpClient(resolveUrl(config, "policyEngine"), config),
    );
    this.transactions = new TransactionModule(
      buildHttpClient(resolveUrl(config, "transactionEngine"), config),
    );
    this.agents = new AgentModule(
      buildHttpClient(resolveUrl(config, "agentRuntime"), config),
    );
    this.defi = new DeFiModule(
      buildHttpClient(resolveUrl(config, "defiIntegration"), config),
    );
  }

  static create = (config: SolAgentConfig): SolAgentClient =>
    new SolAgentClient(config);
}
