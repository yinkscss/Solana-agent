import type {
  DeFiProtocolAdapter,
  LendingParams,
  SerializedInstruction,
} from './adapter.interface';
import { ExternalServiceError } from '../types';

const SOLEND_PROGRAM = 'So1endDq2YkqhipRh3WViPa8hFb7VassinFgsVo1u4';
const SOLEND_API = 'https://api.solend.fi/v1';

export const createSolendAdapter = (_rpcUrl: string): DeFiProtocolAdapter => ({
  name: 'solend',
  programIds: [SOLEND_PROGRAM],

  async buildSupplyInstructions(params: LendingParams): Promise<SerializedInstruction[]> {
    const res = await fetch(`${SOLEND_API}/instructions/supply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenMint: params.mint,
        amount: params.amount,
        userPublicKey: params.walletAddress,
      }),
    });

    if (!res.ok) {
      throw new ExternalServiceError('Solend', `Supply build failed: ${await res.text().catch(() => 'Unknown')}`);
    }

    const data = (await res.json()) as { instructions: SerializedInstruction[] };
    return data.instructions;
  },

  async buildBorrowInstructions(params: LendingParams): Promise<SerializedInstruction[]> {
    const res = await fetch(`${SOLEND_API}/instructions/borrow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenMint: params.mint,
        amount: params.amount,
        userPublicKey: params.walletAddress,
      }),
    });

    if (!res.ok) {
      throw new ExternalServiceError('Solend', `Borrow build failed: ${await res.text().catch(() => 'Unknown')}`);
    }

    const data = (await res.json()) as { instructions: SerializedInstruction[] };
    return data.instructions;
  },
});
