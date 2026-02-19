import { Keypair } from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';
import { randomBytes } from 'crypto';

const SOLANA_BIP44_PURPOSE = 44;
const SOLANA_COIN_TYPE = 501;

export interface DerivedWallet {
  publicKey: string;
  derivationPath: string;
  index: number;
}

const buildDerivationPath = (accountIndex: number): string =>
  `m/${SOLANA_BIP44_PURPOSE}'/${SOLANA_COIN_TYPE}'/${accountIndex}'/0'`;

export const deriveFromSeed = (seed: Uint8Array, accountIndex: number): DerivedWallet => {
  const path = buildDerivationPath(accountIndex);
  const seedHex = Buffer.from(seed).toString('hex');
  const { key } = derivePath(path, seedHex);
  const keypair = Keypair.fromSeed(key);

  return {
    publicKey: keypair.publicKey.toBase58(),
    derivationPath: path,
    index: accountIndex,
  };
};

export const deriveMultiple = (
  seed: Uint8Array,
  count: number,
  startIndex = 0,
): DerivedWallet[] =>
  Array.from({ length: count }, (_, i) => deriveFromSeed(seed, startIndex + i));

export const generateSeed = (): Uint8Array => randomBytes(32);

export const deriveKeypairFromSeed = (seed: Uint8Array, accountIndex: number): Keypair => {
  const path = buildDerivationPath(accountIndex);
  const seedHex = Buffer.from(seed).toString('hex');
  const { key } = derivePath(path, seedHex);
  return Keypair.fromSeed(key);
};
