import type { Agent, Wallet, Transaction, Policy, DashboardStats, ServiceHealth } from '@/types';

export const mockAgents: Agent[] = [
  {
    id: '00000000-0000-4000-a000-000000000101',
    name: 'DeFi Trader',
    description: 'Automated DeFi trading agent for Solana DEXes',
    status: 'running',
    framework: 'solagent',
    model: 'gpt-4o',
    walletId: '00000000-0000-4000-a000-000000000203',
    systemPrompt:
      'You are SolAgent DeFi Trader, an autonomous AI agent on Solana devnet. You can create wallets, request devnet airdrops, check wallet balances, transfer SOL, and swap tokens via Jupiter. Always confirm amounts before executing transactions. Be concise and helpful.',
    createdAt: '2026-02-18T10:00:00Z',
    updatedAt: '2026-02-20T08:00:00Z',
  },
  {
    id: '00000000-0000-4000-a000-000000000102',
    name: 'NFT Monitor',
    description: 'Monitors NFT floor prices and alerts on opportunities',
    status: 'running',
    framework: 'solagent',
    model: 'gpt-4o',
    walletId: '00000000-0000-4000-a000-000000000202',
    systemPrompt:
      'You are SolAgent NFT Monitor, an AI agent that monitors NFT floor prices and alerts on opportunities on Solana devnet. You can create wallets, request devnet airdrops, check wallet balances, and transfer SOL. Be concise and helpful.',
    createdAt: '2026-02-15T14:30:00Z',
    updatedAt: '2026-02-19T16:00:00Z',
  },
  {
    id: '00000000-0000-4000-a000-000000000103',
    name: 'Yield Optimizer',
    description: 'Finds and executes optimal yield farming strategies',
    status: 'running',
    framework: 'solagent',
    model: 'gpt-4o',
    walletId: '00000000-0000-4000-a000-000000000201',
    systemPrompt:
      'You are SolAgent Yield Optimizer, an AI agent that finds and executes optimal yield farming strategies on Solana devnet. You can create wallets, request devnet airdrops, check balances, transfer SOL, and perform token swaps. Be concise and helpful.',
    createdAt: '2026-02-20T09:00:00Z',
    updatedAt: '2026-02-20T09:00:00Z',
  },
  {
    id: '00000000-0000-4000-a000-000000000104',
    name: 'Portfolio Rebalancer',
    description: 'Automatically rebalances portfolio based on target allocations',
    status: 'running',
    framework: 'solagent',
    model: 'gpt-4o',
    walletId: '00000000-0000-4000-a000-000000000203',
    systemPrompt:
      'You are SolAgent Portfolio Rebalancer, an AI agent that automatically rebalances portfolio based on target allocations on Solana devnet. You can create wallets, request devnet airdrops, check balances, transfer SOL, and perform swaps. Be concise and helpful.',
    createdAt: '2026-02-10T08:00:00Z',
    updatedAt: '2026-02-18T12:00:00Z',
  },
];

export const mockWallets: Wallet[] = [
  {
    id: '00000000-0000-4000-a000-000000000201',
    address: 'CBwmU879S1HvmfdMHpciY8NZySuJ8thDSETMniCV6mGc',
    label: 'Primary Trading',
    network: 'devnet',
    status: 'active',
    balance: 1.85,
    keyProvider: 'local',
    createdAt: '2026-02-01T00:00:00Z',
  },
  {
    id: '00000000-0000-4000-a000-000000000202',
    address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    label: 'NFT Operations',
    network: 'devnet',
    status: 'active',
    balance: 0.5,
    keyProvider: 'local',
    createdAt: '2026-02-05T00:00:00Z',
  },
  {
    id: '00000000-0000-4000-a000-000000000203',
    address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    label: 'Dev Testing',
    network: 'devnet',
    status: 'active',
    balance: 2.0,
    keyProvider: 'local',
    createdAt: '2026-02-10T00:00:00Z',
  },
];

export const mockTransactions: Transaction[] = [
  {
    id: '00000000-0000-4000-a000-000000000401',
    walletId: '00000000-0000-4000-a000-000000000201',
    type: 'swap',
    status: 'confirmed',
    signature:
      '5UfDuX7hXbPjGZRmnTbGHsYJsKBzmVGkGLrBSYGKjR4MvHxJzEGMstLHuECcC2VDfmMqNXriTCkNqVFRkLwEfRg',
    amount: 2.5,
    token: 'SOL',
    to: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
    from: 'CBwmU879S1HvmfdMHpciY8NZySuJ8thDSETMniCV6mGc',
    createdAt: '2026-02-20T14:30:00Z',
  },
  {
    id: '00000000-0000-4000-a000-000000000402',
    walletId: '00000000-0000-4000-a000-000000000201',
    type: 'transfer',
    status: 'confirmed',
    signature:
      '3Gz1bXzGFLxX5qKBxYeTUHhPk9XhXEYVkfSJGK2RjQdGS7PdxfPLJMeCFnSJGcQPKzKqNz2dVfVPLj2EtRGGxKJ',
    amount: 1.0,
    token: 'SOL',
    to: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    from: 'CBwmU879S1HvmfdMHpciY8NZySuJ8thDSETMniCV6mGc',
    createdAt: '2026-02-20T12:15:00Z',
  },
  {
    id: '00000000-0000-4000-a000-000000000403',
    walletId: '00000000-0000-4000-a000-000000000202',
    type: 'transfer',
    status: 'pending',
    signature:
      '2VfkjFNKsERXftdMFRNS8ZPTHk7f3f8x3ZWg1vFxKYKYzPHBD8M5nJgWK2YPAmFHJ7dVkMqgCDbH3JxEhsgNxCG',
    amount: 0.5,
    token: 'SOL',
    to: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    from: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    createdAt: '2026-02-20T16:00:00Z',
  },
  {
    id: '00000000-0000-4000-a000-000000000404',
    walletId: '00000000-0000-4000-a000-000000000201',
    type: 'stake',
    status: 'confirmed',
    signature:
      '4RjYbXj9J6VnEGMstLHuECcC2VDfmMqNXriTCkNqVFRkLwEfRg5UfDuX7hXbPjGZRmnTbGHsYJsKBzmVGkGLrBS',
    amount: 10.0,
    token: 'SOL',
    to: 'Stake11111111111111111111111111111111111111',
    from: 'CBwmU879S1HvmfdMHpciY8NZySuJ8thDSETMniCV6mGc',
    createdAt: '2026-02-19T10:00:00Z',
  },
  {
    id: '00000000-0000-4000-a000-000000000405',
    walletId: '00000000-0000-4000-a000-000000000203',
    type: 'swap',
    status: 'failed',
    signature:
      '6HxKJsMqWQ9LBY7ZtgzPnJVsK8qRFhxjMcNx5PAyrTfvD3Gz1bXzGFLxX5qKBxYeTUHhPk9XhXEYVkfSJGK2Rj',
    amount: 5.0,
    token: 'SOL',
    to: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
    from: 'CBwmU879S1HvmfdMHpciY8NZySuJ8thDSETMniCV6mGc',
    createdAt: '2026-02-19T08:00:00Z',
  },
];

export const mockPolicies: Policy[] = [
  {
    id: '00000000-0000-4000-a000-000000000301',
    name: 'Trading Limits',
    walletId: '00000000-0000-4000-a000-000000000201',
    rules: [
      { id: 'r1', type: 'max_amount', params: { max: 10, token: 'SOL' } },
      {
        id: 'r2',
        type: 'time_window',
        params: { maxPerWindow: 50, windowHours: 24 },
      },
    ],
    version: 3,
    active: true,
    createdAt: '2026-02-05T00:00:00Z',
    updatedAt: '2026-02-18T00:00:00Z',
  },
  {
    id: '00000000-0000-4000-a000-000000000302',
    name: 'NFT Allowlist',
    walletId: '00000000-0000-4000-a000-000000000202',
    rules: [
      {
        id: 'r3',
        type: 'whitelist',
        params: {
          addresses: [
            'MagicEden1111111111111111111111111111',
            'Tensor1111111111111111111111111111111',
          ],
        },
      },
    ],
    version: 1,
    active: true,
    createdAt: '2026-02-10T00:00:00Z',
    updatedAt: '2026-02-10T00:00:00Z',
  },
  {
    id: '00000000-0000-4000-a000-000000000303',
    name: 'Dev Testing Policy',
    walletId: '00000000-0000-4000-a000-000000000203',
    rules: [
      {
        id: 'r4',
        type: 'allowed_tokens',
        params: { tokens: ['SOL', 'USDC'] },
      },
    ],
    version: 1,
    active: false,
    createdAt: '2026-02-15T00:00:00Z',
    updatedAt: '2026-02-15T00:00:00Z',
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
  { name: 'Agent Service', url: 'http://localhost:8081', status: 'healthy', latency: 45 },
  { name: 'Wallet Service', url: 'http://localhost:8082', status: 'healthy', latency: 32 },
  { name: 'Transaction Service', url: 'http://localhost:8083', status: 'unhealthy' },
  { name: 'Policy Engine', url: 'http://localhost:8084', status: 'healthy', latency: 28 },
  { name: 'DeFi Integration', url: 'http://localhost:8085', status: 'unknown' },
];
