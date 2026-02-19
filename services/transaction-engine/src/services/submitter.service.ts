import { Connection } from '@solana/web3.js';
import type { SubmitOptions } from '../types';
import { SubmissionFailedError } from '../types';

export interface SubmitterService {
  submitTransaction: (signedTransactionBase64: string, opts?: SubmitOptions) => Promise<string>;
}

export const createSubmitterService = (
  connection: Connection,
  koraUrl: string,
  maxRetries: number,
): SubmitterService => {
  const submitViaRpc = async (rawBuffer: Buffer): Promise<string> => {
    const signature = await connection.sendRawTransaction(rawBuffer, {
      skipPreflight: true,
      maxRetries: 0,
    });
    return signature;
  };

  const submitViaKora = async (base64Tx: string): Promise<string> => {
    const response = await fetch(`${koraUrl}/api/v1/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction: base64Tx }),
    });

    if (!response.ok) {
      throw new SubmissionFailedError(`Kora returned HTTP ${response.status}`);
    }

    const json = (await response.json()) as { signature: string };
    return json.signature;
  };

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const submitTransaction = async (
    signedTransactionBase64: string,
    opts?: SubmitOptions,
  ): Promise<string> => {
    const useGasless = opts?.gasless ?? false;
    const retryLimit = opts?.maxRetries ?? maxRetries;
    const rawBuffer = Buffer.from(signedTransactionBase64, 'base64');

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retryLimit; attempt++) {
      try {
        if (useGasless) {
          return await submitViaKora(signedTransactionBase64);
        }
        return await submitViaRpc(rawBuffer);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt >= retryLimit) break;

        const delay = 100 * Math.pow(2, attempt);
        await sleep(delay);
      }
    }

    throw new SubmissionFailedError(
      lastError?.message ?? 'Max retries exceeded',
    );
  };

  return { submitTransaction };
};
