import { z } from 'zod';

export type SolanaNetwork = 'mainnet-beta' | 'devnet' | 'testnet';

export type WalletStatus = 'active' | 'frozen' | 'recovering';

export interface WalletRecord {
  id: string;
  agentId: string;
  publicKey: string;
  provider: string;
  providerRef: string;
  label: string;
  network: SolanaNetwork;
  status: WalletStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface BalanceInfo {
  walletId: string;
  publicKey: string;
  solBalance: number;
  lamports: bigint;
}

export interface TokenBalanceInfo {
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: number;
  ataAddress: string;
}

export const createWalletBodySchema = z.object({
  agentId: z.string().min(1),
  provider: z.enum(['local', 'turnkey', 'crossmint', 'privy']).optional(),
  label: z.string().min(1).max(128),
  network: z.enum(['mainnet-beta', 'devnet', 'testnet']).optional(),
});

export type CreateWalletBody = z.infer<typeof createWalletBodySchema>;

export const signTransactionBodySchema = z.object({
  transaction: z.string().min(1),
});

export type SignTransactionBody = z.infer<typeof signTransactionBodySchema>;

export class SolAgentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'SolAgentError';
  }
}

export class WalletNotFoundError extends SolAgentError {
  constructor(walletId: string) {
    super(`Wallet not found: ${walletId}`, 'WALLET_NOT_FOUND', 404);
  }
}

export class WalletFrozenError extends SolAgentError {
  constructor(walletId: string) {
    super(`Wallet is frozen: ${walletId}`, 'WALLET_FROZEN', 403);
  }
}

export class ProviderError extends SolAgentError {
  constructor(provider: string, message: string) {
    super(`Provider [${provider}] error: ${message}`, 'PROVIDER_ERROR', 502);
  }
}

export class ValidationError extends SolAgentError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}
