import { z } from 'zod';
import type { Tool } from './tool.interface.js';
import type { ToolResult } from '../types/index.js';

const getTransactionsParams = z.object({
  walletId: z.string().describe('The wallet ID (UUID) to get transaction history for'),
  page: z.number().optional().describe('Page number (default 1)'),
  pageSize: z.number().optional().describe('Number of transactions per page (default 10, max 50)'),
});

export const createGetTransactionsTool = (transactionEngineUrl: string): Tool => ({
  name: 'get_transactions',
  description:
    'Get transaction history for a wallet. Returns recent transfers, swaps, and other transactions with their status, amounts, and Solana Explorer links.',
  parameters: getTransactionsParams,

  async execute(params: unknown): Promise<ToolResult> {
    const parsed = getTransactionsParams.safeParse(params);
    if (!parsed.success) return { success: false, error: parsed.error.message };

    const { walletId, page = 1, pageSize = 10 } = parsed.data;

    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        pageSize: String(Math.min(pageSize, 50)),
      });

      const res = await fetch(
        `${transactionEngineUrl}/api/v1/wallets/${walletId}/transactions?${queryParams}`,
      );

      if (!res.ok) {
        const text = await res.text().catch(() => 'unknown');
        return { success: false, error: `Transaction engine error: ${res.status} ${text}` };
      }

      const data = await res.json();
      const transactions = data.data ?? data;

      if (!Array.isArray(transactions) || transactions.length === 0) {
        return {
          success: true,
          data: { transactions: [], message: 'No transactions found for this wallet.' },
        };
      }

      // Format transactions for the LLM to present nicely
      const formatted = transactions.map((tx: Record<string, unknown>) => ({
        type: tx.type,
        status: tx.status,
        signature: tx.signature ?? null,
        amount:
          tx.metadata && typeof tx.metadata === 'object'
            ? (tx.metadata as Record<string, unknown>).amount
            : null,
        token:
          tx.metadata && typeof tx.metadata === 'object'
            ? (tx.metadata as Record<string, unknown>).token
            : null,
        destination:
          tx.metadata && typeof tx.metadata === 'object'
            ? (tx.metadata as Record<string, unknown>).to
            : null,
        explorerUrl: tx.signature
          ? `https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`
          : null,
        date: tx.confirmedAt ?? tx.createdAt ?? null,
        error: tx.errorMessage ?? null,
      }));

      return {
        success: true,
        data: {
          transactions: formatted,
          total: transactions.length,
          page,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch transactions';
      return { success: false, error: message };
    }
  },
});
