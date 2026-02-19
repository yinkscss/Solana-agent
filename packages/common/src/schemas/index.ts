import { z } from 'zod';

export const networkSchema = z.enum(['mainnet-beta', 'devnet', 'testnet']);
export const walletStatusSchema = z.enum(['active', 'frozen', 'recovering']);
export const keyProviderSchema = z.enum(['turnkey', 'crossmint', 'privy', 'local']);
export const agentStatusSchema = z.enum([
  'created',
  'running',
  'paused',
  'stopped',
  'destroyed',
]);
export const transactionStatusSchema = z.enum([
  'pending',
  'simulating',
  'simulation_failed',
  'policy_eval',
  'rejected',
  'awaiting_approval',
  'signing',
  'signing_failed',
  'submitting',
  'submitted',
  'confirmed',
  'failed',
  'retrying',
  'permanently_failed',
]);
export const transactionTypeSchema = z.enum([
  'transfer',
  'swap',
  'stake',
  'unstake',
  'lend',
  'borrow',
  'nft',
  'custom',
]);
export const policyDecisionSchema = z.enum(['allow', 'deny', 'require_approval']);
export const policyRuleTypeSchema = z.enum([
  'spending_limit',
  'program_allowlist',
  'token_allowlist',
  'address_blocklist',
  'time_restriction',
  'human_approval',
  'rate_limit',
]);
export const orgTierSchema = z.enum(['free', 'pro', 'enterprise']);
export const userRoleSchema = z.enum(['viewer', 'developer', 'operator', 'admin']);

const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const solanaAddressSchema = z.string().regex(solanaAddressRegex, 'Invalid Solana address');

export const createWalletSchema = z.object({
  name: z.string().min(1).max(100),
  network: networkSchema,
  keyProvider: keyProviderSchema,
});
export type CreateWalletInput = z.infer<typeof createWalletSchema>;

export const createAgentSchema = z.object({
  walletId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(''),
  model: z.string().min(1),
  systemPrompt: z.string().min(1).max(10_000),
});
export type CreateAgentInput = z.infer<typeof createAgentSchema>;

export const submitTransactionSchema = z.object({
  walletId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
  type: transactionTypeSchema,
  rawTransaction: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});
export type SubmitTransactionInput = z.infer<typeof submitTransactionSchema>;

export const transferSchema = z.object({
  walletId: z.string().uuid(),
  destination: solanaAddressSchema,
  amount: z.number().positive(),
  token: z.string().optional(),
});
export type TransferInput = z.infer<typeof transferSchema>;

export const createPolicyRuleSchema = z.object({
  walletId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  type: policyRuleTypeSchema,
  decision: policyDecisionSchema,
  parameters: z.record(z.unknown()),
  priority: z.number().int().min(0).max(1000).default(100),
  enabled: z.boolean().default(true),
});
export type CreatePolicyRuleInput = z.infer<typeof createPolicyRuleSchema>;

export const spendingLimitParamsSchema = z.object({
  maxAmountLamports: z.string(),
  windowSeconds: z.number().int().positive(),
  token: z.string().optional(),
});
export type SpendingLimitParams = z.infer<typeof spendingLimitParamsSchema>;

export const programAllowlistParamsSchema = z.object({
  allowedPrograms: z.array(solanaAddressSchema).min(1),
});
export type ProgramAllowlistParams = z.infer<typeof programAllowlistParamsSchema>;

export const rateLimitParamsSchema = z.object({
  maxTransactions: z.number().int().positive(),
  windowSeconds: z.number().int().positive(),
});
export type RateLimitParams = z.infer<typeof rateLimitParamsSchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
export type IdParam = z.infer<typeof idParamSchema>;
