import type { PolicyEvaluation } from '../types';
import { PolicyDeniedError } from '../types';

export interface PolicyClientService {
  evaluateTransaction: (
    walletId: string,
    txDetails: {
      amount?: string;
      tokenMint?: string;
      destinationAddress?: string;
      programIds?: string[];
      instructions?: unknown[];
    },
  ) => Promise<PolicyEvaluation>;
}

export const createPolicyClientService = (policyEngineUrl: string): PolicyClientService => {
  const evaluateTransaction = async (
    walletId: string,
    txDetails: {
      amount?: string;
      tokenMint?: string;
      destinationAddress?: string;
      programIds?: string[];
      instructions?: unknown[];
    },
  ): Promise<PolicyEvaluation> => {
    const url = `${policyEngineUrl}/api/v1/evaluate`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId, ...txDetails }),
      });
    } catch {
      throw new PolicyDeniedError(['Policy engine unreachable — fail-secure deny']);
    }

    if (!response.ok) {
      throw new PolicyDeniedError([`Policy engine returned HTTP ${response.status}`]);
    }

    const json = (await response.json()) as { data: PolicyEvaluation };
    return json.data;
  };

  return { evaluateTransaction };
};
