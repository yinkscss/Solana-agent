import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { ToolRegistry } from '../src/tools/tool-registry';
import type { Tool } from '../src/tools/tool.interface';
import type { ToolResult } from '../src/types';

const makeTool = (name: string, desc = 'test tool'): Tool => ({
  name,
  description: desc,
  parameters: z.object({ input: z.string() }),
  execute: async (): Promise<ToolResult> => ({ success: true, data: { result: name } }),
});

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('registers and retrieves a tool', () => {
    const tool = makeTool('transfer');
    registry.register(tool);
    expect(registry.get('transfer')).toBe(tool);
  });

  it('returns undefined for missing tool', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('checks existence with has()', () => {
    registry.register(makeTool('balance'));
    expect(registry.has('balance')).toBe(true);
    expect(registry.has('missing')).toBe(false);
  });

  it('returns all tools', () => {
    registry.register(makeTool('a'));
    registry.register(makeTool('b'));
    registry.register(makeTool('c'));
    expect(registry.getAll()).toHaveLength(3);
  });

  it('returns tools by names', () => {
    registry.register(makeTool('a'));
    registry.register(makeTool('b'));
    registry.register(makeTool('c'));
    const result = registry.getByNames(['a', 'c', 'missing']);
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.name)).toEqual(['a', 'c']);
  });

  it('converts to LLM tool definitions', () => {
    registry.register(makeTool('transfer', 'Transfer SOL'));
    const defs = registry.toLLMToolDefs();
    expect(defs).toHaveLength(1);
    expect(defs[0]!.name).toBe('transfer');
    expect(defs[0]!.description).toBe('Transfer SOL');
    expect(defs[0]!.parameters).toHaveProperty('type', 'object');
    expect(defs[0]!.parameters).toHaveProperty('properties');
  });

  it('overwrites tool on re-register', () => {
    registry.register(makeTool('x', 'first'));
    registry.register(makeTool('x', 'second'));
    expect(registry.get('x')?.description).toBe('second');
    expect(registry.getAll()).toHaveLength(1);
  });
});
