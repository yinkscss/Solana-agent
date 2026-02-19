import { HttpClient } from "./http/http-client.js";
import { WalletModule } from "./modules/wallet.module.js";
import { PolicyModule } from "./modules/policy.module.js";
import { TransactionModule } from "./modules/transaction.module.js";
import type { SolAgentConfig } from "./types/index.js";

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

const DEFAULT_WALLET_ENGINE = "http://localhost:3002";
const DEFAULT_POLICY_ENGINE = "http://localhost:3003";
const DEFAULT_TRANSACTION_ENGINE = "http://localhost:3004";

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

export class SolAgentClient {
  readonly wallets: WalletModule;
  readonly policies: PolicyModule;
  readonly transactions: TransactionModule;

  constructor(config: SolAgentConfig) {
    const walletUrl =
      config.baseUrl ?? config.services?.walletEngine ?? DEFAULT_WALLET_ENGINE;
    const policyUrl =
      config.baseUrl ?? config.services?.policyEngine ?? DEFAULT_POLICY_ENGINE;
    const transactionUrl =
      config.baseUrl ??
      config.services?.transactionEngine ??
      DEFAULT_TRANSACTION_ENGINE;

    this.wallets = new WalletModule(buildHttpClient(walletUrl, config));
    this.policies = new PolicyModule(buildHttpClient(policyUrl, config));
    this.transactions = new TransactionModule(
      buildHttpClient(transactionUrl, config),
    );
  }

  static create = (config: SolAgentConfig): SolAgentClient =>
    new SolAgentClient(config);
}
