import type {
  DeFiProtocolAdapter,
  SerializedInstruction,
} from './adapter.interface';

const METAPLEX_PROGRAM = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const SYSVAR_RENT = 'SysvarRent111111111111111111111111111111111';

export interface MintNftParams {
  walletAddress: string;
  name: string;
  symbol: string;
  uri: string;
  mintAddress: string;
  metadataAddress: string;
}

export interface TransferNftParams {
  walletAddress: string;
  mintAddress: string;
  destinationAddress: string;
  tokenAccountSource: string;
  tokenAccountDest: string;
}

const encodeMintData = (name: string, symbol: string, uri: string): string => {
  const encoder = new TextEncoder();
  const nameBytes = encoder.encode(name);
  const symbolBytes = encoder.encode(symbol);
  const uriBytes = encoder.encode(uri);

  const buf = Buffer.alloc(1 + 4 + nameBytes.length + 4 + symbolBytes.length + 4 + uriBytes.length);
  let offset = 0;
  buf.writeUInt8(33, offset); offset += 1;
  buf.writeUInt32LE(nameBytes.length, offset); offset += 4;
  Buffer.from(nameBytes).copy(buf, offset); offset += nameBytes.length;
  buf.writeUInt32LE(symbolBytes.length, offset); offset += 4;
  Buffer.from(symbolBytes).copy(buf, offset); offset += symbolBytes.length;
  buf.writeUInt32LE(uriBytes.length, offset); offset += 4;
  Buffer.from(uriBytes).copy(buf, offset);
  return buf.toString('base64');
};

export const createMetaplexAdapter = (_rpcUrl: string): DeFiProtocolAdapter & {
  buildMintNftInstructions(params: MintNftParams): Promise<SerializedInstruction[]>;
  buildTransferNftInstructions(params: TransferNftParams): Promise<SerializedInstruction[]>;
} => ({
  name: 'metaplex',
  programIds: [METAPLEX_PROGRAM],

  async buildMintNftInstructions(params: MintNftParams): Promise<SerializedInstruction[]> {
    return [
      {
        programId: METAPLEX_PROGRAM,
        keys: [
          { pubkey: params.metadataAddress, isSigner: false, isWritable: true },
          { pubkey: params.mintAddress, isSigner: true, isWritable: true },
          { pubkey: params.walletAddress, isSigner: true, isWritable: true },
          { pubkey: params.walletAddress, isSigner: true, isWritable: false },
          { pubkey: params.walletAddress, isSigner: false, isWritable: false },
          { pubkey: SYSTEM_PROGRAM, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_RENT, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
        ],
        data: encodeMintData(params.name, params.symbol, params.uri),
      },
    ];
  },

  async buildTransferNftInstructions(params: TransferNftParams): Promise<SerializedInstruction[]> {
    const transferData = Buffer.alloc(9);
    transferData.writeUInt8(3, 0);
    transferData.writeBigUInt64LE(1n, 1);

    return [
      {
        programId: TOKEN_PROGRAM,
        keys: [
          { pubkey: params.tokenAccountSource, isSigner: false, isWritable: true },
          { pubkey: params.tokenAccountDest, isSigner: false, isWritable: true },
          { pubkey: params.walletAddress, isSigner: true, isWritable: false },
        ],
        data: transferData.toString('base64'),
      },
    ];
  },
});
