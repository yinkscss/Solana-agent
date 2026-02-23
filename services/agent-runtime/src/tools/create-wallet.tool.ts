import { z } from 'zod';
import type { Tool } from './tool.interface.js';
import type { ToolResult } from '../types/index.js';

const createWalletParams = z.object({
  label: z.string().describe('A human-readable label for the wallet'),
  network: z
    .enum(['devnet', 'testnet', 'mainnet-beta'])
    .optional()
    .describe('Solana network (default: devnet)'),
});

export const createCreateWalletTool = (walletEngineUrl: string, agentId?: string): Tool => ({
  name: 'create_wallet',
  description: 'Create a new Solana wallet programmatically. Returns the wallet ID and public key.',
  parameters: createWalletParams,

  async execute(params: unknown): Promise<ToolResult> {
    const parsed = createWalletParams.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    try {
      const effectiveAgentId = agentId || 'unknown';
      const res = await fetch(`${walletEngineUrl}/api/v1/wallets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: effectiveAgentId,
          label: parsed.data.label,
          network: parsed.data.network ?? 'devnet',
          provider: 'local',
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        return { success: false, error: `Wallet creation failed: ${res.status} ${text}` };
      }

      const json = await res.json();
      const data = json.data ?? json;
      return {
        success: true,
        data: {
          walletId: data.id,
          publicKey: data.publicKey,
          network: data.network,
          label: data.label,
          status: data.status,
        },
      };
    } catch {
      return { success: false, error: 'Wallet creation request failed' };
    }
  },
});
