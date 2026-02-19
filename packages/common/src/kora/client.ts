import { SolAgentError } from '../errors/index.js';

export interface KoraConfig {
  url: string;
  timeout?: number;
}

export interface KoraSubmitResult {
  signature: string;
}

export interface KoraHealthStatus {
  healthy: boolean;
  feePayerBalance: number;
  feePayerAddress: string;
}

interface JsonRpcResponse<T> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

export class KoraRelayerError extends SolAgentError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'KORA_RELAYER_ERROR', 502, details);
  }
}

export class KoraTimeoutError extends SolAgentError {
  constructor(timeoutMs: number) {
    super(`Kora request timed out after ${timeoutMs}ms`, 'KORA_TIMEOUT', 504, { timeoutMs });
  }
}

const sendJsonRpc = async <T>(
  url: string,
  method: string,
  params: unknown[],
  timeoutMs: number,
): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new KoraRelayerError(`Kora returned HTTP ${response.status}`, {
        status: response.status,
      });
    }

    const json = (await response.json()) as JsonRpcResponse<T>;
    if (json.error) {
      throw new KoraRelayerError(json.error.message, {
        rpcCode: json.error.code,
        rpcData: json.error.data,
      });
    }

    if (json.result === undefined) {
      throw new KoraRelayerError('Kora returned empty result');
    }

    return json.result;
  } catch (error) {
    if (error instanceof SolAgentError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new KoraTimeoutError(timeoutMs);
    }
    throw new KoraRelayerError('Failed to reach Kora relayer', {
      cause: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timer);
  }
};

const DEFAULT_TIMEOUT_MS = 30_000;

export class KoraClient {
  private readonly url: string;
  private readonly timeout: number;

  constructor(config: KoraConfig) {
    this.url = config.url;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT_MS;
  }

  submitTransaction = async (serializedTransaction: string): Promise<KoraSubmitResult> => {
    const signature = await sendJsonRpc<string>(
      this.url,
      'sendTransaction',
      [serializedTransaction, { encoding: 'base64' }],
      this.timeout,
    );
    return { signature };
  };

  getHealth = async (): Promise<KoraHealthStatus> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.url}/health`, { signal: controller.signal });
      if (!response.ok) {
        return { healthy: false, feePayerBalance: 0, feePayerAddress: '' };
      }

      const data = (await response.json()) as Record<string, unknown>;
      return {
        healthy: true,
        feePayerBalance: typeof data.feePayerBalance === 'number' ? data.feePayerBalance : 0,
        feePayerAddress: typeof data.feePayerAddress === 'string' ? data.feePayerAddress : '',
      };
    } catch {
      return { healthy: false, feePayerBalance: 0, feePayerAddress: '' };
    } finally {
      clearTimeout(timer);
    }
  };

  getFeePayerBalance = async (): Promise<number> => {
    const health = await this.getHealth();
    if (!health.healthy) {
      throw new KoraRelayerError('Kora health check failed — cannot retrieve fee payer balance');
    }
    return health.feePayerBalance;
  };
}
