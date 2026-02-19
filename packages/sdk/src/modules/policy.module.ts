import type { HttpClient } from "../http/http-client.js";
import type {
  CreatePolicyParams,
  EvaluateTransactionParams,
  Policy,
  PolicyEvaluation,
  UpdatePolicyParams,
} from "../types/index.js";

export class PolicyModule {
  constructor(private readonly http: HttpClient) {}

  create = async (params: CreatePolicyParams): Promise<Policy> =>
    this.http.post<Policy>("/api/v1/policies", params);

  get = async (policyId: string): Promise<Policy> =>
    this.http.get<Policy>(`/api/v1/policies/${policyId}`);

  update = async (
    policyId: string,
    params: UpdatePolicyParams,
  ): Promise<Policy> =>
    this.http.put<Policy>(`/api/v1/policies/${policyId}`, params);

  deactivate = async (policyId: string): Promise<Policy> =>
    this.http.delete<Policy>(`/api/v1/policies/${policyId}`);

  activate = async (policyId: string): Promise<Policy> =>
    this.http.post<Policy>(`/api/v1/policies/${policyId}/activate`);

  listByWallet = async (walletId: string): Promise<Policy[]> =>
    this.http.get<Policy[]>(`/api/v1/wallets/${walletId}/policies`);

  evaluate = async (
    params: EvaluateTransactionParams,
  ): Promise<PolicyEvaluation> =>
    this.http.post<PolicyEvaluation>("/api/v1/evaluate", params);
}
