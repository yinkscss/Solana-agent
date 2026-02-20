import type { HttpClient } from "../http/http-client.js";
import type {
  SwapQuote,
  SwapParams,
  StakeParams,
  PriceFeed,
  DeFiProtocol,
} from "../types/index.js";

export class DeFiModule {
  constructor(private readonly http: HttpClient) {}

  getQuote = (params: {
    protocol: string;
    inputMint: string;
    outputMint: string;
    amount: string;
    slippageBps?: number;
    walletAddress: string;
  }): Promise<SwapQuote> => {
    const qs = new URLSearchParams({
      protocol: params.protocol,
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount,
      walletAddress: params.walletAddress,
      ...(params.slippageBps ? { slippageBps: String(params.slippageBps) } : {}),
    });
    return this.http.get<SwapQuote>(`/api/v1/defi/quote?${qs}`);
  };

  swap = (params: SwapParams): Promise<{ transactionId: string }> =>
    this.http.post<{ transactionId: string }>("/api/v1/defi/swap", params);

  stake = (params: StakeParams): Promise<{ transactionId: string }> =>
    this.http.post<{ transactionId: string }>("/api/v1/defi/stake", params);

  unstake = (params: StakeParams): Promise<{ transactionId: string }> =>
    this.http.post<{ transactionId: string }>("/api/v1/defi/unstake", params);

  getPrice = (mint: string): Promise<PriceFeed> =>
    this.http.get<PriceFeed>(`/api/v1/defi/price/${mint}`);

  listProtocols = (): Promise<DeFiProtocol[]> =>
    this.http.get<DeFiProtocol[]>("/api/v1/defi/protocols");
}
