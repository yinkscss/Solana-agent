export class SolAgentError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON = () => ({
    name: this.name,
    code: this.code,
    message: this.message,
    statusCode: this.statusCode,
    details: this.details,
  });
}

export class WalletNotFoundError extends SolAgentError {
  constructor(walletId: string) {
    super(`Wallet not found: ${walletId}`, 'WALLET_NOT_FOUND', 404, { walletId });
  }
}

export class PolicyViolationError extends SolAgentError {
  constructor(policyId: string, reason: string) {
    super(`Policy violation: ${reason}`, 'POLICY_VIOLATION', 403, { policyId, reason });
  }
}

export class TransactionFailedError extends SolAgentError {
  constructor(transactionId: string, reason: string) {
    super(`Transaction failed: ${reason}`, 'TRANSACTION_FAILED', 500, {
      transactionId,
      reason,
    });
  }
}

export class InsufficientFundsError extends SolAgentError {
  constructor(walletAddress: string, required: bigint, available: bigint) {
    super(
      `Insufficient funds in wallet ${walletAddress}`,
      'INSUFFICIENT_FUNDS',
      400,
      {
        walletAddress,
        required: required.toString(),
        available: available.toString(),
      },
    );
  }
}

export class UnauthorizedError extends SolAgentError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class RateLimitError extends SolAgentError {
  constructor(retryAfterMs: number) {
    super('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', 429, {
      retryAfterMs,
    });
  }
}

export class AgentNotFoundError extends SolAgentError {
  constructor(agentId: string) {
    super(`Agent not found: ${agentId}`, 'AGENT_NOT_FOUND', 404, { agentId });
  }
}

export class ValidationError extends SolAgentError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}
