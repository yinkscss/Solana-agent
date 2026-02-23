import { z } from 'zod';
import type { Tool } from './tool.interface.js';
import type { ToolResult } from '../types/index.js';

const airdropParams = z.object({
  walletId: z.string().describe('The wallet ID to get a faucet link for'),
});

export const createAirdropTool = (walletEngineUrl: string, _solanaRpcUrl: string): Tool => ({
  name: 'request_airdrop',
  description:
    'Request a SOL airdrop on Solana devnet to fund a wallet. Returns a faucet link; only works on devnet.',
  parameters: airdropParams,

  async execute(params: unknown): Promise<ToolResult> {
    const parsed = airdropParams.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    try {
      const walletRes = await fetch(`${walletEngineUrl}/api/v1/wallets/${parsed.data.walletId}`);
      if (!walletRes.ok) {
        return { success: false, error: `Wallet not found (${walletRes.status})` };
      }
      const walletJson = await walletRes.json();
      const wallet = walletJson.data ?? walletJson;
      const publicKey = wallet.publicKey;

      if (!publicKey) {
        return { success: false, error: 'Wallet has no public key' };
      }

      const faucetUrl = `https://faucet.solana.com/?address=${publicKey}&network=devnet`;

      return {
        success: true,
        data: {
          faucetUrl,
          publicKey,
          message: `Visit the Solana faucet to get free test SOL for wallet ${publicKey}`,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: `Failed to fetch wallet: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  },
});
