export class SolAgentSDKError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "SolAgentSDKError";
  }
}

export class WalletNotFoundError extends SolAgentSDKError {
  constructor(walletId: string, details?: Record<string, unknown>) {
    super(`Wallet not found: ${walletId}`, "WALLET_NOT_FOUND", 404, details);
    this.name = "WalletNotFoundError";
  }
}

export class PolicyViolationError extends SolAgentSDKError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "POLICY_VIOLATION", 403, details);
    this.name = "PolicyViolationError";
  }
}

export class TransactionFailedError extends SolAgentSDKError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "TRANSACTION_FAILED", 400, details);
    this.name = "TransactionFailedError";
  }
}

export class NetworkError extends SolAgentSDKError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "NETWORK_ERROR", 0, details);
    this.name = "NetworkError";
  }
}

export class TimeoutError extends SolAgentSDKError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "TIMEOUT", 408, details);
    this.name = "TimeoutError";
  }
}

interface ErrorResponseBody {
  message?: string;
  code?: string;
  details?: Record<string, unknown>;
}

const ERROR_MAP: Record<number, (body: ErrorResponseBody, url: string) => SolAgentSDKError> = {
  404: (body, url) => {
    if (url.includes("/wallets")) {
      return new WalletNotFoundError(url, body.details);
    }
    return new SolAgentSDKError(
      body.message ?? "Resource not found",
      body.code ?? "NOT_FOUND",
      404,
      body.details,
    );
  },
  403: (body) =>
    new PolicyViolationError(body.message ?? "Policy violation", body.details),
};

export const parseErrorResponse = async (
  response: Response,
  url: string,
): Promise<SolAgentSDKError> => {
  let body: ErrorResponseBody = {};
  try {
    body = (await response.json()) as ErrorResponseBody;
  } catch {
    // non-JSON error body — use status text
  }

  const mapper = ERROR_MAP[response.status];
  if (mapper) return mapper(body, url);

  return new SolAgentSDKError(
    body.message ?? `Request failed with status ${response.status}`,
    body.code ?? "REQUEST_FAILED",
    response.status,
    body.details,
  );
};
