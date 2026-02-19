import { Keypair } from '@solana/web3.js';
import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from 'crypto';
import type { KeyProvider, WalletRef } from '../providers/key-provider.interface';
import type { WalletRepository } from './wallet.service';
import type { WalletRecord } from '../types';

export interface ExportedWallet {
  version: 1;
  publicKey: string;
  encryptedKeyMaterial: string;
  keyProvider: string;
  network: string;
  exportedAt: string;
}

const SCRYPT_KEY_LEN = 32;
const SCRYPT_SALT_LEN = 16;
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;

const deriveKey = (passphrase: string, salt: Buffer): Buffer =>
  scryptSync(passphrase, salt, SCRYPT_KEY_LEN, { N: 16384, r: 8, p: 1 });

const encrypt = (plaintext: Uint8Array, passphrase: string): string => {
  const salt = randomBytes(SCRYPT_SALT_LEN);
  const key = deriveKey(passphrase, salt);
  const iv = randomBytes(IV_LEN);

  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, encrypted, authTag]).toString('base64');
};

const decrypt = (encoded: string, passphrase: string): Buffer => {
  const data = Buffer.from(encoded, 'base64');

  const salt = data.subarray(0, SCRYPT_SALT_LEN);
  const iv = data.subarray(SCRYPT_SALT_LEN, SCRYPT_SALT_LEN + IV_LEN);
  const authTag = data.subarray(data.length - AUTH_TAG_LEN);
  const ciphertext = data.subarray(SCRYPT_SALT_LEN + IV_LEN, data.length - AUTH_TAG_LEN);

  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
};

export const createImportExportService = (
  repo: WalletRepository,
  resolveProvider: (name: string) => KeyProvider,
) => {
  const exportWallet = async (
    walletId: string,
    passphrase: string,
  ): Promise<ExportedWallet> => {
    const wallet = await repo.findById(walletId);
    if (!wallet) throw new Error(`Wallet not found: ${walletId}`);

    const provider = resolveProvider(wallet.provider);
    if (!provider.exportWallet) {
      throw new Error(`Provider "${wallet.provider}" does not support key export`);
    }

    const walletRef: WalletRef = {
      id: wallet.id,
      publicKey: wallet.publicKey,
      provider: wallet.provider,
      providerRef: wallet.providerRef,
    };

    const keyMaterial = await provider.exportWallet(walletRef);
    const encryptedKeyMaterial = encrypt(keyMaterial, passphrase);

    return {
      version: 1,
      publicKey: wallet.publicKey,
      encryptedKeyMaterial,
      keyProvider: wallet.provider,
      network: wallet.network,
      exportedAt: new Date().toISOString(),
    };
  };

  const importWallet = async (
    exported: ExportedWallet,
    passphrase: string,
    agentId: string,
    label: string,
  ): Promise<string> => {
    const decryptedKey = decrypt(exported.encryptedKeyMaterial, passphrase);
    const keypair = Keypair.fromSecretKey(new Uint8Array(decryptedKey));
    const derivedPublicKey = keypair.publicKey.toBase58();

    if (derivedPublicKey !== exported.publicKey) {
      throw new Error('Decrypted key does not match the exported public key');
    }

    const record = await repo.insert({
      id: crypto.randomUUID(),
      agentId,
      publicKey: derivedPublicKey,
      provider: exported.keyProvider,
      providerRef: `imported-${crypto.randomUUID()}`,
      label,
      network: exported.network as WalletRecord['network'],
      status: 'active',
    });

    return record.id;
  };

  return { exportWallet, importWallet };
};

export type WalletImportExportService = ReturnType<typeof createImportExportService>;
