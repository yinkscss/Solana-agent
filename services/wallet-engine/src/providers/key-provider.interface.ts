export interface WalletRef {
  id: string;
  publicKey: string;
  provider: string;
  providerRef: string;
}

export interface CreateWalletOpts {
  label: string;
  network: 'mainnet-beta' | 'devnet' | 'testnet';
}

export interface KeyProvider {
  readonly name: string;
  createWallet(opts: CreateWalletOpts): Promise<WalletRef>;
  getPublicKey(walletRef: WalletRef): Promise<string>;
  signTransaction(
    walletRef: WalletRef,
    transaction: Uint8Array,
  ): Promise<Uint8Array>;
  signMessage(walletRef: WalletRef, message: Uint8Array): Promise<Uint8Array>;
  exportWallet?(walletRef: WalletRef): Promise<Uint8Array>;
}

export interface TurnkeyConfig {
  apiKey: string;
  organizationId: string;
  privateKey: string;
}

export interface ProviderConfig {
  turnkey?: TurnkeyConfig;
}
