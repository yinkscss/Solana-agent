import { Connection } from '@solana/web3.js';
import type { Commitment } from '@solana/web3.js';
import type { ConfirmationResult } from '../types';

const POLL_INTERVAL_MS = 1000;

export interface ConfirmationService {
  waitForConfirmation: (
    signature: string,
    commitment?: Commitment,
    timeoutMs?: number,
  ) => Promise<ConfirmationResult>;
}

export const createConfirmationService = (
  connection: Connection,
  defaultTimeoutMs: number,
): ConfirmationService => {
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const waitForConfirmation = async (
    signature: string,
    commitment: Commitment = 'confirmed',
    timeoutMs?: number,
  ): Promise<ConfirmationResult> => {
    const timeout = timeoutMs ?? defaultTimeoutMs;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const status = await connection.getSignatureStatus(signature);
      const value = status?.value;

      if (value?.err) {
        return {
          confirmed: false,
          error: typeof value.err === 'string' ? value.err : JSON.stringify(value.err),
        };
      }

      if (value?.confirmationStatus === commitment || value?.confirmationStatus === 'finalized') {
        return { confirmed: true, slot: value.slot };
      }

      await sleep(POLL_INTERVAL_MS);
    }

    return { confirmed: false, error: 'Confirmation timeout' };
  };

  return { waitForConfirmation };
};
