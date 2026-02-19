# @solagent/sdk

TypeScript SDK for the SolAgent platform — create wallets, enforce policies, and execute transactions on Solana through AI agents.

## Installation

```bash
bun add @solagent/sdk
```

## Quick Start

```typescript
import { SolAgentClient } from "@solagent/sdk";

const client = SolAgentClient.create({
  baseUrl: "http://localhost:8080",
  apiKey: "your-api-key",
});
```

## Usage

### Wallets

```typescript
// Create a wallet
const wallet = await client.wallets.create({
  agentId: "agent-uuid",
  label: "Trading Wallet",
  network: "devnet",
});

// Get balance
const { balance, lamports } = await client.wallets.getBalance(wallet.id);

// Get token balances
const tokens = await client.wallets.getTokenBalances(wallet.id);

// List wallets for an agent
const wallets = await client.wallets.listByAgent("agent-uuid");

// Deactivate (freeze) a wallet
await client.wallets.deactivate(wallet.id);

// Recover a wallet
await client.wallets.recover(wallet.id);
```

### Policies

```typescript
// Create a spending policy
const policy = await client.policies.create({
  walletId: wallet.id,
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
});

// Evaluate a transaction against policies
const evaluation = await client.policies.evaluate({
  walletId: wallet.id,
  amount: "100000000",
  tokenMint: "SOL",
  destinationAddress: "recipient-address",
  programIds: ["11111111111111111111111111111111"],
});

if (evaluation.decision === "deny") {
  console.log("Blocked:", evaluation.reasons);
}

// Update / activate / deactivate
await client.policies.update(policy.id, { name: "Strict" });
await client.policies.deactivate(policy.id);
await client.policies.activate(policy.id);
```

### Transactions

```typescript
// Execute a transfer
const tx = await client.transactions.create({
  walletId: wallet.id,
  type: "transfer",
  destination: "recipient-address",
  amount: "100000000",
  tokenMint: "SOL",
  gasless: true,
});

// Wait for on-chain confirmation
const confirmed = await client.transactions.waitForConfirmation(tx.id, {
  timeout: 60_000,
  pollInterval: 2_000,
});

// Retry a failed transaction
await client.transactions.retry(tx.id);

// List all transactions for a wallet
const history = await client.transactions.listByWallet(wallet.id);
```

## Configuration

```typescript
const client = SolAgentClient.create({
  // Gateway mode — single URL for all services
  baseUrl: "http://localhost:8080",

  // Or direct service URLs
  services: {
    walletEngine: "http://localhost:3002",
    policyEngine: "http://localhost:3003",
    transactionEngine: "http://localhost:3004",
  },

  apiKey: "your-api-key",
  timeout: 30_000, // Request timeout in ms (default: 30s)
  retries: 3, // Retry count for 5xx / network errors (default: 3)
});
```

When `baseUrl` is set it takes precedence over individual service URLs.

## Error Handling

```typescript
import {
  WalletNotFoundError,
  PolicyViolationError,
  TransactionFailedError,
  NetworkError,
  TimeoutError,
} from "@solagent/sdk";

try {
  await client.wallets.get("missing-id");
} catch (error) {
  if (error instanceof WalletNotFoundError) {
    console.log(error.code); // "WALLET_NOT_FOUND"
    console.log(error.statusCode); // 404
  }
}
```

## Development

```bash
bun install
bun run test        # Run tests
bun run typecheck   # Type-check
bun run build       # Build with tsup
```
