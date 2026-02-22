export interface WalletResolverService {
  getPublicKey(walletId: string): Promise<string>;
}

export const createWalletResolverService = (walletEngineUrl: string): WalletResolverService => {
  const cache = new Map<string, string>();

  const getPublicKey = async (walletId: string): Promise<string> => {
    const cached = cache.get(walletId);
    if (cached) return cached;

    const response = await fetch(`${walletEngineUrl}/api/v1/wallets/${walletId}`);
    if (!response.ok) {
      throw new Error(`Failed to resolve wallet ${walletId}: HTTP ${response.status}`);
    }
    const json = (await response.json()) as { data: { publicKey: string } };
    const publicKey = json.data.publicKey;
    cache.set(walletId, publicKey);
    return publicKey;
  };

  return { getPublicKey };
};
