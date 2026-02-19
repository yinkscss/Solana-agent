import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KoraClient, KoraRelayerError, KoraTimeoutError } from '../src/kora/client.js';
import { FeeRelayerMonitor } from '../src/kora/monitor.js';

const KORA_URL = 'http://localhost:8911';

const jsonRpcOk = <T>(result: T) =>
  new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const jsonRpcError = (code: number, message: string) =>
  new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code, message } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const healthOk = (balance = 5.0, address = '9abc...def') =>
  new Response(JSON.stringify({ feePayerBalance: balance, feePayerAddress: address }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('KoraClient', () => {
  let client: KoraClient;

  beforeEach(() => {
    client = new KoraClient({ url: KORA_URL, timeout: 5000 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('submitTransaction', () => {
    it('returns signature on success', async () => {
      const mockSignature = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzr';
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonRpcOk(mockSignature));

      const result = await client.submitTransaction('AQID..base64tx..');
      expect(result.signature).toBe(mockSignature);
    });

    it('sends correct JSON-RPC payload', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonRpcOk('sig123'));

      await client.submitTransaction('base64data');

      const [, init] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse(init!.body as string);
      expect(body).toEqual({
        jsonrpc: '2.0',
        id: 1,
        method: 'sendTransaction',
        params: ['base64data', { encoding: 'base64' }],
      });
    });

    it('throws KoraRelayerError on RPC error response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        jsonRpcError(-32602, 'Invalid transaction'),
      );

      const error = await client.submitTransaction('bad-tx').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(KoraRelayerError);
      expect((error as KoraRelayerError).message).toBe('Invalid transaction');
    });

    it('throws KoraRelayerError on HTTP error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Service Unavailable', { status: 503 }),
      );

      await expect(client.submitTransaction('tx')).rejects.toThrow(KoraRelayerError);
    });

    it('throws KoraRelayerError when fetch fails (network error)', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('fetch failed'));

      await expect(client.submitTransaction('tx')).rejects.toThrow(KoraRelayerError);
    });

    it('throws KoraTimeoutError on abort', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
        () => new Promise((_, reject) => {
          setTimeout(() => reject(new DOMException('The operation was aborted', 'AbortError')), 10);
        }),
      );

      const fastClient = new KoraClient({ url: KORA_URL, timeout: 5 });
      await expect(fastClient.submitTransaction('tx')).rejects.toThrow(KoraTimeoutError);
    });
  });

  describe('getHealth', () => {
    it('returns healthy status with balance info', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(healthOk(3.5, 'FeeAddr123'));

      const result = await client.getHealth();
      expect(result).toEqual({
        healthy: true,
        feePayerBalance: 3.5,
        feePayerAddress: 'FeeAddr123',
      });
    });

    it('returns unhealthy on HTTP error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('', { status: 500 }),
      );

      const result = await client.getHealth();
      expect(result.healthy).toBe(false);
    });

    it('returns unhealthy on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('fetch failed'));

      const result = await client.getHealth();
      expect(result.healthy).toBe(false);
    });

    it('handles missing fields in health response gracefully', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 }),
      );

      const result = await client.getHealth();
      expect(result).toEqual({ healthy: true, feePayerBalance: 0, feePayerAddress: '' });
    });
  });

  describe('getFeePayerBalance', () => {
    it('returns balance from health endpoint', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(healthOk(7.25, 'addr'));

      const balance = await client.getFeePayerBalance();
      expect(balance).toBe(7.25);
    });

    it('throws when health check fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('', { status: 500 }),
      );

      await expect(client.getFeePayerBalance()).rejects.toThrow(KoraRelayerError);
    });
  });
});

describe('FeeRelayerMonitor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const createMonitorWithMockedClient = (balance: number) => {
    const mockClient = {
      getFeePayerBalance: vi.fn().mockResolvedValue(balance),
    } as unknown as KoraClient;
    return { mockClient, monitor: (config: Partial<Parameters<typeof createMonitor>[1]> = {}) =>
      new FeeRelayerMonitor({
        koraClient: mockClient,
        checkIntervalMs: 1000,
        ...config,
      })
    };
  };

  const createMonitor = (_client: KoraClient, config: Partial<Omit<ConstructorParameters<typeof FeeRelayerMonitor>[0], 'koraClient'>> = {}) =>
    new FeeRelayerMonitor({ koraClient: _client, checkIntervalMs: 1000, ...config });

  describe('checkBalance', () => {
    it('returns ok when balance is above warning threshold', async () => {
      const { monitor } = createMonitorWithMockedClient(5.0);
      const result = await monitor().checkBalance();
      expect(result).toEqual({ balance: 5.0, status: 'ok' });
    });

    it('returns warning when balance is at warning threshold', async () => {
      const { monitor } = createMonitorWithMockedClient(2.0);
      const result = await monitor().checkBalance();
      expect(result).toEqual({ balance: 2.0, status: 'warning' });
    });

    it('returns warning when balance is between thresholds', async () => {
      const { monitor } = createMonitorWithMockedClient(1.0);
      const result = await monitor().checkBalance();
      expect(result).toEqual({ balance: 1.0, status: 'warning' });
    });

    it('returns critical when balance is at critical threshold', async () => {
      const { monitor } = createMonitorWithMockedClient(0.5);
      const result = await monitor().checkBalance();
      expect(result).toEqual({ balance: 0.5, status: 'critical' });
    });

    it('returns critical when balance is zero', async () => {
      const { monitor } = createMonitorWithMockedClient(0);
      const result = await monitor().checkBalance();
      expect(result).toEqual({ balance: 0, status: 'critical' });
    });

    it('respects custom thresholds', async () => {
      const { monitor } = createMonitorWithMockedClient(3.0);
      const result = await monitor({ warningThresholdSol: 5, criticalThresholdSol: 2 }).checkBalance();
      expect(result.status).toBe('warning');
    });
  });

  describe('start/stop', () => {
    it('calls onWarning when balance breaches warning threshold', async () => {
      const onWarning = vi.fn();
      const { mockClient, monitor } = createMonitorWithMockedClient(1.5);
      const m = monitor({ onWarning, checkIntervalMs: 50 });

      m.start();
      await new Promise((r) => setTimeout(r, 100));
      m.stop();

      expect(onWarning).toHaveBeenCalledWith(1.5);
      expect(mockClient.getFeePayerBalance).toHaveBeenCalled();
    });

    it('calls onCritical when balance breaches critical threshold', async () => {
      const onCritical = vi.fn();
      const { monitor } = createMonitorWithMockedClient(0.1);
      const m = monitor({ onCritical, checkIntervalMs: 50 });

      m.start();
      await new Promise((r) => setTimeout(r, 100));
      m.stop();

      expect(onCritical).toHaveBeenCalledWith(0.1);
    });

    it('does not throw when client errors during monitoring', async () => {
      const mockClient = {
        getFeePayerBalance: vi.fn().mockRejectedValue(new Error('network down')),
      } as unknown as KoraClient;
      const m = createMonitor(mockClient, { checkIntervalMs: 50 });

      m.start();
      await new Promise((r) => setTimeout(r, 100));
      m.stop();
    });

    it('stop is idempotent', () => {
      const { monitor } = createMonitorWithMockedClient(5.0);
      const m = monitor();
      m.stop();
      m.stop();
    });
  });
});
