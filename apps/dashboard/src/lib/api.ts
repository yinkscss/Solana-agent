import type {
  Agent,
  Wallet,
  Transaction,
  Policy,
  DashboardStats,
  ServiceHealth,
} from "@/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

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
      "Content-Type": "application/json",
      ...(this.apiKey ? { "X-API-Key": this.apiKey } : {}),
    };
    const response = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: { ...headers, ...(opts?.headers as Record<string, string>) },
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  }

  async validateApiKey(): Promise<boolean> {
    try {
      await this.request("/api/v1/health");
      return true;
    } catch {
      return false;
    }
  }

  // Agents
  async listAgents(): Promise<Agent[]> {
    return this.request("/api/v1/agents");
  }

  async getAgent(id: string): Promise<Agent> {
    return this.request(`/api/v1/agents/${id}`);
  }

  async createAgent(
    data: Omit<Agent, "id" | "status" | "createdAt" | "updatedAt">
  ): Promise<Agent> {
    return this.request("/api/v1/agents", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateAgentStatus(
    id: string,
    status: Agent["status"]
  ): Promise<Agent> {
    return this.request(`/api/v1/agents/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  // Wallets
  async listWallets(): Promise<Wallet[]> {
    return this.request("/api/v1/wallets");
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
    if (params?.walletId) query.set("wallet_id", params.walletId);
    if (params?.status) query.set("status", params.status);
    if (params?.type) query.set("type", params.type);
    const qs = query.toString();
    return this.request(`/api/v1/transactions${qs ? `?${qs}` : ""}`);
  }

  // Policies
  async listPolicies(walletId?: string): Promise<Policy[]> {
    const qs = walletId ? `?wallet_id=${walletId}` : "";
    return this.request(`/api/v1/policies${qs}`);
  }

  async createPolicy(
    data: Omit<Policy, "id" | "version" | "createdAt" | "updatedAt">
  ): Promise<Policy> {
    return this.request("/api/v1/policies", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Dashboard
  async getStats(): Promise<DashboardStats> {
    return this.request("/api/v1/dashboard/stats");
  }

  async getServiceHealth(): Promise<ServiceHealth[]> {
    return this.request("/api/v1/health/services");
  }
}

export const api = new ApiClient();
