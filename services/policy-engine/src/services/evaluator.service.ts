import type Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { RuleEngine } from '../rules/rule-engine.js';
import type { EvaluationContext } from '../rules/rule.interface.js';
import type {
  PolicyDecision,
  PolicyEvaluation,
  TransactionDetails,
} from '../types/index.js';
import type { PolicyService } from './policy.service.js';
import type { EventPublisher, PolicyEvaluationEvent } from '@solagent/events';

export class EvaluatorService {
  private ruleEngine: RuleEngine;

  constructor(
    private policyService: PolicyService,
    private redis: Redis,
    private eventPublisher?: EventPublisher,
  ) {
    this.ruleEngine = new RuleEngine();
  }

  evaluateTransaction = async (
    walletId: string,
    txDetails: TransactionDetails,
  ): Promise<PolicyEvaluation> => {
    const evalId = randomUUID();
    const activePolicies = await this.policyService.getActivePoliciesForWallet(walletId);

    if (activePolicies.length === 0) {
      const result: PolicyEvaluation = {
        decision: 'allow',
        reasons: ['No active policies'],
        evaluatedPolicies: [],
      };
      await this.publishEvaluation(evalId, walletId, result);
      return result;
    }

    const context: EvaluationContext = {
      redis: this.redis,
      walletId,
      timestamp: new Date(),
    };

    const evaluatedPolicies: PolicyEvaluation['evaluatedPolicies'] = [];
    let finalDecision: PolicyDecision = 'allow';
    const reasons: string[] = [];
    let approvalId: string | undefined;

    for (const policy of activePolicies) {
      const ruleResults = await this.ruleEngine.evaluateRules(
        policy.rules,
        txDetails,
        context,
      );

      const denied = ruleResults.find((r) => r.decision === 'deny');
      if (denied) {
        evaluatedPolicies.push({
          policyId: policy.id,
          decision: 'deny',
          reason: denied.reason,
        });

        finalDecision = 'deny';
        if (denied.reason) reasons.push(denied.reason);
        break;
      }

      const needsApproval = ruleResults.find((r) => r.decision === 'require_approval');
      if (needsApproval) {
        evaluatedPolicies.push({
          policyId: policy.id,
          decision: 'require_approval',
          reason: needsApproval.reason,
        });

        if (finalDecision === 'allow') {
          finalDecision = 'require_approval';
          approvalId ??= randomUUID();
        }
        if (needsApproval.reason) reasons.push(needsApproval.reason);
        continue;
      }

      evaluatedPolicies.push({ policyId: policy.id, decision: 'allow' });
    }

    if (reasons.length === 0 && finalDecision === 'allow') {
      reasons.push('All policies passed');
    }

    const result: PolicyEvaluation = { decision: finalDecision, reasons, approvalId, evaluatedPolicies };
    await this.publishEvaluation(evalId, walletId, result);
    return result;
  };

  private publishEvaluation = async (
    evalId: string,
    walletId: string,
    evaluation: PolicyEvaluation,
  ): Promise<void> => {
    if (!this.eventPublisher) return;

    const event: PolicyEvaluationEvent = {
      evalId,
      txId: evalId,
      walletId,
      decision: evaluation.decision,
      reasons: evaluation.reasons,
      timestamp: new Date().toISOString(),
    };

    try {
      await this.eventPublisher.publishPolicyEvaluation(event);
    } catch {
      // Non-critical: log but don't fail the evaluation
      console.error(`Failed to publish policy evaluation event: ${evalId}`);
    }
  };
}
