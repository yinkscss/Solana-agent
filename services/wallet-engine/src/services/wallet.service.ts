import type { KeyProvider } from '../providers/key-provider.interface';
import { createKeyProvider } from '../providers/provider-factory';
import { env } from '../config/env';
import type { SolanaNetwork, WalletRecord } from '../types';
import { WalletNotFoundError, WalletFrozenError, ProviderError } from '../types';

export interface WalletRepository {
  insert(record: Omit<WalletRecord, 'createdAt' | 'updatedAt'>): Promise<WalletRecord>;
  findById(id: string): Promise<WalletRecord | null>;
  findByPublicKey(publicKey: string): Promise<WalletRecord | null>;
  findByAgentId(agentId: string): Promise<WalletRecord[]>;
  findAll(opts: {
    page?: number;
    pageSize?: number;
  }): Promise<{ data: WalletRecord[]; total: number }>;
  updateStatus(id: string, status: WalletRecord['status']): Promise<WalletRecord | null>;
}

export const createWalletService = (repo: WalletRepository) => {
  const resolveProvider = (providerName: string): KeyProvider => {
    const config = {
      turnkey: env.TURNKEY_API_KEY
        ? {
            apiKey: env.TURNKEY_API_KEY,
            organizationId: env.TURNKEY_ORGANIZATION_ID ?? '',
            privateKey: env.TURNKEY_PRIVATE_KEY ?? '',
          }
        : undefined,
    };
    return createKeyProvider(providerName, config);
  };

  const createWallet = async (
    agentId: string,
    providerName: string | undefined,
    label: string,
    network?: SolanaNetwork,
  ): Promise<WalletRecord> => {
    const effectiveProvider = providerName ?? env.DEFAULT_KEY_PROVIDER;
    const effectiveNetwork = network ?? env.SOLANA_NETWORK;
    const provider = resolveProvider(effectiveProvider);

    const walletRef = await provider.createWallet({
      label,
      network: effectiveNetwork,
    });

    return repo.insert({
      id: walletRef.id,
      agentId,
      publicKey: walletRef.publicKey,
      provider: walletRef.provider,
      providerRef: walletRef.providerRef,
      label,
      network: effectiveNetwork,
      status: 'active',
    });
  };

  const getWallet = async (walletId: string): Promise<WalletRecord> => {
    const wallet = await repo.findById(walletId);
    if (!wallet) throw new WalletNotFoundError(walletId);
    return wallet;
  };

  const getWalletByPublicKey = async (publicKey: string): Promise<WalletRecord> => {
    const wallet = await repo.findByPublicKey(publicKey);
    if (!wallet) throw new WalletNotFoundError(publicKey);
    return wallet;
  };

  const getWalletsByAgent = async (agentId: string): Promise<WalletRecord[]> =>
    repo.findByAgentId(agentId);

  const deactivateWallet = async (walletId: string): Promise<WalletRecord> => {
    const updated = await repo.updateStatus(walletId, 'frozen');
    if (!updated) throw new WalletNotFoundError(walletId);
    return updated;
  };

  const recoverWallet = async (walletId: string): Promise<WalletRecord> => {
    const wallet = await getWallet(walletId);
    if (wallet.status !== 'frozen') {
      throw new ProviderError(wallet.provider, 'Only frozen wallets can be recovered');
    }
    const updated = await repo.updateStatus(walletId, 'recovering');
    if (!updated) throw new WalletNotFoundError(walletId);
    return updated;
  };

  const signTransaction = async (
    walletId: string,
    transactionBytes: Uint8Array,
  ): Promise<Uint8Array> => {
    const wallet = await getWallet(walletId);
    if (wallet.status === 'frozen') throw new WalletFrozenError(walletId);

    const provider = resolveProvider(wallet.provider);
    return provider.signTransaction(
      {
        id: wallet.id,
        publicKey: wallet.publicKey,
        provider: wallet.provider,
        providerRef: wallet.providerRef,
      },
      transactionBytes,
    );
  };

  const listWallets = async (opts: { page?: number; pageSize?: number } = {}) => repo.findAll(opts);

  return {
    createWallet,
    getWallet,
    getWalletByPublicKey,
    getWalletsByAgent,
    listWallets,
    deactivateWallet,
    recoverWallet,
    signTransaction,
  };
};

export type WalletService = ReturnType<typeof createWalletService>;
