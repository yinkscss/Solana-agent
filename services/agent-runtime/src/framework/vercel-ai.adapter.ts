import type { AgentFrameworkType } from '../types/index.js';
import { BaseAdapter } from './base.adapter.js';

export class VercelAIAdapter extends BaseAdapter {
  readonly name: AgentFrameworkType = 'vercel-ai';
}
