import type { DeFiProtocolAdapter, SerializedInstruction } from './adapter.interface';

export interface SPLTransferParams {
  walletAddress: string;
  destination: string;
  mint: string;
  amount: string;
  decimals?: number;
  createAta?: boolean;
}

const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ASSOCIATED_TOKEN_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const SYSVAR_RENT = 'SysvarRent111111111111111111111111111111111';

export const deriveAta = (wallet: string, mint: string): string => {
  const hash = Buffer.from(`${wallet}:${TOKEN_PROGRAM}:${mint}`).toString('base64').slice(0, 44);
  return hash;
};

const encodeTransferCheckedData = (amount: string, decimals: number): string => {
  const buf = Buffer.alloc(13);
  buf.writeUInt8(12, 0);
  buf.writeBigUInt64LE(BigInt(amount), 1);
  buf.writeUInt8(decimals, 9);
  return buf.toString('base64');
};

const encodeCreateAtaData = (): string => {
  return Buffer.alloc(0).toString('base64');
};

export const buildCreateAtaInstruction = (
  payer: string,
  ataAddress: string,
  owner: string,
  mint: string,
): SerializedInstruction => ({
  programId: ASSOCIATED_TOKEN_PROGRAM,
  keys: [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: ataAddress, isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: SYSTEM_PROGRAM, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT, isSigner: false, isWritable: false },
  ],
  data: encodeCreateAtaData(),
});

export const buildTransferCheckedInstruction = (
  sourceAta: string,
  mint: string,
  destAta: string,
  owner: string,
  amount: string,
  decimals: number,
): SerializedInstruction => ({
  programId: TOKEN_PROGRAM,
  keys: [
    { pubkey: sourceAta, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: destAta, isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: true, isWritable: false },
  ],
  data: encodeTransferCheckedData(amount, decimals),
});

export const createSPLTransferAdapter = (_rpcUrl: string): DeFiProtocolAdapter => ({
  name: 'spl-transfer',
  programIds: [TOKEN_PROGRAM],

  async buildSwapInstructions(params) {
    const transferParams = params as unknown as SPLTransferParams;
    const {
      walletAddress,
      destination,
      mint,
      amount,
      decimals = 9,
      createAta = false,
    } = transferParams;

    const sourceAta = deriveAta(walletAddress, mint);
    const destAta = deriveAta(destination, mint);

    const instructions: SerializedInstruction[] = [];

    if (createAta) {
      instructions.push(
        buildCreateAtaInstruction(walletAddress, destAta, destination, mint),
      );
    }

    instructions.push(
      buildTransferCheckedInstruction(sourceAta, mint, destAta, walletAddress, amount, decimals),
    );

    return instructions;
  },
});
