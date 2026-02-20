import type { z } from 'zod';
import type { ToolResult } from '../types/index.js';

export interface Tool {
  name: string;
  description: string;
  parameters: z.ZodObject<z.ZodRawShape>;
  execute(params: unknown): Promise<ToolResult>;
}
