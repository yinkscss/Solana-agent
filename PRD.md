# Product Requirements Document (PRD)
# Solana AI Agent Wallet Platform — "SolAgent"

> **Version**: 1.0  
> **Date**: February 2026  
> **Status**: Draft  
> **Author**: Engineering Team  
>
> **Related Documents**:  
> - [System Architecture](file:///Users/mac/Downloads/solana-agent/SYSTEM_ARCHITECTURE.md)  
> - [Implementation Plan](file:///Users/mac/Downloads/solana-agent/IMPLEMENTATION_PLAN.md)  
> - [Roadmap](file:///Users/mac/Downloads/solana-agent/ROADMAP.md)  
> - [Research Report](file:///Users/mac/.gemini/antigravity/brain/6b5de2e8-29f6-42ad-a989-657bf77558ec/solana_agentic_wallet_research.md)

---

## 1. Product Vision & Overview

### 1.1 Vision Statement

Build a **production-grade, non-custodial AI agent wallet platform** on Solana that enables autonomous AI agents to securely manage digital assets, execute on-chain transactions, interact with DeFi protocols, and operate within programmable policy guardrails — all while maintaining human oversight and enterprise-grade security.

### 1.2 Problem Statement

AI agents are emerging as autonomous economic participants. They need to:
- Hold and manage digital assets independently
- Execute transactions without constant human approval for routine operations
- Interact with DeFi protocols (swap, lend, stake, provide liquidity)
- Operate within strict security boundaries to prevent loss of funds
- Support gasless transactions for seamless UX

**Current gaps in the market:**
1. Most wallet solutions require human signing for every transaction
2. No unified framework combines agent logic + wallet security + policy engine + fee relaying
3. Existing solutions lack enterprise-grade observability and audit trails
4. Cross-protocol agent interactions are fragile and not standardized

### 1.3 Product Summary

**SolAgent** is a full-stack platform consisting of:

| Component | Description | See Architecture |
|---|---|---|
| **Agent Runtime** | Execution environment for AI agents with LLM integration | [§3.1](file:///Users/mac/Downloads/solana-agent/SYSTEM_ARCHITECTURE.md) |
| **Wallet Engine** | Non-custodial smart wallet with policy enforcement | [§3.2](file:///Users/mac/Downloads/solana-agent/SYSTEM_ARCHITECTURE.md) |
| **Policy Engine** | Programmable rules engine for transaction validation | [§3.3](file:///Users/mac/Downloads/solana-agent/SYSTEM_ARCHITECTURE.md) |
| **Fee Relayer** | Kora-based gasless transaction infrastructure | [§3.4](file:///Users/mac/Downloads/solana-agent/SYSTEM_ARCHITECTURE.md) |
| **Observability Stack** | Real-time monitoring, alerting, and audit logging | [§3.6](file:///Users/mac/Downloads/solana-agent/SYSTEM_ARCHITECTURE.md) |
| **Dashboard** | Web-based management console for operators | [§3.7](file:///Users/mac/Downloads/solana-agent/SYSTEM_ARCHITECTURE.md) |

---

## 2. Target Users & Personas

### 2.1 Primary Personas

| Persona | Description | Key Needs |
|---|---|---|
| **Agent Developer** | Builds autonomous AI agents that interact with Solana DeFi | SDK, docs, sandbox, policy templates |
| **Platform Operator** | Deploys and manages the SolAgent infrastructure | Dashboard, alerting, config management |
| **Enterprise Admin** | Oversees fleet of agents within an organization | Audit logs, compliance reports, RBAC |
| **End User** | Interacts with services powered by AI agents | Transparent agent actions, fund safety |

### 2.2 User Stories

#### Agent Developer Stories

| ID | Story | Priority | Phase |
|---|---|---|---|
| **US-001** | As a developer, I want to create an agent wallet with a single SDK call so I can onboard quickly | P0 | [Phase 1](file:///Users/mac/Downloads/solana-agent/ROADMAP.md) |
| **US-002** | As a developer, I want to define spending policies in code so my agent can't overspend | P0 | [Phase 1](file:///Users/mac/Downloads/solana-agent/ROADMAP.md) |
| **US-003** | As a developer, I want my agent to swap tokens on Jupiter without manual signing | P0 | [Phase 2](file:///Users/mac/Downloads/solana-agent/ROADMAP.md) |
| **US-004** | As a developer, I want to simulate transactions before execution to prevent failures | P0 | [Phase 1](file:///Users/mac/Downloads/solana-agent/ROADMAP.md) |
| **US-005** | As a developer, I want to integrate my agent with LangChain/Eliza frameworks | P1 | [Phase 2](file:///Users/mac/Downloads/solana-agent/ROADMAP.md) |
| **US-006** | As a developer, I want gasless transactions so agents don't need SOL for gas | P0 | [Phase 1](file:///Users/mac/Downloads/solana-agent/ROADMAP.md) |
| **US-007** | As a developer, I want webhook notifications for agent transaction events | P1 | [Phase 2](file:///Users/mac/Downloads/solana-agent/ROADMAP.md) |
| **US-008** | As a developer, I want MCP integration for standardized AI-blockchain communication | P1 | [Phase 3](file:///Users/mac/Downloads/solana-agent/ROADMAP.md) |

#### Platform Operator Stories

| ID | Story | Priority | Phase |
|---|---|---|---|
| **US-010** | As an operator, I want a dashboard to monitor all active agents and their wallets | P0 | [Phase 2](file:///Users/mac/Downloads/solana-agent/ROADMAP.md) |
| **US-011** | As an operator, I want to pause any agent instantly if suspicious activity is detected | P0 | [Phase 1](file:///Users/mac/Downloads/solana-agent/ROADMAP.md) |
| **US-012** | As an operator, I want automated SOL balance top-ups for the fee relayer | P1 | [Phase 2](file:///Users/mac/Downloads/solana-agent/ROADMAP.md) |
| **US-013** | As an operator, I want real-time alerts for policy violations and anomalies | P0 | [Phase 2](file:///Users/mac/Downloads/solana-agent/ROADMAP.md) |

#### Enterprise Admin Stories

| ID | Story | Priority | Phase |
|---|---|---|---|
| **US-020** | As an admin, I want complete audit logs of every agent transaction | P0 | [Phase 2](file:///Users/mac/Downloads/solana-agent/ROADMAP.md) |
| **US-021** | As an admin, I want RBAC to control who can create/modify agents and policies | P1 | [Phase 3](file:///Users/mac/Downloads/solana-agent/ROADMAP.md) |
| **US-022** | As an admin, I want compliance reporting for financial audits | P2 | [Phase 4](file:///Users/mac/Downloads/solana-agent/ROADMAP.md) |

---

## 3. Functional Requirements

### 3.1 Wallet Management (FR-100 Series)

| ID | Requirement | Details | Implements |
|---|---|---|---|
| **FR-101** | Wallet Creation | Create non-custodial Ed25519 wallets for agents via SDK/API | US-001 |
| **FR-102** | Dual-Key Architecture | Support owner key + agent key with separate permission scopes | US-002 |
| **FR-103** | Key Storage | Agent keys stored in TEE or managed by Turnkey/Crossmint — never in plaintext | US-001 |
| **FR-104** | Wallet Recovery | Owner key can recover/migrate wallet at any time | US-011 |
| **FR-105** | Multi-Wallet Support | A single agent can manage multiple wallets (e.g., trading vs. treasury) | US-003 |
| **FR-106** | Wallet Import/Export | Support importing existing wallets via base58-encoded private keys | US-001 |
| **FR-107** | HD Derivation | Support BIP-44 derivation path `m/44'/501'/0'/0'` for wallet hierarchies | US-001 |

### 3.2 Transaction Engine (FR-200 Series)

| ID | Requirement | Details | Implements |
|---|---|---|---|
| **FR-201** | Transaction Building | Compose Solana transactions with instruction-level granularity | US-003 |
| **FR-202** | Transaction Simulation | Pre-validate all transactions via `simulateTransaction` RPC call | US-004 |
| **FR-203** | Transaction Signing | Sign via TEE/MPC/Turnkey — never expose raw private keys | US-002 |
| **FR-204** | Transaction Submission | Submit via Helius RPC with retry logic and confirmation tracking | US-003 |
| **FR-205** | Batch Transactions | Support atomic batch transactions (Solana's native versioned transactions) | US-003 |
| **FR-206** | Priority Fees | Dynamic priority fee calculation based on network congestion | US-003 |
| **FR-207** | Gasless Transactions | Kora fee relayer integration for sponsor-paid gas | US-006 |

### 3.3 Policy Engine (FR-300 Series)

| ID | Requirement | Details | Implements |
|---|---|---|---|
| **FR-301** | Spending Limits | Per-transaction and per-time-window spending caps (SOL + tokens) | US-002 |
| **FR-302** | Program Allowlist | Restrict agent to interact only with approved program IDs | US-002 |
| **FR-303** | Token Allowlist | Restrict agent to operate only with approved token mints | US-002 |
| **FR-304** | Address Blocklist | Block transactions to known malicious or unapproved addresses | US-002 |
| **FR-305** | Time-Based Rules | Restrict operations to specific time windows or enforce cooldowns | US-002 |
| **FR-306** | Human-in-the-Loop | Require human approval for transactions exceeding risk thresholds | US-011 |
| **FR-307** | Policy Hot-Reload | Update policies without restarting agents | US-011 |
| **FR-308** | Policy Versioning | Track policy changes with full version history and rollback | US-020 |

### 3.4 DeFi Integration Module (FR-400 Series)

| ID | Requirement | Details | Implements |
|---|---|---|---|
| **FR-401** | Token Swaps | Integrate with Jupiter Aggregator for optimal swap routing | US-003 |
| **FR-402** | Liquidity Provision | Integrate with Raydium, Orca for LP position management | US-003 |
| **FR-403** | Staking | Native SOL staking and liquid staking (Marinade, Jito) | US-003 |
| **FR-404** | Lending/Borrowing | Integrate with Solend, MarginFi for lending protocols | US-003 |
| **FR-405** | NFT Operations | Mint, transfer, list NFTs via Metaplex | US-003 |
| **FR-406** | Token Transfers | SPL token transfers with ATA (Associated Token Account) auto-creation | US-003 |
| **FR-407** | Price Feeds | Real-time price data via Pyth Network oracle integration | US-003 |

### 3.5 Agent Runtime (FR-500 Series)

| ID | Requirement | Details | Implements |
|---|---|---|---|
| **FR-501** | LLM Integration | Support OpenAI, Anthropic, and local models via unified interface | US-005 |
| **FR-502** | Framework Adapters | Native adapters for LangChain, Eliza, Vercel AI SDK | US-005 |
| **FR-503** | MCP Server | Model Context Protocol server for standardized AI-blockchain comms | US-008 |
| **FR-504** | Tool Registration | Dynamic tool/function registration for agent capabilities | US-005 |
| **FR-505** | State Management | Persistent agent state with conversation history and context | US-005 |
| **FR-506** | Multi-Agent Orchestration | Support for multi-agent workflows with shared and isolated wallets | US-005 |
| **FR-507** | Agent Lifecycle | Start, pause, resume, stop, and destroy agent instances | US-011 |

### 3.6 Observability & Audit (FR-600 Series)

| ID | Requirement | Details | Implements |
|---|---|---|---|
| **FR-601** | Transaction Logging | Immutable log of every transaction attempt (success/fail/rejected) | US-020 |
| **FR-602** | Policy Audit Trail | Log every policy evaluation with decision rationale | US-020 |
| **FR-603** | Real-Time Metrics | Agent count, TPS, success rate, latency percentiles | US-010 |
| **FR-604** | Alerting | Configurable alerts for anomalies, policy violations, low balances | US-013 |
| **FR-605** | Dashboard | Web UI for monitoring agents, wallets, transactions, policies | US-010 |
| **FR-606** | Compliance Export | Export audit data in CSV/JSON for financial compliance | US-022 |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| Metric | Target | Rationale |
|---|---|---|
| Transaction signing latency | <100ms (p99) | Competitive with Turnkey benchmarks |
| Transaction simulation latency | <200ms (p99) | Must not bottleneck agent decision loops |
| API response time | <50ms (p95) | SDK calls must feel instantaneous |
| Concurrent agents | 10,000+ per node | Enterprise-scale workloads |
| Throughput | 5,000 TPS sustained | Match Solana's throughput capacity |

### 4.2 Reliability

| Metric | Target |
|---|---|
| Uptime | 99.95% (26 min downtime/month) |
| Transaction delivery | 99.9% (with retry logic) |
| Data durability | 99.999999999% (11 nines, via S3-class storage) |
| Recovery Time Objective (RTO) | <5 minutes |
| Recovery Point Objective (RPO) | <30 seconds |

### 4.3 Security

| Requirement | Standard |
|---|---|
| Key management | FIPS 140-2 Level 3 (via TEE/HSM) |
| Data encryption at rest | AES-256 |
| Data encryption in transit | TLS 1.3 |
| Authentication | OAuth 2.0 + API keys with HMAC signing |
| Authorization | RBAC with least-privilege principle |
| Audit logging | Tamper-evident, append-only logs |
| Penetration testing | Quarterly, by third-party firm |
| SOC 2 Type II | Target by Phase 4 |

### 4.4 Scalability

| Dimension | Strategy |
|---|---|
| Horizontal scaling | Stateless services behind load balancer |
| Database scaling | Read replicas + partitioning by agent ID |
| Event streaming | Kafka/Redpanda with topic-per-agent partitioning |
| Caching | Redis cluster for policy evaluation cache |

---

## 5. Technology Stack

### 5.1 Core Platform

| Layer | Technology | Version | Purpose | Reference |
|---|---|---|---|---|
| **Language (Backend)** | TypeScript / Node.js | v22 LTS | Agent runtime, API server | [nodejs.org](https://nodejs.org/) |
| **Language (Smart Contracts)** | Rust | 1.75+ | Solana programs (Anchor framework) | [rust-lang.org](https://www.rust-lang.org/) |
| **Runtime** | Bun | 1.1+ | Fast JS runtime for agent execution | [bun.sh](https://bun.sh/) |
| **API Framework** | Hono | 4.x | Lightweight, edge-compatible HTTP framework | [hono.dev](https://hono.dev/) |
| **Validation** | Zod | 3.x | Runtime type validation for API inputs & policies | [github.com/colinhacks/zod](https://github.com/colinhacks/zod) |

### 5.2 Solana & Blockchain

| Component | Technology | Version | Purpose | Reference |
|---|---|---|---|---|
| **Solana SDK** | @solana/web3.js | 2.x | Core Solana interactions | [github.com/solana-labs/solana-web3.js](https://github.com/solana-labs/solana-web3.js) |
| **Token SDK** | @solana/spl-token | 0.4.x | SPL token operations | [github.com/solana-labs/solana-program-library](https://github.com/solana-labs/solana-program-library) |
| **Smart Contract Framework** | Anchor | 0.30.x | Solana program development framework | [github.com/coral-xyz/anchor](https://github.com/coral-xyz/anchor) |
| **Fee Relayer** | Kora | latest | Gasless transaction infrastructure | [github.com/solana-foundation/kora](https://github.com/solana-foundation/kora) |
| **RPC Provider** | Helius | API v1 | Enhanced RPC, DAS API, webhooks | [docs.helius.dev](https://docs.helius.dev/) |
| **Price Oracle** | Pyth Network | latest | Real-time price feeds | [github.com/pyth-network/pyth-sdk-solana](https://github.com/pyth-network/pyth-sdk-solana) |

### 5.3 DeFi Protocol SDKs

| Protocol | SDK/Package | Purpose | Reference |
|---|---|---|---|
| **Jupiter** | @jup-ag/api | Token swap aggregation | [github.com/jup-ag/jupiter-quote-api](https://github.com/jup-ag/jupiter-quote-api) |
| **Raydium** | @raydium-io/raydium-sdk-v2 | AMM swaps & LP | [github.com/raydium-io/raydium-sdk-V2](https://github.com/raydium-io/raydium-sdk-V2) |
| **Orca** | @orca-so/whirlpools-sdk | Concentrated liquidity | [github.com/orca-so/whirlpools](https://github.com/orca-so/whirlpools) |
| **Marinade** | @marinade.finance/marinade-ts-sdk | Liquid staking | [github.com/marinade-finance/marinade-ts-sdk](https://github.com/marinade-finance/marinade-ts-sdk) |
| **Metaplex** | @metaplex-foundation/js | NFT operations | [github.com/metaplex-foundation/js](https://github.com/metaplex-foundation/js) |
| **Solend** | @solendprotocol/solend-sdk | Lending/borrowing | [github.com/solendprotocol/solend-sdk](https://github.com/solendprotocol/solend-sdk) |

### 5.4 AI & Agent Frameworks

| Component | Technology | Purpose | Reference |
|---|---|---|---|
| **Agent Kit** | SendAI Solana Agent Kit | Solana-native agent framework | [github.com/sendaifun/solana-agent-kit](https://github.com/sendaifun/solana-agent-kit) |
| **LLM Framework** | LangChain.js | Agent orchestration & tool use | [github.com/langchain-ai/langchainjs](https://github.com/langchain-ai/langchainjs) |
| **Agent Framework** | Eliza | Multi-agent system | [github.com/elizaOS/eliza](https://github.com/elizaOS/eliza) |
| **AI SDK** | Vercel AI SDK | Streaming LLM integration | [github.com/vercel/ai](https://github.com/vercel/ai) |
| **MCP** | Model Context Protocol | Standardized AI-blockchain interface | [github.com/modelcontextprotocol](https://github.com/modelcontextprotocol) |

### 5.5 Key Management & Security

| Component | Technology | Purpose | Reference |
|---|---|---|---|
| **Key Infrastructure** | Turnkey | Hardware-backed key management with policy engine | [docs.turnkey.com](https://docs.turnkey.com/) |
| **Smart Wallets** | Crossmint | Non-custodial smart contract wallets for agents | [docs.crossmint.com](https://docs.crossmint.com/) |
| **Auth Provider** | Privy | Embedded wallet auth & server wallets | [docs.privy.io](https://docs.privy.io/) |
| **Secrets Management** | HashiCorp Vault | Runtime secrets injection | [vaultproject.io](https://www.vaultproject.io/) |
| **TEE Runtime** | AWS Nitro Enclaves | Trusted execution for agent keys | [aws.amazon.com/ec2/nitro/nitro-enclaves](https://aws.amazon.com/ec2/nitro/nitro-enclaves/) |

### 5.6 Infrastructure & Data

| Component | Technology | Purpose | Reference |
|---|---|---|---|
| **Primary Database** | PostgreSQL 16 | Transactional data, agent configs, policies | [postgresql.org](https://www.postgresql.org/) |
| **ORM** | Drizzle ORM | Type-safe database queries | [github.com/drizzle-team/drizzle-orm](https://github.com/drizzle-team/drizzle-orm) |
| **Cache** | Redis 7 (Valkey) | Policy cache, rate limiting, session state | [valkey.io](https://valkey.io/) |
| **Event Streaming** | Redpanda | Transaction event stream, audit log pipeline | [github.com/redpanda-data/redpanda](https://github.com/redpanda-data/redpanda) |
| **Object Storage** | S3 / R2 | Audit log archives, compliance exports | [aws.amazon.com/s3](https://aws.amazon.com/s3/) |
| **Search/Analytics** | ClickHouse | Transaction analytics and metrics aggregation | [github.com/ClickHouse/ClickHouse](https://github.com/ClickHouse/ClickHouse) |

### 5.7 DevOps & Observability

| Component | Technology | Purpose | Reference |
|---|---|---|---|
| **Containerization** | Docker | Service packaging | [docker.com](https://www.docker.com/) |
| **Orchestration** | Kubernetes (EKS) | Production deployment & auto-scaling | [kubernetes.io](https://kubernetes.io/) |
| **IaC** | Terraform | Infrastructure provisioning | [github.com/hashicorp/terraform](https://github.com/hashicorp/terraform) |
| **CI/CD** | GitHub Actions | Build, test, deploy pipelines | [github.com/features/actions](https://github.com/features/actions) |
| **Metrics** | Prometheus + Grafana | System and business metrics | [prometheus.io](https://prometheus.io/) |
| **Logging** | OpenTelemetry → Loki | Structured distributed logging | [opentelemetry.io](https://opentelemetry.io/) |
| **Tracing** | OpenTelemetry → Tempo | Distributed request tracing | [opentelemetry.io](https://opentelemetry.io/) |
| **Alerting** | PagerDuty / OpsGenie | Incident management | [pagerduty.com](https://www.pagerduty.com/) |

### 5.8 Frontend (Dashboard)

| Component | Technology | Purpose | Reference |
|---|---|---|---|
| **Framework** | Next.js 15 | Dashboard application | [github.com/vercel/next.js](https://github.com/vercel/next.js) |
| **UI Library** | shadcn/ui | Accessible component system | [github.com/shadcn-ui/ui](https://github.com/shadcn-ui/ui) |
| **Charts** | Recharts | Transaction/metrics visualizations | [github.com/recharts/recharts](https://github.com/recharts/recharts) |
| **State** | Zustand | Lightweight client state | [github.com/pmndrs/zustand](https://github.com/pmndrs/zustand) |
| **Data Fetching** | TanStack Query | Server state management with caching | [github.com/TanStack/query](https://github.com/TanStack/query) |

---

## 6. API Specification

### 6.1 REST API Endpoints

#### Wallet Management
```
POST   /api/v1/wallets                    # Create agent wallet
GET    /api/v1/wallets/:walletId          # Get wallet details
GET    /api/v1/wallets/:walletId/balance  # Get wallet balance
DELETE /api/v1/wallets/:walletId          # Deactivate wallet
POST   /api/v1/wallets/:walletId/recover  # Initiate wallet recovery
```

#### Transaction Engine
```
POST   /api/v1/transactions                      # Submit transaction
GET    /api/v1/transactions/:txId                 # Get transaction status
POST   /api/v1/transactions/simulate              # Simulate transaction
POST   /api/v1/transactions/batch                 # Submit batch transaction
GET    /api/v1/wallets/:walletId/transactions     # Transaction history
```

#### Policy Engine
```
POST   /api/v1/policies                   # Create policy
GET    /api/v1/policies/:policyId         # Get policy details
PUT    /api/v1/policies/:policyId         # Update policy
DELETE /api/v1/policies/:policyId         # Deactivate policy
GET    /api/v1/wallets/:walletId/policies # List wallet policies
POST   /api/v1/policies/:policyId/evaluate # Evaluate transaction against policy
```

#### Agent Management
```
POST   /api/v1/agents                     # Create agent instance
GET    /api/v1/agents/:agentId            # Get agent status
PUT    /api/v1/agents/:agentId/pause      # Pause agent
PUT    /api/v1/agents/:agentId/resume     # Resume agent
DELETE /api/v1/agents/:agentId            # Destroy agent
GET    /api/v1/agents/:agentId/logs       # Get agent activity logs
```

#### DeFi Operations
```
POST   /api/v1/defi/swap                  # Execute token swap
POST   /api/v1/defi/swap/quote            # Get swap quote
POST   /api/v1/defi/stake                 # Stake SOL/tokens
POST   /api/v1/defi/lend                  # Supply to lending pool
POST   /api/v1/defi/transfer              # Transfer tokens
```

### 6.2 WebSocket Events

```typescript
// Subscribe to agent events
ws.subscribe('agent:transaction:pending')
ws.subscribe('agent:transaction:confirmed')
ws.subscribe('agent:transaction:failed')
ws.subscribe('agent:policy:violation')
ws.subscribe('agent:balance:low')
ws.subscribe('agent:state:changed')
```

### 6.3 SDK Interface (TypeScript)

```typescript
import { SolAgent } from '@solagent/sdk';

// Initialize
const agent = new SolAgent({
  apiKey: process.env.SOLAGENT_API_KEY,
  network: 'mainnet-beta',
  keyProvider: 'turnkey', // or 'crossmint', 'privy', 'local'
});

// Create wallet with policy
const wallet = await agent.createWallet({
  name: 'trading-agent-01',
  policies: [{
    type: 'spending_limit',
    maxPerTransaction: '10 SOL',
    maxPerDay: '100 SOL',
  }, {
    type: 'program_allowlist',
    programs: ['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'], // Jupiter
  }],
});

// Execute DeFi operation
const swap = await agent.defi.swap({
  walletId: wallet.id,
  inputMint: 'So11111111111111111111111111111111111111112', // SOL
  outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  amount: '1000000000', // 1 SOL in lamports
  slippageBps: 50,
});
```

---

## 7. Data Models

### 7.1 Core Entities

```typescript
// Agent
interface Agent {
  id: string;                      // UUID v7
  name: string;
  status: 'active' | 'paused' | 'stopped' | 'error';
  ownerId: string;                 // FK to owner/org
  config: AgentConfig;
  walletIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Wallet
interface Wallet {
  id: string;                      // UUID v7
  agentId: string;                 // FK to Agent
  publicKey: string;               // Solana pubkey (base58)
  keyProvider: 'turnkey' | 'crossmint' | 'privy' | 'local';
  keyProviderId: string;           // External key reference
  network: 'mainnet-beta' | 'devnet' | 'testnet';
  label: string;
  status: 'active' | 'frozen' | 'recovering';
  createdAt: Date;
}

// Policy
interface Policy {
  id: string;                      // UUID v7
  walletId: string;                // FK to Wallet
  version: number;
  type: PolicyType;
  rules: PolicyRule[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type PolicyType =
  | 'spending_limit'
  | 'program_allowlist'
  | 'token_allowlist'
  | 'address_blocklist'
  | 'time_restriction'
  | 'human_approval'
  | 'rate_limit';

// Transaction Record
interface TransactionRecord {
  id: string;                      // UUID v7
  walletId: string;
  agentId: string;
  signature: string | null;        // Solana tx signature
  type: 'transfer' | 'swap' | 'stake' | 'lend' | 'nft' | 'custom';
  status: 'pending' | 'simulated' | 'signed' | 'submitted' | 'confirmed' | 'failed' | 'rejected';
  policyEvaluation: PolicyEvaluation;
  instructions: SerializedInstruction[];
  fee: number;                     // lamports
  gasless: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  confirmedAt: Date | null;
}

// Policy Evaluation (immutable audit record)
interface PolicyEvaluation {
  id: string;
  transactionId: string;
  policiesEvaluated: string[];     // Policy IDs
  decision: 'allow' | 'deny' | 'require_approval';
  reasons: string[];
  evaluatedAt: Date;
}
```

---

## 8. Security Requirements

> **Detailed implementation** → [System Architecture §5](file:///Users/mac/Downloads/solana-agent/SYSTEM_ARCHITECTURE.md)

### 8.1 Key Security Principles

1. **Zero Trust** — Every request is authenticated and authorized, internal or external
2. **Defense in Depth** — Multiple layers: TEE → Policy Engine → Rate Limiting → Monitoring
3. **Least Privilege** — Agents receive minimum permissions needed for their task
4. **Immutable Audit Trail** — Every transaction and policy decision is logged and tamper-evident
5. **Fail Secure** — On any error, default to denying transactions

### 8.2 Threat Matrix

| Threat | Impact | Likelihood | Mitigation | FR Reference |
|---|---|---|---|---|
| Key extraction from agent | Critical | Medium | TEE/MPC, no raw key access | FR-103 |
| Agent logic manipulation | Critical | Medium | Signed agent binaries, sandboxed runtime | FR-507 |
| Unauthorized fund drain | Critical | Low | Spending limits + allowlists | FR-301, FR-302 |
| Fee relayer SOL depletion | High | Medium | Balance monitoring + auto-top-up | FR-207 |
| DeFi protocol exploit | High | Medium | Program allowlist + simulation | FR-202, FR-302 |
| Insider threat (operator) | High | Low | RBAC + audit logs + separation of duties | FR-601, US-021 |
| API key compromise | High | Medium | Key rotation, IP allowlisting, rate limits | FR-306 |

---

## 9. Success Metrics

### 9.1 Launch Metrics (Phase 1-2)

| Metric | Target | Measurement |
|---|---|---|
| Developer onboarding time | <30 minutes to first transaction | Time-to-first-tx tracking |
| SDK integration lines of code | <20 lines for basic agent | Code sample analysis |
| Transaction success rate | >99.5% | Transaction log analysis |
| Policy evaluation latency | <10ms (p99) | Prometheus metrics |

### 9.2 Growth Metrics (Phase 3-4)

| Metric | Target | Measurement |
|---|---|---|
| Monthly active agents | 1,000+ | Agent status tracking |
| Daily transaction volume | 100,000+ | Transaction log aggregation |
| Developer NPS | >50 | Quarterly survey |
| Platform uptime | 99.95% | Uptime monitoring |
| Zero security incidents | 0 critical incidents | Incident tracking |

---

## 10. Constraints & Assumptions

### 10.1 Constraints

- Must work within Solana's 1232-byte transaction size limit
- Must handle Solana's transaction expiry (blockhash TTL ~60-90 seconds)
- Must comply with Solana's compute unit limits per transaction (200K default, 1.4M max)
- Kora fee relayer requires operator SOL balance maintenance
- TEE availability limited to specific cloud providers (AWS Nitro, Azure SGX)

### 10.2 Assumptions

- Solana network maintains current performance characteristics
- Helius and Kora remain operational and supported
- LLM providers (OpenAI, Anthropic) maintain API stability
- DeFi protocol SDKs maintain backward compatibility
- Target deployment on AWS (primary) with GCP (DR)

---

## 11. Glossary

| Term | Definition |
|---|---|
| **TEE** | Trusted Execution Environment — hardware-isolated secure enclave |
| **MPC** | Multi-Party Computation — key splitting across multiple parties |
| **SPL Token** | Solana Program Library token standard |
| **ATA** | Associated Token Account — deterministic token account per wallet |
| **Lamports** | Smallest SOL unit (1 SOL = 1,000,000,000 lamports) |
| **Compute Units** | Solana's measure of transaction computational cost |
| **MCP** | Model Context Protocol — standardized AI-tool interface |
| **DAS API** | Digital Asset Standard API — Helius metadata API |
| **Priority Fee** | Additional fee to accelerate transaction inclusion |
| **Blockhash** | Recent block hash required for transaction validity |

---

## Appendix A: Reference Links

| Resource | URL |
|---|---|
| Solana Docs | [solana.com/docs](https://solana.com/docs) |
| Solana RPC API | [solana.com/docs/rpc](https://solana.com/docs/rpc) |
| Solana Web3.js | [github.com/solana-labs/solana-web3.js](https://github.com/solana-labs/solana-web3.js) |
| Anchor Framework | [github.com/coral-xyz/anchor](https://github.com/coral-xyz/anchor) |
| Kora Fee Relayer | [github.com/solana-foundation/kora](https://github.com/solana-foundation/kora) |
| Helius API | [docs.helius.dev](https://docs.helius.dev/) |
| SendAI Agent Kit | [github.com/sendaifun/solana-agent-kit](https://github.com/sendaifun/solana-agent-kit) |
| Jupiter API | [station.jup.ag/docs](https://station.jup.ag/docs) |
| Turnkey Docs | [docs.turnkey.com](https://docs.turnkey.com/) |
| Crossmint Docs | [docs.crossmint.com](https://docs.crossmint.com/) |
| Privy Docs | [docs.privy.io](https://docs.privy.io/) |
| Pyth Network | [pyth.network](https://pyth.network/) |
| LangChain.js | [github.com/langchain-ai/langchainjs](https://github.com/langchain-ai/langchainjs) |
| Eliza Framework | [github.com/elizaOS/eliza](https://github.com/elizaOS/eliza) |
| MCP Specification | [spec.modelcontextprotocol.io](https://spec.modelcontextprotocol.io/) |
