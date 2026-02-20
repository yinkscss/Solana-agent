import type {
  DeFiProtocolAdapter,
  SwapQuoteParams,
  SwapQuote,
  SwapExecuteParams,
  SerializedInstruction,
  PoolInfo,
} from './adapter.interface';
import { ExternalServiceError } from '../types';

const RAYDIUM_API = 'https://api.raydium.io/v2';

interface RaydiumPoolResponse {
  id: string;
  baseMint: string;
  quoteMint: string;
  baseAmount: number;
  quoteAmount: number;
  tvl: number;
  apr24h: number;
}

interface RaydiumQuoteResponse {
  amountOut: string;
  priceImpact: number;
  fee: string;
}

export const createRaydiumAdapter = (rpcUrl: string): DeFiProtocolAdapter => ({
  name: 'raydium',
  programIds: ['675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'],

  async getSwapQuote(params: SwapQuoteParams): Promise<SwapQuote> {
    const url = new URL('/swap/quote', RAYDIUM_API);
    url.searchParams.set('inputMint', params.inputMint);
    url.searchParams.set('outputMint', params.outputMint);
    url.searchParams.set('amount', params.amount);
    url.searchParams.set('slippage', String((params.slippageBps ?? 50) / 100));

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new ExternalServiceError('Raydium', `Quote failed: ${await res.text().catch(() => 'Unknown')}`);
    }

    const data = (await res.json()) as RaydiumQuoteResponse;
    return {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      inputAmount: params.amount,
      outputAmount: data.amountOut,
      priceImpactPct: data.priceImpact,
      fee: data.fee,
      route: { protocol: 'raydium', rpcUrl },
    };
  },

  async buildSwapInstructions(params: SwapExecuteParams): Promise<SerializedInstruction[]> {
    const res = await fetch(`${RAYDIUM_API}/swap/instructions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputMint: params.quote.inputMint,
        outputMint: params.quote.outputMint,
        amount: params.quote.inputAmount,
        userPublicKey: params.walletAddress,
      }),
    });

    if (!res.ok) {
      throw new ExternalServiceError('Raydium', `Swap build failed: ${await res.text().catch(() => 'Unknown')}`);
    }

    const data = (await res.json()) as { instructions: SerializedInstruction[] };
    return data.instructions;
  },

  async getPoolInfo(poolId: string): Promise<PoolInfo> {
    const res = await fetch(`${RAYDIUM_API}/pools/${poolId}`);
    if (!res.ok) {
      throw new ExternalServiceError('Raydium', `Pool fetch failed: ${await res.text().catch(() => 'Unknown')}`);
    }

    const pool = (await res.json()) as RaydiumPoolResponse;
    return {
      id: pool.id,
      tokenA: { mint: pool.baseMint, amount: String(pool.baseAmount) },
      tokenB: { mint: pool.quoteMint, amount: String(pool.quoteAmount) },
      tvl: String(pool.tvl),
      apy: pool.apr24h,
    };
  },
});
