import type { HttpClient } from "../http/http-client.js";
import type {
  CreateWalletParams,
  Wallet,
  WalletBalance,
  TokenBalance,
} from "../types/index.js";

export class WalletModule {
  constructor(private readonly http: HttpClient) {}

  create = async (params: CreateWalletParams): Promise<Wallet> =>
    this.http.post<Wallet>("/api/v1/wallets", params);

  get = async (walletId: string): Promise<Wallet> =>
    this.http.get<Wallet>(`/api/v1/wallets/${walletId}`);

  getBalance = async (walletId: string): Promise<WalletBalance> =>
    this.http.get<WalletBalance>(`/api/v1/wallets/${walletId}/balance`);

  getTokenBalances = async (walletId: string): Promise<TokenBalance[]> =>
    this.http.get<TokenBalance[]>(`/api/v1/wallets/${walletId}/tokens`);

  deactivate = async (walletId: string): Promise<Wallet> =>
    this.http.delete<Wallet>(`/api/v1/wallets/${walletId}`);

  recover = async (walletId: string): Promise<Wallet> =>
    this.http.post<Wallet>(`/api/v1/wallets/${walletId}/recover`);

  listByAgent = async (agentId: string): Promise<Wallet[]> =>
    this.http.get<Wallet[]>(`/api/v1/agents/${agentId}/wallets`);
}
