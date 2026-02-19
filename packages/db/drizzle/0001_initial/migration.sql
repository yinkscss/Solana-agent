-- Custom: initial schema migration for SolAgent

-- Enums
CREATE TYPE "org_tier" AS ENUM ('free', 'pro', 'enterprise');
CREATE TYPE "user_role" AS ENUM ('viewer', 'developer', 'operator', 'admin');
CREATE TYPE "agent_status" AS ENUM ('created', 'running', 'paused', 'stopped', 'destroyed');
CREATE TYPE "wallet_status" AS ENUM ('active', 'frozen', 'recovering');
CREATE TYPE "key_provider" AS ENUM ('turnkey', 'crossmint', 'privy', 'local');
CREATE TYPE "network" AS ENUM ('mainnet-beta', 'devnet', 'testnet');
CREATE TYPE "transaction_status" AS ENUM (
  'pending', 'simulating', 'simulation_failed', 'policy_eval', 'rejected',
  'awaiting_approval', 'signing', 'signing_failed', 'submitting', 'submitted',
  'confirmed', 'failed', 'retrying', 'permanently_failed'
);
CREATE TYPE "transaction_type" AS ENUM (
  'transfer', 'swap', 'stake', 'unstake', 'lend', 'borrow', 'nft', 'custom'
);

-- Organizations
CREATE TABLE "organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "tier" "org_tier" NOT NULL DEFAULT 'free',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Users
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "email" text NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "role" "user_role" NOT NULL DEFAULT 'developer',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Agents
CREATE TABLE "agents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "name" text NOT NULL,
  "description" text,
  "status" "agent_status" NOT NULL DEFAULT 'created',
  "config" jsonb DEFAULT '{}',
  "llm_config" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Wallets
CREATE TABLE "wallets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agent_id" uuid NOT NULL REFERENCES "agents"("id"),
  "public_key" text NOT NULL UNIQUE,
  "key_provider" "key_provider" NOT NULL,
  "key_provider_ref" text NOT NULL,
  "network" "network" NOT NULL DEFAULT 'devnet',
  "label" text NOT NULL,
  "status" "wallet_status" NOT NULL DEFAULT 'active',
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Policies
CREATE TABLE "policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "wallet_id" uuid NOT NULL REFERENCES "wallets"("id"),
  "version" integer NOT NULL DEFAULT 1,
  "name" text NOT NULL,
  "rules" jsonb NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Transactions
CREATE TABLE "transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "wallet_id" uuid NOT NULL REFERENCES "wallets"("id"),
  "agent_id" uuid REFERENCES "agents"("id"),
  "signature" text,
  "type" "transaction_type" NOT NULL DEFAULT 'custom',
  "status" "transaction_status" NOT NULL DEFAULT 'pending',
  "instructions" jsonb NOT NULL,
  "fee_lamports" bigint,
  "gasless" boolean NOT NULL DEFAULT false,
  "metadata" jsonb DEFAULT '{}',
  "error_message" text,
  "retry_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "confirmed_at" timestamp
);

-- Policy Evaluations
CREATE TABLE "policy_evaluations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "transaction_id" uuid NOT NULL REFERENCES "transactions"("id"),
  "policies_evaluated" jsonb NOT NULL,
  "decision" text NOT NULL,
  "reasons" jsonb DEFAULT '[]',
  "evaluated_at" timestamp NOT NULL DEFAULT now()
);

-- API Keys
CREATE TABLE "api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "key_hash" text NOT NULL UNIQUE,
  "key_prefix" text NOT NULL,
  "label" text NOT NULL,
  "permissions" jsonb DEFAULT '[]',
  "expires_at" timestamp,
  "last_used_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
