import { describe, it, expect } from 'vitest';
import { createSandboxService, SandboxError } from '../src/services/sandbox.service';

describe('SandboxService', () => {
  const sandbox = createSandboxService();

  it('executes simple expressions and returns result', async () => {
    const result = await sandbox.executeInSandbox('return 1 + 2;', {});
    expect(result).toBe(3);
  });

  it('injects context variables', async () => {
    const result = await sandbox.executeInSandbox('return x * y;', { x: 3, y: 7 });
    expect(result).toBe(21);
  });

  it('supports async code', async () => {
    const result = await sandbox.executeInSandbox(
      'const val = await Promise.resolve(42); return val;',
      {},
    );
    expect(result).toBe(42);
  });

  it('can call injected functions', async () => {
    const getBalance = async (walletId: string) => ({ balance: 100, walletId });
    const result = await sandbox.executeInSandbox(
      'return await getBalance("w1");',
      { getBalance },
    );
    expect(result).toEqual({ balance: 100, walletId: 'w1' });
  });

  it('enforces timeout', async () => {
    await expect(
      sandbox.executeInSandbox(
        'await new Promise(r => setTimeout(r, 10000)); return "done";',
        {},
        50,
      ),
    ).rejects.toThrow('timed out');
  });

  it('wraps runtime errors as SandboxError', async () => {
    await expect(
      sandbox.executeInSandbox('throw new Error("boom");', {}),
    ).rejects.toThrow(SandboxError);

    await expect(
      sandbox.executeInSandbox('throw new Error("boom");', {}),
    ).rejects.toThrow('boom');
  });

  it('blocks access to process', async () => {
    const result = await sandbox.executeInSandbox(
      'return typeof process;',
      {},
    );
    expect(result).toBe('undefined');
  });

  it('blocks access to require', async () => {
    const result = await sandbox.executeInSandbox(
      'return typeof require;',
      {},
    );
    expect(result).toBe('undefined');
  });

  it('handles code that returns undefined', async () => {
    const result = await sandbox.executeInSandbox('let x = 1;', {});
    expect(result).toBeUndefined();
  });

  it('handles non-Error throws as SandboxError', async () => {
    await expect(
      sandbox.executeInSandbox('throw "string error";', {}),
    ).rejects.toThrow(SandboxError);
  });
});
