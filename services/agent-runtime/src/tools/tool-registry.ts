import type { ZodObject, ZodRawShape } from 'zod';
import { zodToJsonSchema } from '../tools/zod-to-schema.js';
import type { LLMToolDef } from '../llm/provider.interface.js';
import type { Tool } from './tool.interface.js';

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return [...this.tools.values()];
  }

  getByNames(names: string[]): Tool[] {
    return names.map((n) => this.tools.get(n)).filter((t): t is Tool => t !== undefined);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  toLLMToolDefs(): LLMToolDef[] {
    return this.getAll().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.parameters as ZodObject<ZodRawShape>),
    }));
  }

  toLLMToolDefsForNames(names: string[]): LLMToolDef[] {
    return this.getByNames(names).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.parameters as ZodObject<ZodRawShape>),
    }));
  }
}
