import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import type Redis from 'ioredis';

const BLOCKHASH_CACHE_KEY = 'tx-engine:recent-blockhash';
const BLOCKHASH_TTL_MS = 500;

export interface BuilderService {
  buildTransferTransaction: (from: string, to: string, lamports: bigint, recentBlockhash?: string) => Promise<Transaction>;
  buildTokenTransferTransaction: (from: string, to: string, mint: string, amount: bigint, recentBlockhash?: string) => Promise<Transaction>;
  buildCustomTransaction: (instructions: TransactionInstruction[], feePayer: string, recentBlockhash?: string) => Promise<Transaction>;
  getRecentBlockhash: () => Promise<string>;
}

export const createBuilderService = (
  connection: Connection,
  redis: Redis,
): BuilderService => {
  const getRecentBlockhash = async (): Promise<string> => {
    const cached = await redis.get(BLOCKHASH_CACHE_KEY);
    if (cached) return cached;

    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    await redis.set(BLOCKHASH_CACHE_KEY, blockhash, 'PX', BLOCKHASH_TTL_MS);
    return blockhash;
  };

  const buildTransferTransaction = async (
    from: string,
    to: string,
    lamports: bigint,
    recentBlockhash?: string,
  ): Promise<Transaction> => {
    const blockhash = recentBlockhash ?? await getRecentBlockhash();
    const tx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: new PublicKey(from),
    });

    tx.add(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(from),
        toPubkey: new PublicKey(to),
        lamports,
      }),
    );

    return tx;
  };

  const buildTokenTransferTransaction = async (
    from: string,
    to: string,
    mint: string,
    amount: bigint,
    recentBlockhash?: string,
  ): Promise<Transaction> => {
    const blockhash = recentBlockhash ?? await getRecentBlockhash();
    const fromPubkey = new PublicKey(from);
    const toPubkey = new PublicKey(to);
    const mintPubkey = new PublicKey(mint);

    const sourceAta = getAssociatedTokenAddressSync(mintPubkey, fromPubkey);
    const destAta = getAssociatedTokenAddressSync(mintPubkey, toPubkey);

    const tx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: fromPubkey,
    });

    tx.add(
      createTransferInstruction(sourceAta, destAta, fromPubkey, amount),
    );

    return tx;
  };

  const buildCustomTransaction = async (
    instructions: TransactionInstruction[],
    feePayer: string,
    recentBlockhash?: string,
  ): Promise<Transaction> => {
    const blockhash = recentBlockhash ?? await getRecentBlockhash();
    const tx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: new PublicKey(feePayer),
    });

    for (const ix of instructions) {
      tx.add(ix);
    }

    return tx;
  };

  return {
    buildTransferTransaction,
    buildTokenTransferTransaction,
    buildCustomTransaction,
    getRecentBlockhash,
  };
};
