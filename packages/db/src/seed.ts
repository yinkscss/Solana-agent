import 'dotenv/config';
import { createDb } from './connection.js';
import { organizations } from './schema/organizations.js';
import { users } from './schema/users.js';
import { agents } from './schema/agents.js';
import { wallets } from './schema/wallets.js';
import { policies } from './schema/policies.js';
import type { PolicyRule } from './schema/policies.js';

const seed = async () => {
  const db = createDb();

  console.log('Seeding database...');

  const [org] = await db.insert(organizations).values({
    name: 'SolAgent Dev',
    tier: 'pro',
  }).returning();

  if (!org) throw new Error('Failed to create organization');
  console.log(`Created organization: ${org.name} (${org.id})`);

  const [user] = await db.insert(users).values({
    orgId: org.id,
    email: 'admin@solagent.dev',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$placeholder_hash_replace_in_production',
    role: 'admin',
  }).returning();

  if (!user) throw new Error('Failed to create user');
  console.log(`Created user: ${user.email} (${user.id})`);

  const [agent] = await db.insert(agents).values({
    orgId: org.id,
    name: 'Test Agent',
    description: 'Default test agent for development',
    status: 'created',
    config: { autoStart: false },
    llmConfig: { provider: 'openai', model: 'gpt-4o' },
  }).returning();

  if (!agent) throw new Error('Failed to create agent');
  console.log(`Created agent: ${agent.name} (${agent.id})`);

  const [wallet] = await db.insert(wallets).values({
    agentId: agent.id,
    publicKey: 'DevWa11etPubKeyP1aceh01derAAAAAAAAAAAAAAAAA',
    keyProvider: 'local',
    keyProviderRef: 'local:dev-keypair-0',
    network: 'devnet',
    label: 'Dev Wallet',
  }).returning();

  if (!wallet) throw new Error('Failed to create wallet');
  console.log(`Created wallet: ${wallet.label} (${wallet.publicKey})`);

  const spendingRule: PolicyRule = {
    type: 'spending_limit',
    maxAmountLamports: '1000000000',
    period: 'per_tx',
  };

  const [policy] = await db.insert(policies).values({
    walletId: wallet.id,
    name: 'Default Spending Limit',
    rules: [spendingRule],
    isActive: true,
  }).returning();

  if (!policy) throw new Error('Failed to create policy');
  console.log(`Created policy: ${policy.name} (${policy.id})`);

  console.log('Seed complete.');
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
