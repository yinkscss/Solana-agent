export interface SandboxService {
  executeInSandbox(
    code: string,
    context: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<unknown>;
}

const BLOCKED_GLOBALS = [
  'process',
  'require',
  'Bun',
  '__dirname',
  '__filename',
  'globalThis',
] as const;

export class SandboxError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'SandboxError';
  }
}

export const createSandboxService = (): SandboxService => {
  const executeInSandbox = async (
    code: string,
    context: Record<string, unknown>,
    timeoutMs = 5000,
  ): Promise<unknown> => {
    const contextKeys = Object.keys(context);
    const contextValues = Object.values(context);

    const blockedParams = BLOCKED_GLOBALS.map((g) => `${g}`).join(', ');

    const wrappedCode = `
      return (async (${blockedParams}) => {
        'use strict';
        ${code}
      })(${BLOCKED_GLOBALS.map(() => 'undefined').join(', ')});
    `;

    const fn = new Function(...contextKeys, wrappedCode);

    const execution = fn(...contextValues);

    const timeout = new Promise<never>((_, reject) => {
      const id = setTimeout(() => {
        reject(new SandboxError(`Sandbox execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      if (typeof id === 'object' && 'unref' in id) {
        (id as NodeJS.Timeout).unref();
      }
    });

    try {
      return await Promise.race([execution, timeout]);
    } catch (err) {
      if (err instanceof SandboxError) throw err;
      throw new SandboxError(
        err instanceof Error ? err.message : 'Unknown sandbox error',
        err,
      );
    }
  };

  return { executeInSandbox };
};
