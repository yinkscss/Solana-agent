import { z } from 'zod';
import { SolAgentError } from '@solagent/common';
import type { Tool } from './tool.interface.js';
import type { ToolResult } from '../types/index.js';

const transferParams = z.object({
  walletId: z.string().describe('The wallet ID to send from'),
  destination: z.string().describe('The destination Solana address'),
  amount: z.number().describe('Amount to transfer'),
  tokenMint: z.string().optional().describe('SPL token mint address (omit for native SOL)'),
});

export const createTransferTool = (transactionEngineUrl: string): Tool => ({
  name: 'transfer',
  description: 'Transfer SOL or SPL tokens to a destination address',
  parameters: transferParams,

  async execute(params: unknown): Promise<ToolResult> {
    const parsed = transferParams.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    try {
      const res = await fetch(`${transactionEngineUrl}/api/v1/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: parsed.data.walletId,
          type: 'transfer',
          instructions: {
            destination: parsed.data.destination,
            amount: parsed.data.amount,
            ...(parsed.data.tokenMint && { tokenMint: parsed.data.tokenMint }),
          },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        return { success: false, error: `Transaction engine error: ${res.status} ${text}` };
      }

      const data = await res.json();
      return { success: true, data };
    } catch (err) {
      const message = err instanceof SolAgentError ? err.message : 'Transfer request failed';
      return { success: false, error: message };
    }
  },
});
