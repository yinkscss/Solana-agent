import { z } from 'zod';

// --- Rule type definitions ---

export type SpendingLimitRule = {
  type: 'spending_limit';
  maxPerTransaction: bigint;
  maxPerWindow: bigint;
  windowDuration: number;
  tokenMint: string;
};

export type ProgramAllowlistRule = {
  type: 'program_allowlist';
  allowedPrograms: string[];
};

export type TokenAllowlistRule = {
  type: 'token_allowlist';
  allowedMints: string[];
};

export type AddressBlocklistRule = {
  type: 'address_blocklist';
  blockedAddresses: string[];
};

export type TimeRestrictionRule = {
  type: 'time_restriction';
  allowedWindows: { start: string; end: string; timezone: string }[];
};

export type HumanApprovalRule = {
  type: 'human_approval';
  triggerCondition: 'amount_exceeds' | 'program_not_in_allowlist' | 'always';
  threshold?: bigint;
  approvalTimeout: number;
};

export type RateLimitRule = {
  type: 'rate_limit';
  maxTransactions: number;
  windowDuration: number;
};

export type PolicyRule =
  | SpendingLimitRule
  | ProgramAllowlistRule
  | TokenAllowlistRule
  | AddressBlocklistRule
  | TimeRestrictionRule
  | HumanApprovalRule
  | RateLimitRule;

export type PolicyDecision = 'allow' | 'deny' | 'require_approval';

export type RuleResult = {
  ruleType: string;
  decision: PolicyDecision;
  reason?: string;
};

export type TransactionDetails = {
  walletId: string;
  amount: bigint;
  tokenMint: string;
  destinationAddress: string;
  programIds: string[];
  instructions: unknown[];
};

export type PolicyEvaluation = {
  decision: PolicyDecision;
  reasons: string[];
  approvalId?: string;
  evaluatedPolicies: { policyId: string; decision: PolicyDecision; reason?: string }[];
};

export type Policy = {
  id: string;
  walletId: string;
  name: string;
  rules: PolicyRule[];
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// --- Zod schemas for API validation ---

const bigintFromString = z.union([z.string(), z.number()]).transform((v) => BigInt(v));

export const spendingLimitRuleSchema = z.object({
  type: z.literal('spending_limit'),
  maxPerTransaction: bigintFromString,
  maxPerWindow: bigintFromString,
  windowDuration: z.number().int().positive(),
  tokenMint: z.string().min(1),
});

export const programAllowlistRuleSchema = z.object({
  type: z.literal('program_allowlist'),
  allowedPrograms: z.array(z.string().min(1)).min(1),
});

export const tokenAllowlistRuleSchema = z.object({
  type: z.literal('token_allowlist'),
  allowedMints: z.array(z.string().min(1)).min(1),
});

export const addressBlocklistRuleSchema = z.object({
  type: z.literal('address_blocklist'),
  blockedAddresses: z.array(z.string().min(1)).min(1),
});

export const timeRestrictionRuleSchema = z.object({
  type: z.literal('time_restriction'),
  allowedWindows: z
    .array(
      z.object({
        start: z.string(),
        end: z.string(),
        timezone: z.string(),
      }),
    )
    .min(1),
});

export const humanApprovalRuleSchema = z.object({
  type: z.literal('human_approval'),
  triggerCondition: z.enum(['amount_exceeds', 'program_not_in_allowlist', 'always']),
  threshold: bigintFromString.optional(),
  approvalTimeout: z.number().int().positive(),
});

export const rateLimitRuleSchema = z.object({
  type: z.literal('rate_limit'),
  maxTransactions: z.number().int().positive(),
  windowDuration: z.number().int().positive(),
});

export const policyRuleSchema = z.discriminatedUnion('type', [
  spendingLimitRuleSchema,
  programAllowlistRuleSchema,
  tokenAllowlistRuleSchema,
  addressBlocklistRuleSchema,
  timeRestrictionRuleSchema,
  humanApprovalRuleSchema,
  rateLimitRuleSchema,
]);

export const createPolicySchema = z.object({
  walletId: z.string().uuid(),
  name: z.string().min(1).max(255),
  rules: z.array(policyRuleSchema).min(1),
});

export const updatePolicySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  rules: z.array(policyRuleSchema).min(1).optional(),
});

export const evaluateTransactionSchema = z.object({
  walletId: z.string().uuid(),
  amount: bigintFromString.optional(),
  tokenMint: z.string().optional().default(''),
  destinationAddress: z.string().optional().default(''),
  programIds: z.array(z.string()).optional().default([]),
  instructions: z.array(z.unknown()).default([]),
});
