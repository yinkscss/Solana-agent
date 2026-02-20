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

export class ValidationError extends SolAgentError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class ProtocolNotFoundError extends SolAgentError {
  constructor(protocol: string) {
    super(`Protocol not found: ${protocol}`, 'PROTOCOL_NOT_FOUND', 404, { protocol });
  }
}

export class OperationNotSupportedError extends SolAgentError {
  constructor(protocol: string, operation: string) {
    super(
      `Protocol "${protocol}" does not support "${operation}"`,
      'OPERATION_NOT_SUPPORTED',
      400,
      { protocol, operation },
    );
  }
}

export class ExternalServiceError extends SolAgentError {
  constructor(service: string, reason: string) {
    super(`${service} error: ${reason}`, 'EXTERNAL_SERVICE_ERROR', 502, { service, reason });
  }
}
