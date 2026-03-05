import { z } from 'zod';
import type { Tool } from './tool.interface.js';
import type { ToolResult } from '../types/index.js';
import { FAILED_STATUSES } from './constants.js';

const swapParams = z.object({
  walletId: z.string().describe('The wallet ID (UUID) to swap from'),
  inputMint: z
    .string()
    .describe(
      'Input token mint address (e.g. So11111111111111111111111111111111111111112 for SOL)',
    ),
  outputMint: z.string().describe('Output token mint address'),
  amount: z.number().describe('Amount of input token to swap (e.g. 0.3 for 0.3 SOL)'),
  slippageBps: z.number().optional().describe('Slippage tolerance in basis points (default 50)'),
});

export const createSwapTool = (defiEngineUrl: string, walletEngineUrl: string): Tool => ({
  name: 'swap',
  description:
    'Swap tokens using Jupiter aggregator on Solana devnet. Automatically fetches a quote and executes the swap. ' +
    'Common token mint addresses: SOL = So11111111111111111111111111111111111111112, ' +
    'USDC (mainnet) = EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v. ' +
    'Note: On devnet, not all token pairs have liquidity. If a swap fails, suggest the user try a different pair or amount.',
  parameters: swapParams,

  async execute(params: unknown): Promise<ToolResult> {
    const parsed = swapParams.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    const { walletId, inputMint, outputMint, amount, slippageBps } = parsed.data;
    const slippage = slippageBps ?? 50;

    try {
      const walletRes = await fetch(`${walletEngineUrl}/api/v1/wallets/${walletId}`);
      if (!walletRes.ok) {
        return { success: false, error: `Could not find wallet: ${walletRes.status}` };
      }
      const walletData = await walletRes.json();
      const wallet = walletData.data ?? walletData;
      const walletAddress = String(
        (wallet as Record<string, unknown>).publicKey ??
          (wallet as Record<string, unknown>).address ??
          '',
      );
      if (!walletAddress) {
        return { success: false, error: 'Could not resolve wallet public key' };
      }

      const inputAmount = String(Math.round(amount * 1_000_000_000));

      const quoteParams = new URLSearchParams({
        protocol: 'jupiter',
        inputMint,
        outputMint,
        amount: inputAmount,
        slippage: String(slippage),
        walletAddress,
      });
      const quoteRes = await fetch(`${defiEngineUrl}/api/v1/defi/quote?${quoteParams}`);
      if (!quoteRes.ok) {
        const quoteErr = await quoteRes.text().catch(() => 'unknown');
        return {
          success: false,
          error: `Could not get a swap quote. This token pair may not have liquidity on devnet. Details: ${quoteRes.status} ${quoteErr}`,
        };
      }
      const quoteJson = await quoteRes.json();
      const quote = quoteJson.data ?? quoteJson;

      const swapRes = await fetch(`${defiEngineUrl}/api/v1/defi/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId,
          protocol: 'jupiter',
          walletAddress,
          quote,
        }),
      });

      if (!swapRes.ok) {
        const swapErr = await swapRes.text().catch(() => 'unknown');
        return {
          success: false,
          error: `Swap execution failed. The quote may have expired or the token pair lacks devnet liquidity. Details: ${swapRes.status} ${swapErr}`,
        };
      }

      const swapJson = await swapRes.json();
      const swapRecord = swapJson.data ?? swapJson;
      const swapSignature = swapRecord.signature ?? swapRecord.transactionId ?? null;
      const swapStatus = swapRecord.status ?? 'completed';

      if (FAILED_STATUSES.has(swapStatus)) {
        return {
          success: false,
          error: swapRecord.errorMessage ?? `Swap failed with status: ${swapStatus}`,
          data: {
            transactionId: swapRecord.transactionId ?? swapRecord.id ?? null,
            status: swapStatus,
            inputMint,
            outputMint,
            amount,
          },
        };
      }

      return {
        success: true,
        data: {
          transactionId: swapRecord.transactionId ?? swapRecord.id ?? null,
          signature: swapSignature,
          status: swapStatus,
          explorerUrl: swapSignature
            ? `https://explorer.solana.com/tx/${swapSignature}?cluster=devnet`
            : null,
          inputMint,
          outputMint,
          amount,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Swap request failed';
      return { success: false, error: message };
    }
  },
});
