import type { AgentFrameworkType } from '../types/index.js';
import { BaseAdapter } from './base.adapter.js';

export class SolAgentAdapter extends BaseAdapter {
  readonly name: AgentFrameworkType = 'solagent';
}
