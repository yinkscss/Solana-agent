import type { Context } from 'hono';
import type { PolicyService } from '../services/policy.service.js';

const serializePolicy = (policy: Record<string, unknown>) =>
  JSON.parse(
    JSON.stringify(policy, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

export class PolicyController {
  constructor(private policyService: PolicyService) {}

  createPolicy = async (c: Context) => {
    const body = c.get('validatedBody') as {
      walletId: string;
      name: string;
      rules: any[];
    };

    const policy = await this.policyService.createPolicy(
      body.walletId,
      body.name,
      body.rules,
    );

    return c.json({ success: true, data: serializePolicy(policy) }, 201);
  };

  getPolicy = async (c: Context) => {
    const policyId = c.req.param('policyId');
    const policy = await this.policyService.getPolicy(policyId);

    if (!policy) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Policy not found' } },
        404,
      );
    }

    return c.json({ success: true, data: serializePolicy(policy) });
  };

  updatePolicy = async (c: Context) => {
    const policyId = c.req.param('policyId');
    const body = c.get('validatedBody') as { name?: string; rules?: any[] };

    const policy = await this.policyService.updatePolicy(policyId, body);

    if (!policy) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Policy not found' } },
        404,
      );
    }

    return c.json({ success: true, data: serializePolicy(policy) });
  };

  deactivatePolicy = async (c: Context) => {
    const policyId = c.req.param('policyId');
    const policy = await this.policyService.deactivatePolicy(policyId);

    if (!policy) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Policy not found' } },
        404,
      );
    }

    return c.json({ success: true, data: serializePolicy(policy) });
  };

  activatePolicy = async (c: Context) => {
    const policyId = c.req.param('policyId');
    const policy = await this.policyService.activatePolicy(policyId);

    if (!policy) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Policy not found' } },
        404,
      );
    }

    return c.json({ success: true, data: serializePolicy(policy) });
  };

  getPoliciesForWallet = async (c: Context) => {
    const walletId = c.req.param('walletId');
    const policyList = await this.policyService.getPoliciesForWallet(walletId);

    return c.json({
      success: true,
      data: policyList.map(serializePolicy),
    });
  };
}
