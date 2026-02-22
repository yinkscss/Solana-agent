# SolAgent Deep Dive — Agentic Wallet Architecture on Solana

## Introduction

AI agents that participate in DeFi need wallets they can control autonomously — creating keypairs, signing transactions, managing token balances, and interacting with on-chain protocols without waiting for a human to click "approve." SolAgent is a platform that provides these capabilities as a set of composable microservices, with a policy engine acting as a programmable guardrail between the agent's intent and on-chain execution.

This document explains the design decisions, security model, and interaction flows that make SolAgent work.

---

## 1. Wallet Design: Agentic Wallets vs. Regular Wallets

A regular Solana wallet (Phantom, Solflare) is designed around human interaction: the user sees a transaction, reviews the details, and clicks "Confirm." An agentic wallet inverts this model. The wallet holder is software — an AI agent — and every operation must be programmatic, fast, and auditable.

### Key Management

SolAgent uses a pluggable provider interface for key management with two implementations:

**LocalProvider** — Generates Ed25519 keypairs using `@solana/web3.js` `Keypair.generate()` and stores them in memory. The private key never touches the filesystem. This is ideal for development and demos: there is no setup required, wallets are created instantly, and the security boundary is the process itself. The tradeoff is obvious — if the process dies, the keys are gone. This is acceptable for devnet testing where wallets hold airdropped SOL with no real value.

**TurnkeyProvider** — Delegates key generation and signing to Turnkey's HSM (Hardware Security Module) infrastructure. The private key is generated inside the HSM and never leaves it. Signing requests are sent to Turnkey's API, which performs the cryptographic operation and returns the signature. This is the production path. The agent never has access to the raw private key — it can request signatures but cannot extract the key material.

The provider interface is straightforward: `createKeypair()`, `sign(message)`, `getPublicKey()`. Services that need wallet operations depend on this interface, not on a specific implementation, so switching from local to HSM is a configuration change — not a code change.

### HD Derivation

The wallet engine supports hierarchical deterministic (HD) derivation paths. A single seed can produce multiple wallets, each associated with a different agent. This matters for organizations running many agents: one root secret (stored securely) can derive all agent wallets deterministically, enabling recovery without backing up individual keypairs.

---

## 2. Security Considerations

Security in an agentic wallet system is fundamentally different from a human-operated wallet. There is no human in the loop to catch mistakes. The system must enforce safety constraints programmatically, and it must fail safely when any component is unavailable.

### Policy Engine as a Mandatory Gate

Every transaction in SolAgent passes through the policy engine before it reaches the signing step. The transaction engine sends a policy evaluation request containing the transaction type, destination, amount, and wallet ID. The policy engine loads all active policies for that wallet and evaluates each rule.

Policy rule types include:

- **Spending limits** — Daily aggregate caps and per-transaction caps, denominated in lamports. The policy engine tracks cumulative daily spend in Redis and rejects transactions that would exceed the limit.
- **Address allowlist/blocklist** — Allowlists restrict outbound transfers to pre-approved addresses. Blocklists reject transfers to known-bad addresses (e.g., flagged by on-chain analytics).
- **Program allowlist** — Restricts which Solana programs the wallet can interact with. An agent configured for DeFi trading might be allowed to interact with Jupiter and Raydium but blocked from calling arbitrary programs.
- **Time restrictions** — Limit transaction execution to specific time windows (e.g., only during market hours).
- **Rate limits** — Cap the number of transactions per time period, preventing runaway agents from draining wallets through rapid-fire transfers.
- **Human approval** — For high-value transactions above a threshold, the policy engine can flag the transaction as requiring manual approval via the dashboard.

The critical design principle: **the policy engine defaults to DENY**. If the policy engine is unreachable (network partition, crash, overloaded), the transaction engine will not proceed. This is a fail-secure default. An agent that cannot reach the policy engine cannot spend funds, which is safer than an agent that can spend funds without policy checks.

### Sandboxed Execution

Agent tool code (the functions an AI agent can call — check balance, transfer, swap) runs in a restricted execution environment. The sandbox blocks filesystem access and restricts network calls to only the internal service mesh. An agent cannot make arbitrary HTTP requests or read environment variables outside its scope. This limits the blast radius of a compromised or misbehaving agent.

### API Authentication and Rate Limiting

All external requests flow through the API Gateway, which validates the `x-api-key` header against stored API keys. Each key is scoped to an organization and carries rate-limit metadata. The gateway enforces requests-per-minute limits per key, returning HTTP 429 when exceeded. Request IDs are injected into every proxied request for end-to-end tracing.

---

## 3. Agent-Wallet Interaction Flow

### Standard Transaction Flow

When an agent decides to transfer SOL to another address, the following sequence executes:

1. **Agent Runtime** receives an execution request (either from an LLM decision or a direct API call).
2. The runtime calls the **Transaction Engine** with the transfer details: wallet ID, destination, amount, transaction type.
3. The Transaction Engine sends a **policy evaluation request** to the Policy Engine with the transaction parameters.
4. The Policy Engine loads all active policies for the wallet, evaluates each rule, and returns an `allowed: true/false` response with any violation details.
5. If denied, the Transaction Engine returns the violation to the agent. If allowed, it proceeds.
6. The Transaction Engine **builds the transaction** — constructing the appropriate Solana instruction (SystemProgram.transfer for SOL, Token.transfer for SPL tokens, or a program instruction for DeFi operations).
7. The transaction is **simulated** against the current Solana state to catch errors before spending fees.
8. If simulation succeeds, the Transaction Engine requests a **signature** from the Wallet Engine, which delegates to the configured key provider.
9. The signed transaction is **submitted** to the Solana RPC endpoint.
10. The Transaction Engine polls for **confirmation**, tracking the transaction through `processed → confirmed → finalized` states.
11. A `transaction.confirmed` event is published to RedPanda, which the Notification Service picks up and delivers via WebSocket and webhooks.

### Multi-Agent Isolation

Each agent has its own wallet(s) with its own policy set. Agent A's spending limits, allowlists, and rate limits are completely independent of Agent B's. The wallet engine enforces this isolation: a wallet belongs to exactly one agent, and signing requests are validated against the wallet's owner.

The multi-agent demo script illustrates this: three agents are created with independent wallets, each funded separately, and cross-agent transfers flow through the same policy and transaction pipeline as any other operation.

### Gasless Transactions via Kora

A practical challenge for agent wallets: to execute a transaction on Solana, you need SOL to pay the transaction fee (typically 5,000 lamports, or 0.000005 SOL). For newly created agent wallets that hold only SPL tokens, this creates a bootstrapping problem — the agent needs SOL to move its tokens.

SolAgent integrates with the Kora fee relayer to solve this. When a transaction is flagged for gasless execution:

1. The Transaction Engine builds the transaction with the agent's wallet as the signer but the Kora relayer as the fee payer.
2. The agent signs the transaction (authorizing the transfer/swap).
3. The partially-signed transaction is sent to Kora, which adds its own signature as fee payer and submits it to the network.
4. The Kora relayer pays the transaction fee. The agent's wallet only needs the tokens it wants to move.

This is particularly useful for DeFi operations where an agent holds USDC or another SPL token and wants to swap without maintaining a separate SOL balance for fees.

---

## 4. Architecture Decisions

### Why Microservices

SolAgent splits functionality into six backend services plus a gateway. The primary reasons:

**Independent scaling** — The transaction engine and DeFi integration service handle the most RPC calls and compute. During high-volume trading, these can be scaled horizontally without adding capacity to the policy engine or notification service.

**Failure isolation** — If the DeFi integration service crashes (e.g., Jupiter API returns unexpected data), wallets, policies, and basic transfers continue to work. The blast radius of any single failure is contained to one domain.

**Team parallelism** — Each service has a clear boundary and can be developed, tested, and deployed independently. The Turborepo monorepo structure with workspace packages enforces this separation while sharing types and utilities.

### Why Hono

Hono is a lightweight web framework that runs natively on Bun with near-zero overhead. Compared to Express, it starts faster, uses less memory, and supports the Web Standard Request/Response API. For microservices that primarily proxy requests and call other services, the framework should add minimal latency — Hono's router is one of the fastest available.

### Why Event-Driven (RedPanda)

Every significant action in SolAgent — wallet creation, policy evaluation, transaction submission, agent state change — publishes an event to RedPanda (a Kafka-compatible streaming platform). This serves three purposes:

1. **Audit trail** — Every action is recorded in an immutable, ordered log. For a financial system, this is non-negotiable.
2. **Decoupled consumers** — The notification service consumes events to deliver webhooks and WebSocket updates without the transaction engine knowing or caring about notification delivery.
3. **Replay and debugging** — Events can be replayed to reconstruct system state at any point in time, which is invaluable for debugging agent behavior or investigating policy violations.

RedPanda was chosen over Kafka for its simpler operational profile: single binary, no JVM dependency, and Kafka API compatibility.

### Why In-Memory Stores for Development

The wallet engine and agent runtime use in-memory stores by default. There is no database migration to run, no schema to understand, no connection string to configure. Running `bun run dev` starts working immediately. The PostgreSQL database (via Drizzle ORM) is available for durable storage when needed, but the barrier to a working demo is `bun install && bun run dev`.

---

## 5. Scalability

### Stateless Services

Every service in SolAgent is stateless — request state is either passed in the request body or looked up from shared infrastructure (PostgreSQL, Redis, RedPanda). This means any service instance can handle any request, enabling horizontal scaling behind a load balancer.

### Redis Caching

The wallet engine caches SOL and token balances in Redis with configurable TTLs. Balance lookups hit the Solana RPC only when the cache is stale. The transaction engine caches recent blockhashes (which are valid for ~60 seconds on Solana), reducing RPC calls for transaction construction. The policy engine caches active policy sets per wallet, refreshing on policy updates via event subscription.

### Priority Fee Estimation

During network congestion, Solana transactions with only the base fee may be delayed or dropped by validators. The transaction engine includes a priority fee estimator that queries recent fee data and adds a compute unit price sufficient to land transactions reliably. The fee is bounded by configurable limits to prevent runaway costs.

### Connection Pooling and Retry

Each service maintains a connection pool to the Solana RPC, avoiding the overhead of establishing new connections per request. The transaction engine implements exponential backoff retry for submission failures, with separate handling for transient errors (blockhash expired, node behind) versus permanent errors (insufficient balance, simulation failed). Retry attempts are logged and surfaced in the transaction status API.

### Observability at Scale

Prometheus metrics are exported from every service: request latency histograms, error rates, active WebSocket connections, policy evaluation durations, transaction signing times. Grafana dashboards provide real-time visibility, while Loki aggregates structured logs and Tempo traces requests across the service mesh. When running 100 agents with thousands of daily transactions, this observability stack is essential for identifying bottlenecks and degraded components.

---

## Conclusion

SolAgent demonstrates that autonomous AI agents can safely manage Solana wallets when the right guardrails are in place. The policy engine ensures every transaction is evaluated against programmable rules. The pluggable key management layer separates development convenience from production security. The event-driven architecture provides a complete audit trail. And the microservice design enables each component to scale and fail independently.

The platform runs end-to-end on devnet today: creating wallets, funding them via airdrop, executing transfers between agents, and querying DeFi protocols for swap quotes — all without human intervention and all verifiable on-chain.
