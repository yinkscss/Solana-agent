import { describe, it, expect } from 'vitest';
import {
  createSPLTransferAdapter,
  deriveAta,
  buildCreateAtaInstruction,
  buildTransferCheckedInstruction,
} from '../src/adapters/spl-transfer.adapter';
import type { SPLTransferParams } from '../src/adapters/spl-transfer.adapter';

const RPC_URL = 'https://api.devnet.solana.com';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ASSOCIATED_TOKEN_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';

const WALLET = 'WaLLet111111111111111111111111111111111111';
const DEST = 'DeSt222222222222222222222222222222222222222';
const MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

describe('SPL Transfer Adapter', () => {
  const adapter = createSPLTransferAdapter(RPC_URL);

  it('has correct name and programIds', () => {
    expect(adapter.name).toBe('spl-transfer');
    expect(adapter.programIds).toContain(TOKEN_PROGRAM);
  });

  it('builds transfer instruction without ATA creation', async () => {
    const params: SPLTransferParams = {
      walletAddress: WALLET,
      destination: DEST,
      mint: MINT,
      amount: '1000000',
      decimals: 6,
      createAta: false,
    };

    const instructions = await adapter.buildSwapInstructions!(params as any);

    expect(instructions).toHaveLength(1);
    expect(instructions[0]!.programId).toBe(TOKEN_PROGRAM);
    expect(instructions[0]!.keys).toHaveLength(4);
    expect(instructions[0]!.keys[3]!.pubkey).toBe(WALLET);
    expect(instructions[0]!.keys[3]!.isSigner).toBe(true);
  });

  it('builds ATA creation + transfer when createAta is true', async () => {
    const params: SPLTransferParams = {
      walletAddress: WALLET,
      destination: DEST,
      mint: MINT,
      amount: '1000000',
      decimals: 6,
      createAta: true,
    };

    const instructions = await adapter.buildSwapInstructions!(params as any);

    expect(instructions).toHaveLength(2);
    expect(instructions[0]!.programId).toBe(ASSOCIATED_TOKEN_PROGRAM);
    expect(instructions[1]!.programId).toBe(TOKEN_PROGRAM);
  });

  it('ATA creation instruction has correct keys', async () => {
    const params: SPLTransferParams = {
      walletAddress: WALLET,
      destination: DEST,
      mint: MINT,
      amount: '1000000',
      createAta: true,
    };

    const instructions = await adapter.buildSwapInstructions!(params as any);
    const ataIx = instructions[0]!;

    expect(ataIx.keys[0]!.pubkey).toBe(WALLET);
    expect(ataIx.keys[0]!.isSigner).toBe(true);
    expect(ataIx.keys[0]!.isWritable).toBe(true);

    expect(ataIx.keys[2]!.pubkey).toBe(DEST);
    expect(ataIx.keys[3]!.pubkey).toBe(MINT);
  });

  it('deriveAta produces deterministic results', () => {
    const ata1 = deriveAta(WALLET, MINT);
    const ata2 = deriveAta(WALLET, MINT);
    expect(ata1).toBe(ata2);

    const ata3 = deriveAta(DEST, MINT);
    expect(ata3).not.toBe(ata1);
  });

  it('transfer instruction encodes amount in data', async () => {
    const params: SPLTransferParams = {
      walletAddress: WALLET,
      destination: DEST,
      mint: MINT,
      amount: '500000',
      decimals: 6,
    };

    const instructions = await adapter.buildSwapInstructions!(params as any);
    expect(instructions[0]!.data).toBeTruthy();
    expect(typeof instructions[0]!.data).toBe('string');
  });

  it('defaults to 9 decimals when not specified', async () => {
    const params: SPLTransferParams = {
      walletAddress: WALLET,
      destination: DEST,
      mint: MINT,
      amount: '1000000000',
    };

    const instructions = await adapter.buildSwapInstructions!(params as any);
    expect(instructions).toHaveLength(1);
  });

  it('buildCreateAtaInstruction returns correct structure', () => {
    const destAta = deriveAta(DEST, MINT);
    const ix = buildCreateAtaInstruction(WALLET, destAta, DEST, MINT);

    expect(ix.programId).toBe(ASSOCIATED_TOKEN_PROGRAM);
    expect(ix.keys).toHaveLength(7);
    expect(ix.keys[0]!.pubkey).toBe(WALLET);
  });

  it('buildTransferCheckedInstruction returns correct structure', () => {
    const sourceAta = deriveAta(WALLET, MINT);
    const destAta = deriveAta(DEST, MINT);
    const ix = buildTransferCheckedInstruction(sourceAta, MINT, destAta, WALLET, '1000', 6);

    expect(ix.programId).toBe(TOKEN_PROGRAM);
    expect(ix.keys).toHaveLength(4);
    expect(ix.keys[0]!.pubkey).toBe(sourceAta);
    expect(ix.keys[1]!.pubkey).toBe(MINT);
    expect(ix.keys[2]!.pubkey).toBe(destAta);
    expect(ix.keys[3]!.pubkey).toBe(WALLET);
  });
});
