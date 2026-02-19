import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSubmitterService, type SubmitterService } from '../src/services/submitter.service';

const MOCK_SIGNATURE = '5UfDuX7WXYjABmLELhx2GR1NMRQYUMSbWL3JRPdVqvXbGYy5bUPWKSDAzrLBTKbc4kYk3d6sqFVpN8RaFfyDJqU';

const createMockConnection = (opts?: { fail?: boolean; failCount?: number }) => {
  let callCount = 0;
  return {
    sendRawTransaction: vi.fn(async () => {
      callCount++;
      if (opts?.fail && callCount <= (opts.failCount ?? Infinity)) {
        throw new Error('RPC error: node is behind');
      }
      return MOCK_SIGNATURE;
    }),
  } as any;
};

describe('SubmitterService', () => {
  let service: SubmitterService;
  let mockConnection: ReturnType<typeof createMockConnection>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('successful submission', () => {
    it('submits a transaction and returns signature', async () => {
      mockConnection = createMockConnection();
      service = createSubmitterService(mockConnection, 'http://localhost:8911', 5);

      const txBase64 = Buffer.from('dummy-transaction').toString('base64');
      const signature = await service.submitTransaction(txBase64);

      expect(signature).toBe(MOCK_SIGNATURE);
      expect(mockConnection.sendRawTransaction).toHaveBeenCalledOnce();
    });
  });

  describe('retry on failure', () => {
    it('retries and eventually succeeds', async () => {
      mockConnection = createMockConnection({ fail: true, failCount: 2 });
      service = createSubmitterService(mockConnection, 'http://localhost:8911', 5);

      const txBase64 = Buffer.from('dummy-transaction').toString('base64');
      const signature = await service.submitTransaction(txBase64);

      expect(signature).toBe(MOCK_SIGNATURE);
      expect(mockConnection.sendRawTransaction).toHaveBeenCalledTimes(3);
    });
  });

  describe('max retries exceeded', () => {
    it('throws after exceeding max retries', async () => {
      mockConnection = createMockConnection({ fail: true });
      service = createSubmitterService(mockConnection, 'http://localhost:8911', 2);

      const txBase64 = Buffer.from('dummy-transaction').toString('base64');

      await expect(
        service.submitTransaction(txBase64, { maxRetries: 2 }),
      ).rejects.toThrow('RPC error: node is behind');
    });
  });

  describe('gasless submission', () => {
    it('calls Kora URL for gasless transactions', async () => {
      mockConnection = createMockConnection();
      service = createSubmitterService(mockConnection, 'http://localhost:8911', 5);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ signature: MOCK_SIGNATURE }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const txBase64 = Buffer.from('dummy-transaction').toString('base64');
      const signature = await service.submitTransaction(txBase64, { gasless: true });

      expect(signature).toBe(MOCK_SIGNATURE);
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:8911/api/v1/submit',
        expect.objectContaining({ method: 'POST' }),
      );

      fetchSpy.mockRestore();
    });
  });
});
