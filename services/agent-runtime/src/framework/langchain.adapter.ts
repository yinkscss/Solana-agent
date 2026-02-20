import type { AgentFrameworkType } from '../types/index.js';
import { BaseAdapter } from './base.adapter.js';

export class LangChainAdapter extends BaseAdapter {
  readonly name: AgentFrameworkType = 'langchain';
}
