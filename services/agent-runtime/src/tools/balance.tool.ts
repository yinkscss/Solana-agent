import { z } from 'zod';
import type { Tool } from './tool.interface.js';
import type { ToolResult } from '../types/index.js';

const balanceParams = z.object({
  walletId: z.string().describe('The wallet ID to check balance for'),
});

export const createBalanceTool = (walletEngineUrl: string): Tool => ({
  name: 'get_balance',
  description: 'Get the SOL and token balances for a wallet',
  parameters: balanceParams,

  async execute(params: unknown): Promise<ToolResult> {
    const parsed = balanceParams.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    try {
      const res = await fetch(
        `${walletEngineUrl}/api/v1/wallets/${parsed.data.walletId}/balance`,
      );

      if (!res.ok) {
        const text = await res.text();
        return { success: false, error: `Wallet engine error: ${res.status} ${text}` };
      }

      const data = await res.json();
      return { success: true, data };
    } catch {
      return { success: false, error: 'Balance request failed' };
    }
  },
});
