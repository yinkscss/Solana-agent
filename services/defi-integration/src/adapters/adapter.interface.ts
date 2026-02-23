export interface SerializedInstruction {
  programId: string;
  keys: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  data: string;
}

export interface SwapQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
  walletAddress: string;
}

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  outputAmount: string;
  priceImpactPct: number;
  fee: string;
  route: unknown;
}

export interface SwapExecuteParams {
  walletAddress: string;
  quote: SwapQuote;
}

export interface StakeParams {
  walletAddress: string;
  amount: string;
  validator?: string;
}

export interface PoolInfo {
  id: string;
  tokenA: { mint: string; amount: string };
  tokenB: { mint: string; amount: string };
  tvl: string;
  apy: number;
}

export interface SwapTransactionResult {
  transaction: string;
  inputAmount: string;
  outputAmount: string;
  priceImpactPct: number;
}

export interface LendingParams {
  walletAddress: string;
  mint: string;
  amount: string;
}

export interface DeFiProtocolAdapter {
  readonly name: string;
  readonly programIds: string[];

  getSwapQuote?(params: SwapQuoteParams): Promise<SwapQuote>;
  buildSwapInstructions?(params: SwapExecuteParams): Promise<SerializedInstruction[]>;
  /** Return a fully-serialized transaction (base64) ready for signing. */
  buildSwapTransaction?(params: SwapExecuteParams): Promise<SwapTransactionResult>;

  getPoolInfo?(poolId: string): Promise<PoolInfo>;

  buildStakeInstructions?(params: StakeParams): Promise<SerializedInstruction[]>;
  buildUnstakeInstructions?(params: StakeParams): Promise<SerializedInstruction[]>;

  buildSupplyInstructions?(params: LendingParams): Promise<SerializedInstruction[]>;
  buildBorrowInstructions?(params: LendingParams): Promise<SerializedInstruction[]>;
}
