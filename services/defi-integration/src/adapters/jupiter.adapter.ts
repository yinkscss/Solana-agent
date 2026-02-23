import type {
  DeFiProtocolAdapter,
  SwapQuoteParams,
  SwapQuote,
  SwapExecuteParams,
  SwapTransactionResult,
} from './adapter.interface';
import { ExternalServiceError } from '../types';

interface JupiterQuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: unknown[];
  otherAmountThreshold: string;
}

interface JupiterSwapResponse {
  swapTransaction: string;
}

export const createJupiterAdapter = (apiUrl: string): DeFiProtocolAdapter => ({
  name: 'jupiter',
  programIds: ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'],

  async getSwapQuote(params: SwapQuoteParams): Promise<SwapQuote> {
    const url = new URL(`${apiUrl}/quote`);
    url.searchParams.set('inputMint', params.inputMint);
    url.searchParams.set('outputMint', params.outputMint);
    url.searchParams.set('amount', params.amount);
    url.searchParams.set('slippageBps', String(params.slippageBps ?? 50));

    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown error');
      throw new ExternalServiceError('Jupiter', `Quote failed: ${text}`);
    }

    const data = (await res.json()) as JupiterQuoteResponse;
    const totalFees = data.routePlan.reduce((sum: number, step: unknown) => {
      const s = step as { swapInfo?: { feeAmount?: string } };
      return sum + Number(s.swapInfo?.feeAmount ?? 0);
    }, 0);

    return {
      inputMint: data.inputMint,
      outputMint: data.outputMint,
      inputAmount: data.inAmount,
      outputAmount: data.outAmount,
      priceImpactPct: parseFloat(data.priceImpactPct),
      fee: String(totalFees),
      route: data,
    };
  },

  async buildSwapTransaction(params: SwapExecuteParams): Promise<SwapTransactionResult> {
    const res = await fetch(`${apiUrl}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: params.quote.route,
        userPublicKey: params.walletAddress,
        wrapAndUnwrapSol: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown error');
      throw new ExternalServiceError('Jupiter', `Swap build failed: ${text}`);
    }

    const data = (await res.json()) as JupiterSwapResponse;

    return {
      transaction: data.swapTransaction,
      inputAmount: params.quote.inputAmount,
      outputAmount: params.quote.outputAmount,
      priceImpactPct: params.quote.priceImpactPct,
    };
  },
});
