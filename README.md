# SolAgent — Solana AI Agent Wallet Platform

SolAgent is an open-source platform that gives AI agents autonomous wallet capabilities on the Solana blockchain. It provides a complete microservices stack for creating wallets, enforcing transaction policies, executing swaps via DeFi protocols, and monitoring agent activity in real time — all running on devnet with no human intervention required.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Dashboard (Next.js)                           │
│                     http://localhost:3000                             │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────────┐
│                    API Gateway (port 8080)                            │
│             Rate limiting · API key auth · CORS · Proxy              │
└──┬──────────┬──────────┬──────────┬──────────┬──────────┬────────────┘
   │          │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼          ▼
┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────────┐
│Agent │  │Wallet│  │Policy│  │  TX  │  │ DeFi │  │Notifica- │
│Runtim│  │Engine│  │Engine│  │Engine│  │Integr│  │  tion     │
│ 3001 │  │ 3002 │  │ 3003 │  │ 3004 │  │ 3005 │  │   3006   │
└──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘  └────┬─────┘
   │         │         │         │         │            │
   └─────────┴─────────┴────┬────┴─────────┴────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   ┌─────────┐        ┌──────────┐         ┌──────────┐
   │PostgreSQL│        │  Redis   │         │ RedPanda │
   │  :5432   │        │  :6379   │         │  :9092   │
   └─────────┘        └──────────┘         └──────────┘
                                                 │
                            ┌────────────────────┘
                            ▼
                     ┌────────────┐
                     │    Kora    │
                     │  Relayer   │
                     │   :8911   │
                     └────────────┘
```

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.1+
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- Git

### 1. Clone and install

```bash
git clone https://github.com/your-org/solana-agent.git
cd solana-agent
bun install
```

### 2. Configure environment

```bash
cp .env.example .env
```

The defaults work for local development with Docker infrastructure. Edit `.env` to add optional keys (Helius, Turnkey) if needed.

### 3. Start infrastructure

```bash
bun run docker:up
```

This starts PostgreSQL, Redis, RedPanda, Kora relayer, and the observability stack (Prometheus, Grafana, Loki, Tempo).

### 4. Run database migrations

```bash
bun run db:migrate
bun run db:seed        # optional: seed sample data
```

### 5. Start all services

```bash
bun run dev
```

Services start on ports 3001–3006 with the API Gateway on 8080.

### 6. Run tests

```bash
bun run test           # unit + integration tests
bun run test:e2e       # end-to-end tests
```

### 7. Run devnet smoke test

```bash
bun run devnet:smoke
```

Creates a wallet on Solana devnet, airdrops SOL, executes legacy and versioned transactions, and queries Jupiter for a swap quote.

### 8. Run multi-agent demo

```bash
bun run devnet:multi-agent
```

Spins up 3 agent wallets, funds them via airdrop, and executes cross-agent transfers on devnet.

### 9. Open the dashboard

Navigate to [http://localhost:3000](http://localhost:3000) to view agents, wallets, transactions, and policies in the web UI.

## Project Structure

```
solana-agent/
├── apps/
│   ├── api-gateway/           # Hono reverse proxy — auth, rate limiting, routing
│   ├── dashboard/             # Next.js 16 web UI with shadcn/ui and Tailwind
│   └── mcp-server/            # Model Context Protocol server for AI tool integration
│
├── services/
│   ├── agent-runtime/         # Agent CRUD, LLM execution, tool registry
│   ├── wallet-engine/         # Wallet creation, balance tracking, signing
│   ├── policy-engine/         # Policy CRUD, transaction evaluation, rule enforcement
│   ├── transaction-engine/    # TX build → simulate → sign → submit → confirm pipeline
│   ├── defi-integration/      # Jupiter, Raydium, Orca, Marinade, Solend, Metaplex adapters
│   └── notification/          # WebSocket hub, webhook delivery, alert management
│
├── packages/
│   ├── common/                # Shared types, Zod schemas, error classes, constants
│   ├── db/                    # Drizzle ORM schema, migrations, connection management
│   ├── sdk/                   # Public TypeScript SDK (@solagent/sdk)
│   ├── events/                # Kafka/RedPanda client, event schemas, publisher
│   ├── observability/         # Prometheus metrics, structured logging, tracing
│   └── policy-rules/          # Policy rule evaluator interfaces and implementations
│
├── infrastructure/
│   ├── docker/                # Docker Compose for local dev (Postgres, Redis, RedPanda, Kora)
│   ├── kora/                  # Kora fee relayer configuration
│   ├── kubernetes/            # K8s deployment manifests
│   ├── observability/         # Prometheus, Grafana, Loki, Tempo configs
│   └── terraform/             # Infrastructure as code for cloud deployment
│
├── scripts/
│   ├── devnet-smoke-test.ts   # Single-wallet devnet verification
│   └── devnet-multi-agent.ts  # Multi-agent cross-transfer demo
│
├── tests/
│   ├── e2e/                   # End-to-end test suites
│   └── load/                  # k6 load testing scripts
│
├── SKILLS.md                  # AI agent reference guide
├── DEEP_DIVE.md               # Detailed architecture deep dive
└── bounty-description.md      # Bounty requirements
```

## API Reference

### Wallets (Wallet Engine — port 3002)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/wallets` | Create a new wallet |
| GET | `/api/v1/wallets/:walletId` | Get wallet details |
| GET | `/api/v1/wallets/:walletId/balance` | Get SOL balance |
| GET | `/api/v1/wallets/:walletId/tokens` | Get SPL token balances |
| POST | `/api/v1/wallets/:walletId/sign` | Sign a transaction |
| POST | `/api/v1/wallets/:walletId/recover` | Recover a wallet |
| DELETE | `/api/v1/wallets/:walletId` | Deactivate a wallet |
| GET | `/api/v1/agents/:agentId/wallets` | List wallets for an agent |

### Transactions (Transaction Engine — port 3004)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/transactions` | Create and submit a transaction |
| GET | `/api/v1/transactions/:txId` | Get transaction status |
| POST | `/api/v1/transactions/:txId/retry` | Retry a failed transaction |
| GET | `/api/v1/wallets/:walletId/transactions` | List wallet transactions |

### Policies (Policy Engine — port 3003)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/policies` | Create a policy |
| GET | `/api/v1/policies/:policyId` | Get policy details |
| PUT | `/api/v1/policies/:policyId` | Update a policy |
| DELETE | `/api/v1/policies/:policyId` | Deactivate a policy |
| POST | `/api/v1/policies/:policyId/activate` | Reactivate a policy |
| GET | `/api/v1/wallets/:walletId/policies` | List wallet policies |
| POST | `/api/v1/evaluate` | Evaluate a transaction against policies |

### DeFi (DeFi Integration — port 3005)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/defi/quote` | Get a swap quote |
| POST | `/api/v1/defi/swap` | Execute a token swap |
| POST | `/api/v1/defi/stake` | Stake SOL |
| POST | `/api/v1/defi/unstake` | Unstake SOL |
| GET | `/api/v1/defi/price/:mint` | Get token price |
| GET | `/api/v1/defi/protocols` | List supported protocols |
| GET | `/api/v1/defi/pools/:protocol/:poolId` | Get pool info |

### Agents (Agent Runtime — port 3001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/agents` | Create an agent |
| GET | `/api/v1/agents/:agentId` | Get agent details |
| PUT | `/api/v1/agents/:agentId` | Update agent configuration |
| POST | `/api/v1/agents/:agentId/start` | Start an agent |
| POST | `/api/v1/agents/:agentId/pause` | Pause an agent |
| POST | `/api/v1/agents/:agentId/stop` | Stop an agent |
| POST | `/api/v1/agents/:agentId/execute` | Execute an agent action |
| DELETE | `/api/v1/agents/:agentId` | Delete an agent |
| GET | `/api/v1/orgs/:orgId/agents` | List agents for an organization |

### Notifications (Notification Service — port 3006)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/webhooks` | Register a webhook |
| GET | `/api/v1/webhooks/:webhookId` | Get webhook details |
| PUT | `/api/v1/webhooks/:webhookId` | Update a webhook |
| DELETE | `/api/v1/webhooks/:webhookId` | Delete a webhook |
| POST | `/api/v1/alerts` | Create an alert rule |
| GET | `/api/v1/orgs/:orgId/alerts` | List organization alerts |
| WS | `/ws?orgId=...` | WebSocket stream for real-time events |

All endpoints are accessible through the API Gateway at `http://localhost:8080` with the same paths.

## Development

### Adding a new DeFi protocol adapter

1. Create a new file in `services/defi-integration/src/adapters/`
2. Implement the adapter interface (see existing Jupiter or Marinade adapters)
3. Register the adapter in the protocol registry
4. Add routes in the DeFi integration service

### Adding a new policy rule type

1. Define the rule schema in `packages/policy-rules/`
2. Implement the evaluator
3. Register the rule type in the policy engine

### Running individual services

```bash
bun run dev --filter=@solagent/wallet-engine
bun run dev --filter=@solagent/transaction-engine
```

### Running tests for a specific service

```bash
bun run test --filter=@solagent/wallet-engine
```

### Code formatting and linting

```bash
bun run format           # auto-format all files
bun run format:check     # check formatting
bun run lint             # run ESLint
bun run typecheck        # run TypeScript type checking
```

## Devnet Demo

The project includes two scripts that demonstrate autonomous wallet operations on Solana devnet.

### Smoke Test (`bun run devnet:smoke`)

Runs 9 sequential steps:

1. Connect to Solana devnet RPC
2. Generate a new wallet keypair
3. Airdrop 2 SOL from devnet faucet
4. Generate a recipient keypair
5. Send 0.1 SOL via legacy transaction
6. Verify sender and recipient balances
7. Fetch a Jupiter swap quote (SOL → USDC)
8. Send 0.05 SOL via versioned (V0) transaction
9. Print summary with transaction signatures and explorer links

### Multi-Agent Demo (`bun run devnet:multi-agent`)

Demonstrates 3 independent agents managing their own wallets:

1. Create 3 agent wallets
2. Airdrop 1 SOL to each agent
3. Agent 1 sends 0.1 SOL to Agent 2
4. Agent 2 sends 0.05 SOL to Agent 3
5. Print final balances and transaction links

Both scripts include retry logic for devnet airdrop rate limits and produce Solana Explorer links for every transaction.

## Security Considerations

- **Policy engine as mandatory gate** — Every transaction is evaluated against wallet policies before signing. The policy engine defaults to DENY if unreachable.
- **Key management** — Local provider stores keypairs in memory (never written to disk). Production deployments should use Turnkey HSM via the pluggable provider interface.
- **API authentication** — All requests require an `x-api-key` header. Keys are validated at the API Gateway.
- **Rate limiting** — Configurable requests-per-minute limit at the gateway level.
- **Sandboxed agent execution** — Agent tool code runs in a restricted environment without filesystem or unrestricted network access.
- **Event audit trail** — Every transaction, policy evaluation, and agent action is published to RedPanda for audit and replay.
- **No secrets in code** — All credentials are loaded from environment variables. The `.env.example` file documents required variables without including real values.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://solagent:dev_password@localhost:5432/solagent` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `REDPANDA_BROKERS` | `localhost:9092` | RedPanda/Kafka brokers |
| `SOLANA_RPC_URL` | `https://api.devnet.solana.com` | Solana RPC endpoint |
| `SOLANA_NETWORK` | `devnet` | Solana network |
| `KORA_URL` | `http://localhost:8911` | Kora fee relayer |
| `API_GATEWAY_PORT` | `8080` | Gateway port |
| `RATE_LIMIT_RPM` | `100` | Rate limit (requests/min) |
| `HELIUS_API_KEY` | — | Optional Helius RPC key |
| `TURNKEY_API_KEY` | — | Turnkey HSM API key |
| `TURNKEY_ORGANIZATION_ID` | — | Turnkey organization |
| `LOG_LEVEL` | `debug` | Logging verbosity |

## Observability

When running with Docker infrastructure, the following dashboards are available:

- **Grafana** — [http://localhost:3100](http://localhost:3100) — Pre-configured dashboards for all services
- **Prometheus** — [http://localhost:9090](http://localhost:9090) — Metrics queries
- **Loki** — Log aggregation (queried via Grafana)
- **Tempo** — Distributed tracing (queried via Grafana)

## License

MIT
