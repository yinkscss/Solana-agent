import { Keypair } from '@solana/web3.js';
import { nanoid } from 'nanoid';
import { sign } from 'tweetnacl';
import type { CreateWalletOpts, KeyProvider, WalletRef } from './key-provider.interface';
import { ProviderError } from '../types';

export class LocalProvider implements KeyProvider {
  readonly name = 'local';
  private readonly keypairs = new Map<string, Keypair>();

  createWallet = async (_opts: CreateWalletOpts): Promise<WalletRef> => {
    const keypair = Keypair.generate();
    const id = nanoid();
    this.keypairs.set(id, keypair);

    return {
      id,
      publicKey: keypair.publicKey.toBase58(),
      provider: this.name,
      providerRef: id,
    };
  };

  getPublicKey = async (walletRef: WalletRef): Promise<string> => {
    const keypair = this.resolveKeypair(walletRef);
    return keypair.publicKey.toBase58();
  };

  signTransaction = async (
    walletRef: WalletRef,
    transaction: Uint8Array,
  ): Promise<Uint8Array> => {
    const keypair = this.resolveKeypair(walletRef);
    return sign.detached(transaction, keypair.secretKey);
  };

  signMessage = async (
    walletRef: WalletRef,
    message: Uint8Array,
  ): Promise<Uint8Array> => {
    const keypair = this.resolveKeypair(walletRef);
    return sign.detached(message, keypair.secretKey);
  };

  exportWallet = async (walletRef: WalletRef): Promise<Uint8Array> => {
    const keypair = this.resolveKeypair(walletRef);
    return keypair.secretKey;
  };

  private resolveKeypair = (walletRef: WalletRef): Keypair => {
    const keypair = this.keypairs.get(walletRef.providerRef);
    if (!keypair) {
      throw new ProviderError(this.name, `Keypair not found for ref: ${walletRef.providerRef}`);
    }
    return keypair;
  };
}
