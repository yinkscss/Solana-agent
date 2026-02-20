import { z } from 'zod';
import type { Tool } from './tool.interface.js';
import type { ToolResult } from '../types/index.js';

const swapParams = z.object({
  walletId: z.string().describe('The wallet ID to swap from'),
  inputMint: z.string().describe('Input token mint address'),
  outputMint: z.string().describe('Output token mint address'),
  amount: z.number().describe('Amount of input token to swap'),
  slippageBps: z.number().optional().describe('Slippage tolerance in basis points (default 50)'),
});

export const createSwapTool = (defiEngineUrl: string): Tool => ({
  name: 'swap',
  description: 'Swap tokens using Jupiter aggregator',
  parameters: swapParams,

  async execute(params: unknown): Promise<ToolResult> {
    const parsed = swapParams.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    try {
      const res = await fetch(`${defiEngineUrl}/api/v1/defi/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: parsed.data.walletId,
          inputMint: parsed.data.inputMint,
          outputMint: parsed.data.outputMint,
          amount: parsed.data.amount,
          slippageBps: parsed.data.slippageBps ?? 50,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        return { success: false, error: `DeFi engine error: ${res.status} ${text}` };
      }

      const data = await res.json();
      return { success: true, data };
    } catch {
      return { success: false, error: 'Swap request failed' };
    }
  },
});
