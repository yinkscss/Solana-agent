import { z } from 'zod';
import type { Tool } from './tool.interface.js';
import type { ToolResult } from '../types/index.js';

const airdropParams = z.object({
  walletId: z.string().describe('The wallet ID to airdrop SOL to'),
  amount: z.number().optional().describe('Amount of SOL to airdrop (default: 1, max: 2 on devnet)'),
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tryAirdrop(
  rpcUrl: string,
  publicKey: string,
  lamports: number,
  attempt: number,
): Promise<{ signature?: string; error?: string; retryable: boolean }> {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'requestAirdrop',
        params: [publicKey, lamports],
      }),
    });

    const data = await res.json();

    if (data.result) {
      return { signature: data.result, retryable: false };
    }

    const code = data.error?.code;
    const msg = data.error?.message ?? 'Unknown RPC error';

    if (code === 429) {
      return { error: msg, retryable: attempt < 2 };
    }

    if (code === -32603) {
      return { error: msg, retryable: attempt < 2 };
    }

    return { error: msg, retryable: false };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Network error',
      retryable: attempt < 2,
    };
  }
}

export const createAirdropTool = (walletEngineUrl: string, solanaRpcUrl: string): Tool => ({
  name: 'request_airdrop',
  description: 'Request a SOL airdrop on Solana devnet to fund a wallet. Only works on devnet.',
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

      const requestedSol = Math.min(parsed.data.amount ?? 1, 2);
      const lamports = requestedSol * 1_000_000_000;

      let lastError = '';
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await sleep(2000 * attempt);

        const result = await tryAirdrop(solanaRpcUrl, publicKey, lamports, attempt);

        if (result.signature) {
          return {
            success: true,
            data: {
              signature: result.signature,
              amount: requestedSol,
              publicKey,
              explorerUrl: `https://explorer.solana.com/tx/${result.signature}?cluster=devnet`,
            },
          };
        }

        lastError = result.error ?? 'Unknown error';
        if (!result.retryable) break;
      }

      if (lastError.includes('429') || lastError.includes('airdrop limit')) {
        return {
          success: false,
          error: `Devnet airdrop rate limit reached. The Solana devnet faucet limits how often you can request SOL. Try again in a few minutes, or visit https://faucet.solana.com to get test SOL manually.`,
        };
      }

      return {
        success: false,
        error: `Airdrop failed after retries: ${lastError}. The Solana devnet can be unreliable — try again in a moment.`,
      };
    } catch (err) {
      return {
        success: false,
        error: `Airdrop request failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  },
});
