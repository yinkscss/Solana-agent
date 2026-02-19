import type { Context } from 'hono';
import type { EvaluatorService } from '../services/evaluator.service.js';
import type { TransactionDetails } from '../types/index.js';

export class EvaluationController {
  constructor(private evaluatorService: EvaluatorService) {}

  evaluateTransaction = async (c: Context) => {
    const body = c.get('validatedBody') as {
      walletId: string;
      amount: bigint;
      tokenMint: string;
      destinationAddress: string;
      programIds: string[];
      instructions: unknown[];
    };

    const txDetails: TransactionDetails = {
      walletId: body.walletId,
      amount: body.amount,
      tokenMint: body.tokenMint,
      destinationAddress: body.destinationAddress,
      programIds: body.programIds,
      instructions: body.instructions,
    };

    try {
      const evaluation = await this.evaluatorService.evaluateTransaction(
        body.walletId,
        txDetails,
      );

      return c.json({ success: true, data: evaluation });
    } catch (err) {
      console.error('Policy evaluation failed, defaulting to DENY:', err);
      return c.json(
        {
          success: true,
          data: {
            decision: 'deny' as const,
            reasons: ['Policy evaluation encountered an error — fail-secure deny'],
            evaluatedPolicies: [],
          },
        },
        200,
      );
    }
  };
}
