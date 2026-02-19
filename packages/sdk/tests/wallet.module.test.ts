import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SolAgentClient } from "../src/client.js";
import type { Wallet, WalletBalance, TokenBalance } from "../src/types/index.js";

const MOCK_WALLET: Wallet = {
  id: "wallet-1",
  agentId: "agent-1",
  publicKey: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  keyProvider: "turnkey",
  network: "devnet",
  label: "Trading Wallet",
  status: "active",
  createdAt: "2026-01-01T00:00:00Z",
};

const MOCK_BALANCE: WalletBalance = {
  balance: 1.5,
  lamports: "1500000000",
};

const MOCK_TOKENS: TokenBalance[] = [
  { mint: "So11111111111111111111111111111111111111112", amount: "1500000000", decimals: 9, uiAmount: 1.5 },
];

const mockFetch = vi.fn();

const createClient = () =>
  SolAgentClient.create({
    baseUrl: "http://localhost:3002",
    apiKey: "test-key",
    retries: 0,
  });

describe("WalletModule", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a wallet", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_WALLET), { status: 200 }),
    );

    const wallet = await createClient().wallets.create({
      agentId: "agent-1",
      label: "Trading Wallet",
      network: "devnet",
    });

    expect(wallet).toEqual(MOCK_WALLET);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3002/api/v1/wallets",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("gets a wallet by ID", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_WALLET), { status: 200 }),
    );

    const wallet = await createClient().wallets.get("wallet-1");

    expect(wallet).toEqual(MOCK_WALLET);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3002/api/v1/wallets/wallet-1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("gets wallet balance", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_BALANCE), { status: 200 }),
    );

    const balance = await createClient().wallets.getBalance("wallet-1");

    expect(balance).toEqual(MOCK_BALANCE);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3002/api/v1/wallets/wallet-1/balance",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("gets token balances", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_TOKENS), { status: 200 }),
    );

    const tokens = await createClient().wallets.getTokenBalances("wallet-1");

    expect(tokens).toEqual(MOCK_TOKENS);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3002/api/v1/wallets/wallet-1/tokens",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("deactivates a wallet", async () => {
    const frozen = { ...MOCK_WALLET, status: "frozen" };
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(frozen), { status: 200 }),
    );

    const wallet = await createClient().wallets.deactivate("wallet-1");

    expect(wallet.status).toBe("frozen");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3002/api/v1/wallets/wallet-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("recovers a wallet", async () => {
    const recovering = { ...MOCK_WALLET, status: "recovering" };
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(recovering), { status: 200 }),
    );

    const wallet = await createClient().wallets.recover("wallet-1");

    expect(wallet.status).toBe("recovering");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3002/api/v1/wallets/wallet-1/recover",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("lists wallets by agent", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([MOCK_WALLET]), { status: 200 }),
    );

    const wallets = await createClient().wallets.listByAgent("agent-1");

    expect(wallets).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3002/api/v1/agents/agent-1/wallets",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("throws WalletNotFoundError on 404", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ message: "Wallet not found", code: "NOT_FOUND" }),
        { status: 404 },
      ),
    );

    await expect(createClient().wallets.get("missing")).rejects.toThrow(
      "Wallet not found",
    );
  });

  it("sends X-API-Key header", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_WALLET), { status: 200 }),
    );

    await createClient().wallets.get("wallet-1");

    const [, init] = mockFetch.mock.calls[0]!;
    expect(init.headers["X-API-Key"]).toBe("test-key");
  });
});
