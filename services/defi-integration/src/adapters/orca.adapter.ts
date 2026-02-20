import type {
  DeFiProtocolAdapter,
  SwapQuoteParams,
  SwapQuote,
  SwapExecuteParams,
  SerializedInstruction,
  PoolInfo,
} from './adapter.interface';
import { ExternalServiceError } from '../types';

const ORCA_API = 'https://api.orca.so/v1';

interface OrcaQuoteResponse {
  estimatedAmountOut: string;
  priceImpactPercent: number;
  fee: string;
  route: unknown;
}

interface OrcaWhirlpoolResponse {
  address: string;
  tokenMintA: string;
  tokenMintB: string;
  tokenAmountA: string;
  tokenAmountB: string;
  tvl: number;
  apy: number;
}

export const createOrcaAdapter = (rpcUrl: string): DeFiProtocolAdapter => ({
  name: 'orca',
  programIds: ['whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc'],

  async getSwapQuote(params: SwapQuoteParams): Promise<SwapQuote> {
    const url = new URL('/quote', ORCA_API);
    url.searchParams.set('inputMint', params.inputMint);
    url.searchParams.set('outputMint', params.outputMint);
    url.searchParams.set('amount', params.amount);
    url.searchParams.set('slippageBps', String(params.slippageBps ?? 50));

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new ExternalServiceError('Orca', `Quote failed: ${await res.text().catch(() => 'Unknown')}`);
    }

    const data = (await res.json()) as OrcaQuoteResponse;
    return {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      inputAmount: params.amount,
      outputAmount: data.estimatedAmountOut,
      priceImpactPct: data.priceImpactPercent,
      fee: data.fee,
      route: { protocol: 'orca', rpcUrl, ...data.route as object },
    };
  },

  async buildSwapInstructions(params: SwapExecuteParams): Promise<SerializedInstruction[]> {
    const res = await fetch(`${ORCA_API}/swap/instructions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputMint: params.quote.inputMint,
        outputMint: params.quote.outputMint,
        amount: params.quote.inputAmount,
        userPublicKey: params.walletAddress,
        route: params.quote.route,
      }),
    });

    if (!res.ok) {
      throw new ExternalServiceError('Orca', `Swap build failed: ${await res.text().catch(() => 'Unknown')}`);
    }

    const data = (await res.json()) as { instructions: SerializedInstruction[] };
    return data.instructions;
  },

  async getPoolInfo(poolId: string): Promise<PoolInfo> {
    const res = await fetch(`${ORCA_API}/whirlpools/${poolId}`);
    if (!res.ok) {
      throw new ExternalServiceError('Orca', `Pool fetch failed: ${await res.text().catch(() => 'Unknown')}`);
    }

    const pool = (await res.json()) as OrcaWhirlpoolResponse;
    return {
      id: pool.address,
      tokenA: { mint: pool.tokenMintA, amount: pool.tokenAmountA },
      tokenB: { mint: pool.tokenMintB, amount: pool.tokenAmountB },
      tvl: String(pool.tvl),
      apy: pool.apy,
    };
  },
});
