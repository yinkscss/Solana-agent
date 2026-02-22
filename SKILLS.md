# SolAgent — Skills for AI Agents

## What This Project Does

SolAgent is a platform that gives AI agents autonomous wallet capabilities on Solana. Agents can create wallets, hold tokens, execute transactions, and interact with DeFi protocols — all without human intervention. Every transaction passes through a policy engine that enforces spending limits, allowlists, and rate limits before execution.

## Architecture Overview

| Service | Port | Purpose |
|---------|------|---------|
| API Gateway | 8080 | Rate-limited, authenticated reverse proxy — single entry point |
| Agent Runtime | 3001 | Manages AI agent lifecycle with LangChain, Vercel AI SDK, Eliza adapters |
| Wallet Engine | 3002 | Creates and manages Solana wallets (local keypair or Turnkey HSM) |
| Policy Engine | 3003 | Evaluates spending limits, allowlists, blocklists before any transaction |
| Transaction Engine | 3004 | Builds, simulates, signs, and submits transactions with retry logic |
| DeFi Integration | 3005 | Protocol adapters for Jupiter, Raydium, Orca, Marinade, Solend, Metaplex |
| Notification Service | 3006 | WebSocket + webhook real-time events |

Infrastructure: PostgreSQL (storage), Redis (caching), RedPanda (event streaming), Kora (gasless tx relayer).

## How to Use as an Agent

All requests go through the API Gateway at `http://localhost:8080`. Include your API key in the `x-api-key` header.

### Create a Wallet

```
POST /api/v1/wallets
{
  "agentId": "your-agent-id",
  "label": "trading-wallet",
  "provider": "local"
}
```

Response: `{ "id": "wallet-id", "address": "SoLaNaPuBkEy...", "provider": "local" }`

### Check Balance

```
GET /api/v1/wallets/{walletId}/balance
```

Response: `{ "lamports": 2000000000, "sol": 2.0 }`

### Get Token Balances

```
GET /api/v1/wallets/{walletId}/tokens
```

### Send SOL

```
POST /api/v1/transactions
{
  "walletId": "...",
  "type": "transfer",
  "destination": "recipient-pubkey",
  "amount": "100000000"
}
```

The transaction engine will: evaluate policies → build transaction → simulate → sign → submit → confirm.

### Swap Tokens (via Jupiter)

```
POST /api/v1/defi/swap
{
  "walletId": "...",
  "inputMint": "So11111111111111111111111111111111111111112",
  "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "amount": "1000000000",
  "slippageBps": 50
}
```

### Get a Swap Quote (no execution)

```
GET /api/v1/defi/quote?inputMint=So1...&outputMint=EPj...&amount=1000000000
```

### Stake SOL

```
POST /api/v1/defi/stake
{
  "walletId": "...",
  "protocol": "marinade",
  "amount": "1000000000"
}
```

### Get Token Price

```
GET /api/v1/defi/price/{mint}
```

### Policy Rules

Transactions are automatically checked against policies before execution. Policy types:

- **Spending limits** — daily and per-transaction caps in lamports
- **Address allowlist** — only send to approved addresses
- **Address blocklist** — reject sends to known-bad addresses
- **Program allowlist** — only interact with approved programs
- **Token allowlist** — only trade approved tokens
- **Time restrictions** — limit transactions to specific hours
- **Rate limits** — cap transaction frequency
- **Human approval** — require manual approval above thresholds

### Create a Policy

```
POST /api/v1/policies
{
  "walletId": "...",
  "name": "daily-limit",
  "rules": [
    { "type": "spending_limit", "params": { "dailyLimit": "5000000000", "perTxLimit": "1000000000" } }
  ]
}
```

### Evaluate a Transaction (dry run)

```
POST /api/v1/evaluate
{
  "walletId": "...",
  "type": "transfer",
  "destination": "...",
  "amount": "500000000"
}
```

Response: `{ "allowed": true, "violations": [] }`

### Agent Lifecycle

```
POST /api/v1/agents                      — Create agent
POST /api/v1/agents/{agentId}/start      — Start agent
POST /api/v1/agents/{agentId}/execute    — Execute an action
POST /api/v1/agents/{agentId}/pause      — Pause agent
POST /api/v1/agents/{agentId}/stop       — Stop agent
```

### Subscribe to Events

WebSocket: `ws://localhost:3006/ws?orgId=your-org`

Event topics: `agent.lifecycle`, `transaction.submitted`, `transaction.confirmed`, `policy.violation`, `wallet.balance`.

## SDK Usage

```typescript
import { SolAgentClient } from '@solagent/sdk';

const client = new SolAgentClient({
  baseUrl: 'http://localhost:8080',
  apiKey: 'your-key',
});

const wallet = await client.wallets.create({ agentId: 'agent-1', label: 'main' });
const balance = await client.wallets.getBalance(wallet.id);

const tx = await client.transactions.create({
  walletId: wallet.id,
  type: 'transfer',
  destination: 'recipient-pubkey',
  amount: '100000000',
});

const quote = await client.defi.quote({
  inputMint: 'So11111111111111111111111111111111111111112',
  outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  amount: '1000000000',
});

const swap = await client.defi.swap({ ...quote, walletId: wallet.id, slippageBps: 50 });
```

## Key Design Decisions

1. **Fail-secure** — Policy engine defaults to DENY if unreachable. No transaction goes through without policy approval.
2. **In-memory key storage** — Local provider keeps keypairs in memory for development. Use Turnkey HSM for production.
3. **Gasless transactions** — Kora fee relayer integration lets agents transact without holding SOL for gas.
4. **Sandboxed execution** — Agent tool code runs in a restricted environment (no filesystem, no network access beyond allowed endpoints).
5. **Event-driven audit trail** — Every action publishes to RedPanda topics for observability and replay.
6. **Microservice isolation** — Each service is independently deployable, scalable, and can fail without taking down the platform.

## Error Handling

All API errors follow this format:

```json
{
  "error": {
    "code": "POLICY_VIOLATION",
    "message": "Transaction exceeds daily spending limit",
    "details": { "limit": "5000000000", "spent": "4500000000", "requested": "1000000000" }
  }
}
```

Common error codes: `WALLET_NOT_FOUND`, `INSUFFICIENT_BALANCE`, `POLICY_VIOLATION`, `SIMULATION_FAILED`, `RATE_LIMITED`, `TRANSACTION_FAILED`.

## Running Locally

```bash
cp .env.example .env
bun install
bun run docker:up        # Start PostgreSQL, Redis, RedPanda, Kora
bun run dev              # Start all services
bun run devnet:smoke     # Verify devnet connectivity
```
