import { describe, it, expect } from "vitest";
import { SolAgentClient } from "../src/client.js";

describe("SolAgentClient", () => {
  it("initializes with baseUrl (gateway mode)", () => {
    const client = SolAgentClient.create({
      baseUrl: "http://gateway:8080",
      apiKey: "test-key",
    });

    expect(client.wallets).toBeDefined();
    expect(client.policies).toBeDefined();
    expect(client.transactions).toBeDefined();
  });

  it("initializes with individual service URLs", () => {
    const client = new SolAgentClient({
      services: {
        walletEngine: "http://wallet:3002",
        policyEngine: "http://policy:3003",
        transactionEngine: "http://tx:3004",
      },
    });

    expect(client.wallets).toBeDefined();
    expect(client.policies).toBeDefined();
    expect(client.transactions).toBeDefined();
  });

  it("initializes with default service URLs when no config provided", () => {
    const client = SolAgentClient.create({});

    expect(client.wallets).toBeDefined();
    expect(client.policies).toBeDefined();
    expect(client.transactions).toBeDefined();
  });

  it("prefers baseUrl over individual service URLs", () => {
    const client = SolAgentClient.create({
      baseUrl: "http://gateway:8080",
      services: {
        walletEngine: "http://wallet:3002",
      },
    });

    expect(client.wallets).toBeDefined();
  });

  it("static create returns a SolAgentClient instance", () => {
    const client = SolAgentClient.create({ baseUrl: "http://localhost:8080" });
    expect(client).toBeInstanceOf(SolAgentClient);
  });
});
