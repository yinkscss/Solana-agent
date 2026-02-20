import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSubmitterService, type SubmitterService } from '../src/services/submitter.service';

const MOCK_SIGNATURE = '5UfDuX7WXYjABmLELhx2GR1NMRQYUMSbWL3JRPdVqvXbGYy5bUPWKSDAzrLBTKbc4kYk3d6sqFVpN8RaFfyDJqU';
const KORA_URL = 'http://kora-gasless:8911';

const createMockConnection = () => ({
  sendRawTransaction: vi.fn(async () => MOCK_SIGNATURE),
}) as any;

describe('Gasless / Kora Integration', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    fetchSpy?.mockRestore();
  });

  describe('gasless submit path', () => {
    it('sends to Kora URL instead of RPC when gasless=true', async () => {
      const connection = createMockConnection();
      const service = createSubmitterService(connection, KORA_URL, 3);

      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ signature: MOCK_SIGNATURE }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const txBase64 = Buffer.from('gasless-transaction').toString('base64');
      const signature = await service.submitTransaction(txBase64, { gasless: true });

      expect(signature).toBe(MOCK_SIGNATURE);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${KORA_URL}/api/v1/submit`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const fetchBody = JSON.parse(
        (fetchSpy.mock.calls[0]![1] as RequestInit).body as string,
      );
      expect(fetchBody.transaction).toBe(txBase64);

      expect(connection.sendRawTransaction).not.toHaveBeenCalled();
    });
  });

  describe('gasless Kora failure propagation', () => {
    it('throws SubmissionFailedError when Kora returns an HTTP error', async () => {
      const connection = createMockConnection();
      const service = createSubmitterService(connection, KORA_URL, 0);

      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Service unavailable' }), {
          status: 503,
        }),
      );

      const txBase64 = Buffer.from('failing-gasless-tx').toString('base64');

      await expect(
        service.submitTransaction(txBase64, { gasless: true, maxRetries: 0 }),
      ).rejects.toThrow('Kora returned HTTP 503');

      expect(connection.sendRawTransaction).not.toHaveBeenCalled();
    });

    it('throws on Kora network failure', async () => {
      const connection = createMockConnection();
      const service = createSubmitterService(connection, KORA_URL, 0);

      fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new TypeError('fetch failed'),
      );

      const txBase64 = Buffer.from('network-fail-tx').toString('base64');

      await expect(
        service.submitTransaction(txBase64, { gasless: true, maxRetries: 0 }),
      ).rejects.toThrow();

      expect(connection.sendRawTransaction).not.toHaveBeenCalled();
    });
  });

  describe('gasless vs standard routing', () => {
    it('routes gasless to Kora and standard to RPC', async () => {
      const connection = createMockConnection();
      const service = createSubmitterService(connection, KORA_URL, 3);

      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ signature: MOCK_SIGNATURE }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const standardTx = Buffer.from('standard-tx').toString('base64');
      const standardSig = await service.submitTransaction(standardTx, { gasless: false });
      expect(standardSig).toBe(MOCK_SIGNATURE);
      expect(connection.sendRawTransaction).toHaveBeenCalledOnce();
      expect(fetchSpy).not.toHaveBeenCalled();

      connection.sendRawTransaction.mockClear();

      const gaslessTx = Buffer.from('gasless-tx').toString('base64');
      const gaslessSig = await service.submitTransaction(gaslessTx, { gasless: true });
      expect(gaslessSig).toBe(MOCK_SIGNATURE);
      expect(fetchSpy).toHaveBeenCalledOnce();
      expect(connection.sendRawTransaction).not.toHaveBeenCalled();
    });

    it('retries gasless submissions through Kora on transient failure', async () => {
      const connection = createMockConnection();
      const service = createSubmitterService(connection, KORA_URL, 3);

      let callCount = 0;
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          return new Response(JSON.stringify({ error: 'Busy' }), { status: 503 });
        }
        return new Response(JSON.stringify({ signature: MOCK_SIGNATURE }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const txBase64 = Buffer.from('retry-gasless-tx').toString('base64');
      const signature = await service.submitTransaction(txBase64, { gasless: true });

      expect(signature).toBe(MOCK_SIGNATURE);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(connection.sendRawTransaction).not.toHaveBeenCalled();
    });
  });
});
