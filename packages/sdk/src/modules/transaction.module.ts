import type { HttpClient } from "../http/http-client.js";
import { TimeoutError } from "../http/errors.js";
import type { CreateTransactionParams, Transaction } from "../types/index.js";

const TERMINAL_STATUSES = new Set(["confirmed", "permanently_failed"]);
const DEFAULT_POLL_INTERVAL = 2_000;
const DEFAULT_CONFIRMATION_TIMEOUT = 60_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class TransactionModule {
  constructor(private readonly http: HttpClient) {}

  create = async (params: CreateTransactionParams): Promise<Transaction> =>
    this.http.post<Transaction>("/api/v1/transactions", params);

  get = async (txId: string): Promise<Transaction> =>
    this.http.get<Transaction>(`/api/v1/transactions/${txId}`);

  listByWallet = async (walletId: string): Promise<Transaction[]> =>
    this.http.get<Transaction[]>(
      `/api/v1/wallets/${walletId}/transactions`,
    );

  retry = async (txId: string): Promise<Transaction> =>
    this.http.post<Transaction>(`/api/v1/transactions/${txId}/retry`);

  waitForConfirmation = async (
    txId: string,
    opts?: { timeout?: number; pollInterval?: number },
  ): Promise<Transaction> => {
    const timeout = opts?.timeout ?? DEFAULT_CONFIRMATION_TIMEOUT;
    const pollInterval = opts?.pollInterval ?? DEFAULT_POLL_INTERVAL;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const tx = await this.get(txId);
      if (TERMINAL_STATUSES.has(tx.status)) return tx;
      await sleep(Math.min(pollInterval, deadline - Date.now()));
    }

    throw new TimeoutError(
      `Transaction ${txId} was not confirmed within ${timeout}ms`,
    );
  };
}
