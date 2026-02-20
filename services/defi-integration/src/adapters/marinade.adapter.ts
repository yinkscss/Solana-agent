import type {
  DeFiProtocolAdapter,
  StakeParams,
  SerializedInstruction,
} from './adapter.interface';

const MARINADE_PROGRAM = 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD';
const MARINADE_STATE = '8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC';
const MSOL_MINT = 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So';

const encodeStakeData = (amount: string): string => {
  const buf = Buffer.alloc(12);
  buf.writeUInt8(0, 0);
  buf.writeBigUInt64LE(BigInt(amount), 4);
  return buf.toString('base64');
};

const encodeUnstakeData = (amount: string): string => {
  const buf = Buffer.alloc(12);
  buf.writeUInt8(1, 0);
  buf.writeBigUInt64LE(BigInt(amount), 4);
  return buf.toString('base64');
};

export const createMarinadeAdapter = (_rpcUrl: string): DeFiProtocolAdapter => ({
  name: 'marinade',
  programIds: [MARINADE_PROGRAM],

  async buildStakeInstructions(params: StakeParams): Promise<SerializedInstruction[]> {
    return [
      {
        programId: MARINADE_PROGRAM,
        keys: [
          { pubkey: MARINADE_STATE, isSigner: false, isWritable: true },
          { pubkey: MSOL_MINT, isSigner: false, isWritable: true },
          { pubkey: params.walletAddress, isSigner: true, isWritable: true },
          { pubkey: params.walletAddress, isSigner: false, isWritable: true },
          { pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: false },
          { pubkey: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', isSigner: false, isWritable: false },
        ],
        data: encodeStakeData(params.amount),
      },
    ];
  },

  async buildUnstakeInstructions(params: StakeParams): Promise<SerializedInstruction[]> {
    return [
      {
        programId: MARINADE_PROGRAM,
        keys: [
          { pubkey: MARINADE_STATE, isSigner: false, isWritable: true },
          { pubkey: MSOL_MINT, isSigner: false, isWritable: true },
          { pubkey: params.walletAddress, isSigner: true, isWritable: true },
          { pubkey: params.walletAddress, isSigner: false, isWritable: true },
          { pubkey: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', isSigner: false, isWritable: false },
          { pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: false },
        ],
        data: encodeUnstakeData(params.amount),
      },
    ];
  },
});
