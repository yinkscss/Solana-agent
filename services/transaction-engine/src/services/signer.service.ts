import { SigningFailedError } from '../types';

export interface SignerService {
  signTransaction: (walletId: string, transactionBase64: string) => Promise<string>;
}

export const createSignerService = (walletEngineUrl: string): SignerService => {
  const signTransaction = async (
    walletId: string,
    transactionBase64: string,
  ): Promise<string> => {
    const url = `${walletEngineUrl}/api/v1/wallets/${walletId}/sign`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction: transactionBase64 }),
      });
    } catch (err) {
      throw new SigningFailedError(
        `Wallet engine unreachable: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const message = (body as Record<string, unknown>)?.error
        ? JSON.stringify((body as Record<string, unknown>).error)
        : `HTTP ${response.status}`;
      throw new SigningFailedError(message);
    }

    const json = (await response.json()) as { data: { signature: string } };
    return json.data.signature;
  };

  return { signTransaction };
};
