import type { TransactionStatus, TransactionType, PolicyDecision } from '@solagent/common';

export type Urgency = 'low' | 'medium' | 'high';

export interface CreateTransactionParams {
  walletId: string;
  agentId?: string;
  type: TransactionType;
  instructions?: unknown[];
  destination?: string;
  amount?: string;
  tokenMint?: string;
  gasless?: boolean;
  urgency?: Urgency;
  metadata?: Record<string, unknown>;
}

export interface TransactionRecord {
  id: string;
  walletId: string;
  agentId: string | null;
  signature: string | null;
  type: TransactionType;
  status: TransactionStatus;
  instructions: unknown[];
  feeLamports: bigint | null;
  gasless: boolean;
  metadata: Record<string, unknown>;
  errorMessage: string | null;
  retryCount: number;
  createdAt: Date;
  confirmedAt: Date | null;
}

export interface SimulationResult {
  success: boolean;
  logs: string[];
  unitsConsumed: number;
  error?: string;
}

export interface PolicyEvaluation {
  decision: PolicyDecision;
  reasons: string[];
  approvalId?: string;
  evaluatedPolicies?: unknown[];
}

export interface ConfirmationResult {
  confirmed: boolean;
  slot?: number;
  error?: string;
}

export interface SubmitOptions {
  gasless?: boolean;
  maxRetries?: number;
}

export interface TransactionListOptions {
  page?: number;
  pageSize?: number;
  status?: TransactionStatus;
  type?: TransactionType;
}

export class SolAgentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'SolAgentError';
  }
}

export class TransactionNotFoundError extends SolAgentError {
  constructor(txId: string) {
    super(`Transaction not found: ${txId}`, 'TRANSACTION_NOT_FOUND', 404, { txId });
  }
}

export class SimulationFailedError extends SolAgentError {
  constructor(reason: string) {
    super(`Simulation failed: ${reason}`, 'SIMULATION_FAILED', 400, { reason });
  }
}

export class PolicyDeniedError extends SolAgentError {
  constructor(reasons: string[]) {
    super(`Policy denied: ${reasons.join(', ')}`, 'POLICY_DENIED', 403, { reasons });
  }
}

export class SigningFailedError extends SolAgentError {
  constructor(reason: string) {
    super(`Signing failed: ${reason}`, 'SIGNING_FAILED', 502, { reason });
  }
}

export class SubmissionFailedError extends SolAgentError {
  constructor(reason: string) {
    super(`Submission failed: ${reason}`, 'SUBMISSION_FAILED', 502, { reason });
  }
}

export class InvalidTransitionError extends SolAgentError {
  constructor(from: TransactionStatus, to: TransactionStatus) {
    super(
      `Invalid transition from ${from} to ${to}`,
      'INVALID_TRANSITION',
      400,
      { from, to },
    );
  }
}

export class ValidationError extends SolAgentError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}
