import { Connection, PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

export const createAtaService = (connection: Connection) => {
  const getATAAddress = async (
    walletPublicKey: string,
    mintAddress: string,
  ): Promise<string> => {
    const owner = new PublicKey(walletPublicKey);
    const mint = new PublicKey(mintAddress);
    const ata = await getAssociatedTokenAddress(mint, owner);
    return ata.toBase58();
  };

  const getOrCreateATA = async (
    walletPublicKey: string,
    mintAddress: string,
  ): Promise<{ address: string; instruction: unknown | null }> => {
    const owner = new PublicKey(walletPublicKey);
    const mint = new PublicKey(mintAddress);
    const ata = await getAssociatedTokenAddress(mint, owner);

    try {
      await getAccount(connection, ata);
      return { address: ata.toBase58(), instruction: null };
    } catch {
      const instruction = createAssociatedTokenAccountInstruction(
        owner,
        ata,
        owner,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      return { address: ata.toBase58(), instruction };
    }
  };

  return { getATAAddress, getOrCreateATA };
};

export type AtaService = ReturnType<typeof createAtaService>;
