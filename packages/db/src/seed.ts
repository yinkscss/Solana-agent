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
  agents: ['00000000-0000-4000-a000-000000000101'],
  wallets: ['00000000-0000-4000-a000-000000000201'],
  policies: ['00000000-0000-4000-a000-000000000301'],
  transactions: ['00000000-0000-4000-a000-000000000401', '00000000-0000-4000-a000-000000000402'],
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

  const agentData = [
    {
      id: UUIDS.agents[0],
      orgId: org.id,
      name: 'SolAgent',
      description: 'Your personal Solana AI assistant',
      status: 'running' as const,
      config: {
        autoStart: true,
        framework: 'solagent',
        walletId: UUIDS.wallets[0],
        systemPrompt:
          'You are SolAgent, a helpful Solana blockchain assistant. Help users manage their wallets, check balances, transfer tokens, swap tokens, and explore transactions on the Solana devnet.',
        tools: [
          'get_balance',
          'transfer',
          'swap',
          'create_wallet',
          'request_airdrop',
          'get_transactions',
        ],
      },
      llmConfig: { provider: 'openai', model: 'gpt-4o-mini' },
    },
  ];
  const insertedAgents = await db.insert(agents).values(agentData).returning();

  const walletData = [
    {
      id: UUIDS.wallets[0],
      agentId: UUIDS.agents[0],
      publicKey: 'CBwmU879S1HvmfdMHpciY8NZySuJ8thDSETMniCV6mGc',
      keyProvider: 'local' as const,
      keyProviderRef: 'local:dev-keypair-0',
      network: 'devnet' as const,
      label: 'Primary Wallet',
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

  const policyData = [
    {
      id: UUIDS.policies[0],
      walletId: UUIDS.wallets[0],
      name: 'Default Spending Limit',
      rules: [spendingLimit, rateLimit],
      version: 1,
      isActive: true,
    },
  ];
  const insertedPolicies = await db.insert(policies).values(policyData).returning();

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
