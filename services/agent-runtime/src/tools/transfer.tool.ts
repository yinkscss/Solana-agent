import { z } from 'zod';
import { SolAgentError } from '@solagent/common';
import type { Tool } from './tool.interface.js';
import type { ToolResult } from '../types/index.js';

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const transferParams = z.object({
  walletId: z.string().describe('The wallet ID (UUID) to send from'),
  destination: z
    .string()
    .describe('The destination Solana address (base58 public key, 32-44 chars)'),
  amount: z.number().describe('Amount of SOL to transfer (e.g. 0.1 for 0.1 SOL)'),
  tokenMint: z.string().optional().describe('SPL token mint address (omit for native SOL)'),
});

export const createTransferTool = (transactionEngineUrl: string): Tool => ({
  name: 'transfer',
  description:
    'Transfer SOL or SPL tokens to a destination Solana address. The destination must be a valid base58 Solana public key (32-44 characters, like 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU). Do NOT use placeholders or descriptions as the destination.',
  parameters: transferParams,

  async execute(params: unknown): Promise<ToolResult> {
    const parsed = transferParams.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    if (!BASE58_RE.test(parsed.data.destination)) {
      return {
        success: false,
        error: `Invalid destination address: "${parsed.data.destination}" is not a valid Solana public key. A Solana address is 32-44 base58 characters (letters and numbers, no spaces). Ask the user for the exact recipient address.`,
      };
    }

    try {
      const lamports = Math.round(parsed.data.amount * 1_000_000_000);
      const res = await fetch(`${transactionEngineUrl}/api/v1/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: parsed.data.walletId,
          type: 'transfer',
          destination: parsed.data.destination,
          amount: String(lamports),
          ...(parsed.data.tokenMint && { tokenMint: parsed.data.tokenMint }),
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
