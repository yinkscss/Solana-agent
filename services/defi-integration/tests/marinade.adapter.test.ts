import { describe, it, expect } from 'vitest';
import { createMarinadeAdapter } from '../src/adapters/marinade.adapter';

const RPC_URL = 'https://api.devnet.solana.com';
const WALLET = '7v91N7iZ9mNicL8WfG6cgSCKyRXydQjLh6UYBWwm6y1Q';

describe('Marinade Adapter', () => {
  it('has correct name and program IDs', () => {
    const adapter = createMarinadeAdapter(RPC_URL);
    expect(adapter.name).toBe('marinade');
    expect(adapter.programIds).toContain('MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD');
  });

  it('builds stake instructions', async () => {
    const adapter = createMarinadeAdapter(RPC_URL);
    const instructions = await adapter.buildStakeInstructions!({
      walletAddress: WALLET,
      amount: '1000000000',
    });

    expect(instructions).toHaveLength(1);
    const ix = instructions[0]!;
    expect(ix.programId).toBe('MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD');
    expect(ix.keys.length).toBeGreaterThan(0);

    const signerKey = ix.keys.find((k) => k.pubkey === WALLET && k.isSigner);
    expect(signerKey).toBeTruthy();

    expect(ix.data).toBeTruthy();
    const buf = Buffer.from(ix.data, 'base64');
    expect(buf.readUInt8(0)).toBe(0);
  });

  it('builds unstake instructions', async () => {
    const adapter = createMarinadeAdapter(RPC_URL);
    const instructions = await adapter.buildUnstakeInstructions!({
      walletAddress: WALLET,
      amount: '500000000',
    });

    expect(instructions).toHaveLength(1);
    const ix = instructions[0]!;
    expect(ix.programId).toBe('MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD');

    const buf = Buffer.from(ix.data, 'base64');
    expect(buf.readUInt8(0)).toBe(1);
  });

  it('includes mSOL mint in stake instruction keys', async () => {
    const adapter = createMarinadeAdapter(RPC_URL);
    const instructions = await adapter.buildStakeInstructions!({
      walletAddress: WALLET,
      amount: '1000000000',
    });

    const msolKey = instructions[0]!.keys.find(
      (k) => k.pubkey === 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
    );
    expect(msolKey).toBeTruthy();
    expect(msolKey!.isWritable).toBe(true);
  });
});
