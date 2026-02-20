import type {
  Agent,
  Wallet,
  Transaction,
  Policy,
  DashboardStats,
  ServiceHealth,
} from "@/types";

export const mockAgents: Agent[] = [
  {
    id: "agent-1",
    name: "DeFi Trader",
    description: "Automated DeFi trading agent for Solana DEXes",
    status: "running",
    framework: "langchain",
    model: "gpt-4o",
    walletId: "wallet-1",
    systemPrompt: "You are a DeFi trading agent...",
    createdAt: "2026-02-18T10:00:00Z",
    updatedAt: "2026-02-20T08:00:00Z",
  },
  {
    id: "agent-2",
    name: "NFT Monitor",
    description: "Monitors NFT floor prices and alerts on opportunities",
    status: "paused",
    framework: "vercel-ai",
    model: "claude-3",
    walletId: "wallet-2",
    systemPrompt: "You are an NFT market monitor...",
    createdAt: "2026-02-15T14:30:00Z",
    updatedAt: "2026-02-19T16:00:00Z",
  },
  {
    id: "agent-3",
    name: "Yield Optimizer",
    description: "Finds and executes optimal yield farming strategies",
    status: "created",
    framework: "langchain",
    model: "gpt-4o",
    walletId: "wallet-1",
    systemPrompt: "You are a yield optimization agent...",
    createdAt: "2026-02-20T09:00:00Z",
    updatedAt: "2026-02-20T09:00:00Z",
  },
  {
    id: "agent-4",
    name: "Portfolio Rebalancer",
    description: "Automatically rebalances portfolio based on target allocations",
    status: "stopped",
    framework: "vercel-ai",
    model: "claude-3",
    walletId: "wallet-3",
    systemPrompt: "You are a portfolio rebalancing agent...",
    createdAt: "2026-02-10T08:00:00Z",
    updatedAt: "2026-02-18T12:00:00Z",
  },
];

export const mockWallets: Wallet[] = [
  {
    id: "wallet-1",
    address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    label: "Primary Trading",
    network: "mainnet-beta",
    status: "active",
    balance: 45.23,
    keyProvider: "local",
    createdAt: "2026-02-01T00:00:00Z",
  },
  {
    id: "wallet-2",
    address: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    label: "NFT Operations",
    network: "mainnet-beta",
    status: "active",
    balance: 12.87,
    keyProvider: "aws-kms",
    createdAt: "2026-02-05T00:00:00Z",
  },
  {
    id: "wallet-3",
    address: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    label: "Dev Testing",
    network: "devnet",
    status: "active",
    balance: 100.0,
    keyProvider: "local",
    createdAt: "2026-02-10T00:00:00Z",
  },
];

export const mockTransactions: Transaction[] = [
  {
    id: "tx-1",
    walletId: "wallet-1",
    type: "swap",
    status: "confirmed",
    signature:
      "5UfDuX7hXbPjGZRmnTbGHsYJsKBzmVGkGLrBSYGKjR4MvHxJzEGMstLHuECcC2VDfmMqNXriTCkNqVFRkLwEfRg",
    amount: 2.5,
    token: "SOL",
    to: "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB",
    from: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    createdAt: "2026-02-20T14:30:00Z",
  },
  {
    id: "tx-2",
    walletId: "wallet-1",
    type: "transfer",
    status: "confirmed",
    signature:
      "3Gz1bXzGFLxX5qKBxYeTUHhPk9XhXEYVkfSJGK2RjQdGS7PdxfPLJMeCFnSJGcQPKzKqNz2dVfVPLj2EtRGGxKJ",
    amount: 1.0,
    token: "SOL",
    to: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    from: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    createdAt: "2026-02-20T12:15:00Z",
  },
  {
    id: "tx-3",
    walletId: "wallet-2",
    type: "transfer",
    status: "pending",
    signature:
      "2VfkjFNKsERXftdMFRNS8ZPTHk7f3f8x3ZWg1vFxKYKYzPHBD8M5nJgWK2YPAmFHJ7dVkMqgCDbH3JxEhsgNxCG",
    amount: 0.5,
    token: "SOL",
    to: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    from: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    createdAt: "2026-02-20T16:00:00Z",
  },
  {
    id: "tx-4",
    walletId: "wallet-1",
    type: "stake",
    status: "confirmed",
    signature:
      "4RjYbXj9J6VnEGMstLHuECcC2VDfmMqNXriTCkNqVFRkLwEfRg5UfDuX7hXbPjGZRmnTbGHsYJsKBzmVGkGLrBS",
    amount: 10.0,
    token: "SOL",
    to: "Stake11111111111111111111111111111111111111",
    from: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    createdAt: "2026-02-19T10:00:00Z",
  },
  {
    id: "tx-5",
    walletId: "wallet-3",
    type: "swap",
    status: "failed",
    signature:
      "6HxKJsMqWQ9LBY7ZtgzPnJVsK8qRFhxjMcNx5PAyrTfvD3Gz1bXzGFLxX5qKBxYeTUHhPk9XhXEYVkfSJGK2Rj",
    amount: 5.0,
    token: "SOL",
    to: "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB",
    from: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    createdAt: "2026-02-19T08:00:00Z",
  },
];

export const mockPolicies: Policy[] = [
  {
    id: "policy-1",
    name: "Trading Limits",
    walletId: "wallet-1",
    rules: [
      { id: "r1", type: "max_amount", params: { max: 10, token: "SOL" } },
      {
        id: "r2",
        type: "time_window",
        params: { maxPerWindow: 50, windowHours: 24 },
      },
    ],
    version: 3,
    active: true,
    createdAt: "2026-02-05T00:00:00Z",
    updatedAt: "2026-02-18T00:00:00Z",
  },
  {
    id: "policy-2",
    name: "NFT Allowlist",
    walletId: "wallet-2",
    rules: [
      {
        id: "r3",
        type: "whitelist",
        params: {
          addresses: [
            "MagicEden1111111111111111111111111111",
            "Tensor1111111111111111111111111111111",
          ],
        },
      },
    ],
    version: 1,
    active: true,
    createdAt: "2026-02-10T00:00:00Z",
    updatedAt: "2026-02-10T00:00:00Z",
  },
  {
    id: "policy-3",
    name: "Dev Testing Policy",
    walletId: "wallet-3",
    rules: [
      {
        id: "r4",
        type: "allowed_tokens",
        params: { tokens: ["SOL", "USDC"] },
      },
    ],
    version: 1,
    active: false,
    createdAt: "2026-02-15T00:00:00Z",
    updatedAt: "2026-02-15T00:00:00Z",
  },
];

export const mockStats: DashboardStats = {
  totalAgents: 4,
  runningAgents: 1,
  totalWallets: 3,
  totalTransactions24h: 12,
  activePolicies: 2,
};

export const mockServiceHealth: ServiceHealth[] = [
  { name: "Agent Service", url: "http://localhost:8081", status: "healthy", latency: 45 },
  { name: "Wallet Service", url: "http://localhost:8082", status: "healthy", latency: 32 },
  { name: "Transaction Service", url: "http://localhost:8083", status: "unhealthy" },
  { name: "Policy Engine", url: "http://localhost:8084", status: "healthy", latency: 28 },
  { name: "DeFi Integration", url: "http://localhost:8085", status: "unknown" },
];
