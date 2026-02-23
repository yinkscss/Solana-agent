import type { Agent, Wallet, Transaction, Policy, DashboardStats, ServiceHealth } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

class ApiClient {
  private apiKey: string | null = null;

  setApiKey(key: string) {
    this.apiKey = key;
  }

  getApiKey() {
    return this.apiKey;
  }

  private async request<T>(path: string, opts?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {}),
    };
    const response = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: { ...headers, ...(opts?.headers as Record<string, string>) },
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const json = await response.json();
    return (json.data ?? json) as T;
  }

  async validateApiKey(): Promise<boolean> {
    try {
      await this.request('/api/v1/health');
      return true;
    } catch {
      return false;
    }
  }

  // Agents
  async listAgents(): Promise<Agent[]> {
    return this.request('/api/v1/agents');
  }

  async getAgent(id: string): Promise<Agent> {
    return this.request(`/api/v1/agents/${id}`);
  }

  async createAgent(data: {
    orgId: string;
    walletId?: string;
    name: string;
    description?: string;
    framework?: string;
    llmProvider?: string;
    model?: string;
    systemPrompt: string;
    tools?: string[];
  }): Promise<Agent> {
    return this.request('/api/v1/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAgentStatus(id: string, status: Agent['status']): Promise<Agent> {
    return this.request(`/api/v1/agents/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async startAgent(id: string): Promise<Agent> {
    return this.request(`/api/v1/agents/${id}/start`, { method: 'POST' });
  }

  async pauseAgent(id: string): Promise<Agent> {
    return this.request(`/api/v1/agents/${id}/pause`, { method: 'POST' });
  }

  async stopAgent(id: string): Promise<Agent> {
    return this.request(`/api/v1/agents/${id}/stop`, { method: 'POST' });
  }

  // Wallets
  async listWallets(): Promise<Wallet[]> {
    return this.request('/api/v1/wallets');
  }

  async createWallet(data: {
    agentId: string;
    label: string;
    provider?: string;
    network?: string;
  }): Promise<Wallet> {
    return this.request('/api/v1/wallets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getWalletBalance(id: string): Promise<{ balance: number }> {
    return this.request(`/api/v1/wallets/${id}/balance`);
  }

  // Transactions
  async listTransactions(params?: {
    walletId?: string;
    status?: string;
    type?: string;
  }): Promise<Transaction[]> {
    const query = new URLSearchParams();
    if (params?.walletId) query.set('wallet_id', params.walletId);
    if (params?.status) query.set('status', params.status);
    if (params?.type) query.set('type', params.type);
    const qs = query.toString();
    return this.request(`/api/v1/transactions${qs ? `?${qs}` : ''}`);
  }

  // Policies
  async listPolicies(walletId?: string): Promise<Policy[]> {
    const qs = walletId ? `?wallet_id=${walletId}` : '';
    return this.request(`/api/v1/policies${qs}`);
  }

  async createPolicy(
    data: Omit<Policy, 'id' | 'version' | 'createdAt' | 'updatedAt'>,
  ): Promise<Policy> {
    return this.request('/api/v1/policies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Dashboard
  async getStats(): Promise<DashboardStats> {
    return this.request('/api/v1/dashboard/stats');
  }

  async getServiceHealth(): Promise<ServiceHealth[]> {
    return this.request('/api/v1/health/services');
  }
}

export const api = new ApiClient();
