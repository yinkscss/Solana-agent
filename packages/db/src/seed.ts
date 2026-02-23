import 'dotenv/config';
import { createDb } from './connection.js';
import { organizations } from './schema/organizations.js';
import { users } from './schema/users.js';
import { agents } from './schema/agents.js';
import { wallets } from './schema/wallets.js';
import { policies } from './schema/policies.js';
import { transactions } from './schema/transactions.js';
import { apiKeys } from './schema/api-keys.js';
import type { PolicyRule } from './schema/policies.js';
import { eq, inArray } from 'drizzle-orm';

const UUIDS = {
  org: '00000000-0000-4000-a000-000000000001',
  user: '00000000-0000-4000-a000-000000000010',
  agents: [
    '00000000-0000-4000-a000-000000000101',
    '00000000-0000-4000-a000-000000000102',
    '00000000-0000-4000-a000-000000000103',
    '00000000-0000-4000-a000-000000000104',
  ],
  wallets: [
    '00000000-0000-4000-a000-000000000201',
    '00000000-0000-4000-a000-000000000202',
    '00000000-0000-4000-a000-000000000203',
  ],
  policies: [
    '00000000-0000-4000-a000-000000000301',
    '00000000-0000-4000-a000-000000000302',
    '00000000-0000-4000-a000-000000000303',
  ],
  transactions: [
    '00000000-0000-4000-a000-000000000401',
    '00000000-0000-4000-a000-000000000402',
    '00000000-0000-4000-a000-000000000403',
    '00000000-0000-4000-a000-000000000404',
    '00000000-0000-4000-a000-000000000405',
  ],
  apiKey: '00000000-0000-4000-a000-000000000501',
} as const;

const seed = async () => {
  const db = createDb();

  console.log('Seeding database...\n');

  // Clean existing seed data (reverse FK order)
  await db.delete(transactions).where(inArray(transactions.id, [...UUIDS.transactions]));
  await db.delete(policies).where(inArray(policies.id, [...UUIDS.policies]));
  await db.delete(wallets).where(inArray(wallets.id, [...UUIDS.wallets]));
  await db.delete(agents).where(inArray(agents.id, [...UUIDS.agents]));
  await db.delete(apiKeys).where(eq(apiKeys.id, UUIDS.apiKey));
  await db.delete(users).where(eq(users.id, UUIDS.user));
  await db.delete(organizations).where(eq(organizations.id, UUIDS.org));

  // Organization
  const [org] = await db
    .insert(organizations)
    .values({
      id: UUIDS.org,
      name: 'SolAgent Dev',
      tier: 'pro',
    })
    .returning();
  if (!org) throw new Error('Failed to create organization');

  // User
  const [user] = await db
    .insert(users)
    .values({
      id: UUIDS.user,
      orgId: org.id,
      email: 'admin@solagent.dev',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$placeholder_hash_replace_in_production',
      role: 'admin',
    })
    .returning();
  if (!user) throw new Error('Failed to create user');

  // API Key (hash of "demo-key-123")
  await db.insert(apiKeys).values({
    id: UUIDS.apiKey,
    orgId: org.id,
    keyHash: 'sha256:demo-key-123',
    keyPrefix: 'demo-',
    label: 'Development API Key',
    permissions: [
      'agents:read',
      'agents:write',
      'wallets:read',
      'wallets:write',
      'transactions:read',
    ],
  });

  // Agents — matching dashboard mock data
  const agentData = [
    {
      id: UUIDS.agents[0],
      orgId: org.id,
      name: 'DeFi Trader',
      description: 'Automated DeFi trading agent for Solana DEXes',
      status: 'running' as const,
      config: {
        autoStart: true,
        framework: 'solagent',
        walletId: UUIDS.wallets[2],
        systemPrompt:
          'You are SolAgent DeFi Trader, an autonomous AI agent on Solana devnet. You can create wallets, request devnet airdrops, check wallet balances, transfer SOL, and swap tokens via Jupiter. Always confirm amounts before executing transactions. Be concise and helpful.',
        tools: ['get_balance', 'transfer', 'swap', 'create_wallet', 'request_airdrop'],
      },
      llmConfig: { provider: 'openai', model: 'gpt-4o' },
    },
    {
      id: UUIDS.agents[1],
      orgId: org.id,
      name: 'NFT Monitor',
      description: 'Monitors NFT floor prices and alerts on opportunities',
      status: 'running' as const,
      config: {
        autoStart: false,
        framework: 'solagent',
        walletId: UUIDS.wallets[1],
        systemPrompt:
          'You are SolAgent NFT Monitor, an AI agent that monitors NFT floor prices and alerts on opportunities on Solana devnet. You can create wallets, request devnet airdrops, check wallet balances, and transfer SOL. Be concise and helpful.',
        tools: ['get_balance', 'transfer', 'swap', 'create_wallet', 'request_airdrop'],
      },
      llmConfig: { provider: 'openai', model: 'gpt-4o' },
    },
    {
      id: UUIDS.agents[2],
      orgId: org.id,
      name: 'Yield Optimizer',
      description: 'Finds and executes optimal yield farming strategies',
      status: 'running' as const,
      config: {
        autoStart: false,
        framework: 'solagent',
        walletId: UUIDS.wallets[0],
        systemPrompt:
          'You are SolAgent Yield Optimizer, an AI agent that finds and executes optimal yield farming strategies on Solana devnet. You can create wallets, request devnet airdrops, check balances, transfer SOL, and perform token swaps. Be concise and helpful.',
        tools: ['get_balance', 'transfer', 'swap', 'create_wallet', 'request_airdrop'],
      },
      llmConfig: { provider: 'openai', model: 'gpt-4o' },
    },
    {
      id: UUIDS.agents[3],
      orgId: org.id,
      name: 'Portfolio Rebalancer',
      description: 'Automatically rebalances portfolio based on target allocations',
      status: 'running' as const,
      config: {
        autoStart: false,
        framework: 'solagent',
        walletId: UUIDS.wallets[2],
        systemPrompt:
          'You are SolAgent Portfolio Rebalancer, an AI agent that automatically rebalances portfolio based on target allocations on Solana devnet. You can create wallets, request devnet airdrops, check balances, transfer SOL, and perform swaps. Be concise and helpful.',
        tools: ['get_balance', 'transfer', 'swap', 'create_wallet', 'request_airdrop'],
      },
      llmConfig: { provider: 'openai', model: 'gpt-4o' },
    },
  ];
  const insertedAgents = await db.insert(agents).values(agentData).returning();

  // Wallets — one per first 3 agents
  const walletData = [
    {
      id: UUIDS.wallets[0],
      agentId: UUIDS.agents[2], // Yield Optimizer
      publicKey: 'CBwmU879S1HvmfdMHpciY8NZySuJ8thDSETMniCV6mGc',
      keyProvider: 'local' as const,
      keyProviderRef: 'local:dev-keypair-0',
      network: 'devnet' as const,
      label: 'Primary Trading',
    },
    {
      id: UUIDS.wallets[1],
      agentId: UUIDS.agents[1], // NFT Monitor
      publicKey: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
      keyProvider: 'local' as const,
      keyProviderRef: 'local:dev-keypair-1',
      network: 'devnet' as const,
      label: 'NFT Operations',
    },
    {
      id: UUIDS.wallets[2],
      agentId: UUIDS.agents[0], // DeFi Trader
      publicKey: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
      keyProvider: 'local' as const,
      keyProviderRef: 'local:dev-keypair-2',
      network: 'devnet' as const,
      label: 'Dev Testing',
    },
  ];
  const insertedWallets = await db.insert(wallets).values(walletData).returning();

  // Policies
  const spendingLimit: PolicyRule = {
    type: 'spending_limit',
    maxAmountLamports: '10000000000',
    period: 'daily',
  };
  const rateLimit: PolicyRule = {
    type: 'rate_limit',
    maxTransactions: 50,
    windowSeconds: 86400,
  };
  const tokenAllowlist: PolicyRule = {
    type: 'token_allowlist',
    mints: [
      'So11111111111111111111111111111111111111112',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    ],
  };
  const programAllowlist: PolicyRule = {
    type: 'program_allowlist',
    programIds: [
      'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
      'MagicEden1111111111111111111111111111',
      'Tensor1111111111111111111111111111111',
    ],
  };

  const policyData = [
    {
      id: UUIDS.policies[0],
      walletId: UUIDS.wallets[0],
      name: 'Trading Limits',
      rules: [spendingLimit, rateLimit],
      version: 3,
      isActive: true,
    },
    {
      id: UUIDS.policies[1],
      walletId: UUIDS.wallets[1],
      name: 'NFT Allowlist',
      rules: [programAllowlist],
      version: 1,
      isActive: true,
    },
    {
      id: UUIDS.policies[2],
      walletId: UUIDS.wallets[2],
      name: 'Dev Testing Policy',
      rules: [tokenAllowlist],
      version: 1,
      isActive: false,
    },
  ];
  const insertedPolicies = await db.insert(policies).values(policyData).returning();

  // Transactions
  const txData = [
    {
      id: UUIDS.transactions[0],
      walletId: UUIDS.wallets[0],
      agentId: UUIDS.agents[0],
      type: 'swap' as const,
      status: 'confirmed' as const,
      signature:
        '5UfDuX7hXbPjGZRmnTbGHsYJsKBzmVGkGLrBSYGKjR4MvHxJzEGMstLHuECcC2VDfmMqNXriTCkNqVFRkLwEfRg',
      instructions: [
        {
          programId: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
          type: 'swap',
          amountIn: '2500000000',
          tokenIn: 'SOL',
          tokenOut: 'USDC',
        },
      ],
      metadata: { amount: 2.5, token: 'SOL', to: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB' },
      confirmedAt: new Date('2026-02-20T14:30:05Z'),
    },
    {
      id: UUIDS.transactions[1],
      walletId: UUIDS.wallets[0],
      agentId: UUIDS.agents[0],
      type: 'transfer' as const,
      status: 'confirmed' as const,
      signature:
        '3Gz1bXzGFLxX5qKBxYeTUHhPk9XhXEYVkfSJGK2RjQdGS7PdxfPLJMeCFnSJGcQPKzKqNz2dVfVPLj2EtRGGxKJ',
      instructions: [
        {
          programId: '11111111111111111111111111111111',
          type: 'transfer',
          lamports: '1000000000',
          destination: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        },
      ],
      metadata: { amount: 1.0, token: 'SOL', to: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM' },
      confirmedAt: new Date('2026-02-20T12:15:03Z'),
    },
    {
      id: UUIDS.transactions[2],
      walletId: UUIDS.wallets[1],
      agentId: UUIDS.agents[1],
      type: 'transfer' as const,
      status: 'pending' as const,
      signature:
        '2VfkjFNKsERXftdMFRNS8ZPTHk7f3f8x3ZWg1vFxKYKYzPHBD8M5nJgWK2YPAmFHJ7dVkMqgCDbH3JxEhsgNxCG',
      instructions: [
        {
          programId: '11111111111111111111111111111111',
          type: 'transfer',
          lamports: '500000000',
          destination: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        },
      ],
      metadata: { amount: 0.5, token: 'SOL', to: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' },
    },
    {
      id: UUIDS.transactions[3],
      walletId: UUIDS.wallets[0],
      agentId: UUIDS.agents[2],
      type: 'stake' as const,
      status: 'confirmed' as const,
      signature:
        '4RjYbXj9J6VnEGMstLHuECcC2VDfmMqNXriTCkNqVFRkLwEfRg5UfDuX7hXbPjGZRmnTbGHsYJsKBzmVGkGLrBS',
      instructions: [
        {
          programId: 'Stake11111111111111111111111111111111111111',
          type: 'stake',
          lamports: '10000000000',
        },
      ],
      metadata: { amount: 10.0, token: 'SOL', to: 'Stake11111111111111111111111111111111111111' },
      confirmedAt: new Date('2026-02-19T10:00:02Z'),
    },
    {
      id: UUIDS.transactions[4],
      walletId: UUIDS.wallets[2],
      agentId: UUIDS.agents[0],
      type: 'swap' as const,
      status: 'failed' as const,
      signature:
        '6HxKJsMqWQ9LBY7ZtgzPnJVsK8qRFhxjMcNx5PAyrTfvD3Gz1bXzGFLxX5qKBxYeTUHhPk9XhXEYVkfSJGK2Rj',
      instructions: [
        {
          programId: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
          type: 'swap',
          amountIn: '5000000000',
          tokenIn: 'SOL',
          tokenOut: 'USDC',
        },
      ],
      metadata: { amount: 5.0, token: 'SOL', to: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB' },
      errorMessage: 'Slippage tolerance exceeded',
    },
  ];
  const insertedTxs = await db.insert(transactions).values(txData).returning();

  // Print mapping table
  console.log('=== Seed Data ID Mapping ===\n');
  console.log('Organization:');
  console.log(`  SolAgent Dev       ${org.id}`);
  console.log(`\nUser:`);
  console.log(`  admin@solagent.dev ${user.id}`);
  console.log(`\nAgents:`);
  for (const a of insertedAgents) {
    console.log(`  ${a.name.padEnd(24)} ${a.id}  [${a.status}]`);
  }
  console.log(`\nWallets:`);
  for (const w of insertedWallets) {
    console.log(`  ${w.label.padEnd(24)} ${w.id}`);
  }
  console.log(`\nPolicies:`);
  for (const p of insertedPolicies) {
    console.log(`  ${p.name.padEnd(24)} ${p.id}  [active=${p.isActive}]`);
  }
  console.log(`\nTransactions:`);
  for (const t of insertedTxs) {
    console.log(`  ${t.type.padEnd(10)} ${t.id}  [${t.status}]`);
  }

  console.log('\nSeed complete.');
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
