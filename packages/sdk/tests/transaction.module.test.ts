import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SolAgentClient } from "../src/client.js";
import { TimeoutError } from "../src/http/errors.js";
import type { Transaction } from "../src/types/index.js";

const MOCK_TX: Transaction = {
  id: "tx-1",
  walletId: "wallet-1",
  type: "transfer",
  status: "pending",
  gasless: true,
  createdAt: "2026-01-01T00:00:00Z",
};

const mockFetch = vi.fn();

const createClient = () =>
  SolAgentClient.create({
    baseUrl: "http://localhost:3004",
    apiKey: "test-key",
    retries: 0,
  });

describe("TransactionModule", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("creates a transaction", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_TX), { status: 200 }),
    );

    const tx = await createClient().transactions.create({
      walletId: "wallet-1",
      type: "transfer",
      destination: "recipient-addr",
      amount: "100000000",
      tokenMint: "SOL",
      gasless: true,
    });

    expect(tx).toEqual(MOCK_TX);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3004/api/v1/transactions",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("gets a transaction by ID", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_TX), { status: 200 }),
    );

    const tx = await createClient().transactions.get("tx-1");

    expect(tx).toEqual(MOCK_TX);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3004/api/v1/transactions/tx-1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("lists transactions by wallet", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([MOCK_TX]), { status: 200 }),
    );

    const txs = await createClient().transactions.listByWallet("wallet-1");

    expect(txs).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3004/api/v1/wallets/wallet-1/transactions",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("retries a transaction", async () => {
    const retried = { ...MOCK_TX, status: "pending" };
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(retried), { status: 200 }),
    );

    const tx = await createClient().transactions.retry("tx-1");

    expect(tx.status).toBe("pending");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3004/api/v1/transactions/tx-1/retry",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("waits for confirmation — polls until confirmed", async () => {
    vi.useRealTimers();

    const pending = { ...MOCK_TX, status: "pending" };
    const confirmed = {
      ...MOCK_TX,
      status: "confirmed",
      signature: "5fJk...",
      confirmedAt: "2026-01-01T00:01:00Z",
    };

    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify(pending), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(confirmed), { status: 200 }),
      );

    const tx = await createClient().transactions.waitForConfirmation("tx-1", {
      pollInterval: 10,
      timeout: 5000,
    });

    expect(tx.status).toBe("confirmed");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("waits for confirmation — throws on timeout", async () => {
    vi.useRealTimers();

    mockFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ...MOCK_TX, status: "pending" }), {
          status: 200,
        }),
      ),
    );

    await expect(
      createClient().transactions.waitForConfirmation("tx-1", {
        timeout: 50,
        pollInterval: 10,
      }),
    ).rejects.toThrow(TimeoutError);
  });

  it("waits for confirmation — returns on permanently_failed", async () => {
    vi.useRealTimers();

    const failed = { ...MOCK_TX, status: "permanently_failed" };
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(failed), { status: 200 }),
    );

    const tx = await createClient().transactions.waitForConfirmation("tx-1", {
      pollInterval: 10,
      timeout: 5000,
    });

    expect(tx.status).toBe("permanently_failed");
  });
});
