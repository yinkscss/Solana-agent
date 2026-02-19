import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SolAgentClient } from "../src/client.js";
import type { Policy, PolicyEvaluation } from "../src/types/index.js";

const MOCK_POLICY: Policy = {
  id: "policy-1",
  walletId: "wallet-1",
  name: "Conservative",
  rules: [
    {
      type: "spending_limit",
      maxPerTransaction: "1000000000",
      maxPerWindow: "5000000000",
      windowDuration: 3600,
      tokenMint: "SOL",
    },
  ],
  version: 1,
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const MOCK_EVALUATION: PolicyEvaluation = {
  decision: "allow",
  reasons: [],
};

const mockFetch = vi.fn();

const createClient = () =>
  SolAgentClient.create({
    baseUrl: "http://localhost:3003",
    apiKey: "test-key",
    retries: 0,
  });

describe("PolicyModule", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a policy", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_POLICY), { status: 200 }),
    );

    const policy = await createClient().policies.create({
      walletId: "wallet-1",
      name: "Conservative",
      rules: MOCK_POLICY.rules,
    });

    expect(policy).toEqual(MOCK_POLICY);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3003/api/v1/policies",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("gets a policy by ID", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_POLICY), { status: 200 }),
    );

    const policy = await createClient().policies.get("policy-1");

    expect(policy).toEqual(MOCK_POLICY);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3003/api/v1/policies/policy-1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("updates a policy", async () => {
    const updated = { ...MOCK_POLICY, name: "Strict", version: 2 };
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(updated), { status: 200 }),
    );

    const policy = await createClient().policies.update("policy-1", {
      name: "Strict",
    });

    expect(policy.name).toBe("Strict");
    expect(policy.version).toBe(2);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3003/api/v1/policies/policy-1",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("deactivates a policy", async () => {
    const deactivated = { ...MOCK_POLICY, isActive: false };
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(deactivated), { status: 200 }),
    );

    const policy = await createClient().policies.deactivate("policy-1");

    expect(policy.isActive).toBe(false);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3003/api/v1/policies/policy-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("activates a policy", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_POLICY), { status: 200 }),
    );

    const policy = await createClient().policies.activate("policy-1");

    expect(policy.isActive).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3003/api/v1/policies/policy-1/activate",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("lists policies by wallet", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([MOCK_POLICY]), { status: 200 }),
    );

    const policies = await createClient().policies.listByWallet("wallet-1");

    expect(policies).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3003/api/v1/wallets/wallet-1/policies",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("evaluates a transaction against policies", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_EVALUATION), { status: 200 }),
    );

    const evaluation = await createClient().policies.evaluate({
      walletId: "wallet-1",
      amount: "100000000",
      tokenMint: "SOL",
      destinationAddress: "recipient-addr",
      programIds: ["11111111111111111111111111111111"],
    });

    expect(evaluation.decision).toBe("allow");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3003/api/v1/evaluate",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns deny evaluation with reasons", async () => {
    const denyEval: PolicyEvaluation = {
      decision: "deny",
      reasons: ["Exceeds spending limit"],
    };
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(denyEval), { status: 200 }),
    );

    const evaluation = await createClient().policies.evaluate({
      walletId: "wallet-1",
      amount: "999999999999",
      tokenMint: "SOL",
      destinationAddress: "recipient-addr",
      programIds: [],
    });

    expect(evaluation.decision).toBe("deny");
    expect(evaluation.reasons).toContain("Exceeds spending limit");
  });
});
