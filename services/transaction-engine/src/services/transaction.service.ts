import type { TransactionStatus } from '@solagent/common';
import type { EventPublisher, TransactionEvent } from '@solagent/events';
import type { BuilderService } from './builder.service';
import type { SimulatorService } from './simulator.service';
import type { SignerService } from './signer.service';
import type { PolicyClientService } from './policy-client.service';
import type { SubmitterService } from './submitter.service';
import type { ConfirmationService } from './confirmation.service';
import type { PriorityFeeService } from './priority-fee.service';
import { transition } from '../state-machine/transaction-state';
import type {
  CreateTransactionParams,
  TransactionRecord,
  TransactionListOptions,
} from '../types';
import { TransactionNotFoundError } from '../types';

export interface TransactionRepository {
  insert: (record: Omit<TransactionRecord, 'createdAt' | 'confirmedAt'>) => Promise<TransactionRecord>;
  findById: (id: string) => Promise<TransactionRecord | null>;
  findByWalletId: (walletId: string, opts: TransactionListOptions) => Promise<{ data: TransactionRecord[]; total: number }>;
  updateStatus: (id: string, status: TransactionStatus, patch?: Partial<TransactionRecord>) => Promise<TransactionRecord | null>;
}

export interface TransactionService {
  createAndExecuteTransaction: (params: CreateTransactionParams) => Promise<TransactionRecord>;
  getTransaction: (txId: string) => Promise<TransactionRecord>;
  getTransactionsByWallet: (walletId: string, opts: TransactionListOptions) => Promise<{ data: TransactionRecord[]; total: number }>;
  retryTransaction: (txId: string) => Promise<TransactionRecord>;
}

interface TransactionDeps {
  repo: TransactionRepository;
  builder: BuilderService;
  simulator: SimulatorService;
  signer: SignerService;
  policyClient: PolicyClientService;
  submitter: SubmitterService;
  confirmation: ConfirmationService;
  priorityFee: PriorityFeeService;
  publisher?: EventPublisher;
  maxRetries: number;
}

const mapEventName = (status: TransactionStatus): TransactionEvent['event'] | null => {
  const mapping: Partial<Record<TransactionStatus, TransactionEvent['event']>> = {
    pending: 'pending',
    submitted: 'submitted',
    confirmed: 'confirmed',
    failed: 'failed',
    signing: 'signed',
    simulating: 'simulated',
  };
  return mapping[status] ?? null;
};

export const createTransactionService = (deps: TransactionDeps): TransactionService => {
  const {
    repo,
    builder,
    simulator,
    signer,
    policyClient,
    submitter,
    confirmation,
    priorityFee,
    publisher,
    maxRetries,
  } = deps;

  const publishEvent = async (record: TransactionRecord, status: TransactionStatus, details?: Record<string, unknown>) => {
    if (!publisher) return;
    const event = mapEventName(status);
    if (!event) return;

    try {
      await publisher.publishTransactionEvent({
        txId: record.id,
        walletId: record.walletId,
        agentId: record.agentId ?? undefined,
        event,
        details,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Non-critical: log but don't fail the transaction
    }
  };

  const updateStatus = async (
    record: TransactionRecord,
    target: TransactionStatus,
    patch?: Partial<TransactionRecord>,
  ): Promise<TransactionRecord> => {
    const nextStatus = transition(record.status, target);
    const updated = await repo.updateStatus(record.id, nextStatus, patch);
    if (!updated) throw new TransactionNotFoundError(record.id);
    await publishEvent(updated, nextStatus, patch as Record<string, unknown>);
    return updated;
  };

  const createAndExecuteTransaction = async (params: CreateTransactionParams): Promise<TransactionRecord> => {
    const id = crypto.randomUUID();

    let record = await repo.insert({
      id,
      walletId: params.walletId,
      agentId: params.agentId ?? null,
      signature: null,
      type: params.type,
      status: 'pending',
      instructions: params.instructions ?? [],
      feeLamports: null,
      gasless: params.gasless ?? false,
      metadata: params.metadata ?? {},
      errorMessage: null,
      retryCount: 0,
    });

    await publishEvent(record, 'pending');

    record = await updateStatus(record, 'simulating');

    const tx = await buildTransactionFromParams(params);

    const simResult = await simulator.simulateTransaction(tx);
    if (!simResult.success) {
      return await updateStatus(record, 'simulation_failed', {
        errorMessage: simResult.error ?? 'Simulation failed',
      });
    }

    record = await updateStatus(record, 'policy_eval');

    const policyResult = await policyClient.evaluateTransaction(params.walletId, {
      amount: params.amount,
      tokenMint: params.tokenMint,
      destinationAddress: params.destination,
      instructions: params.instructions,
    });

    if (policyResult.decision === 'deny') {
      return await updateStatus(record, 'rejected', {
        errorMessage: policyResult.reasons.join('; '),
      });
    }

    if (policyResult.decision === 'require_approval') {
      return await updateStatus(record, 'awaiting_approval', {
        metadata: { ...record.metadata, approvalId: policyResult.approvalId },
      });
    }

    record = await updateStatus(record, 'signing');

    const txBase64 = Buffer.from(tx.serialize({ requireAllSignatures: false })).toString('base64');
    let signedTxBase64: string;
    try {
      signedTxBase64 = await signer.signTransaction(params.walletId, txBase64);
    } catch (err) {
      return await updateStatus(record, 'signing_failed', {
        errorMessage: err instanceof Error ? err.message : 'Signing failed',
      });
    }

    record = await updateStatus(record, 'submitting');

    let fee: number | undefined;
    try {
      fee = await priorityFee.calculatePriorityFee([], params.urgency ?? 'medium');
    } catch {
      // non-critical
    }

    let signature: string;
    try {
      signature = await submitter.submitTransaction(signedTxBase64, {
        gasless: params.gasless,
      });
    } catch (err) {
      const failedRecord = await updateStatus(record, 'submitted');
      return await updateStatus(failedRecord, 'failed', {
        errorMessage: err instanceof Error ? err.message : 'Submission failed',
      });
    }

    record = await updateStatus(record, 'submitted', {
      signature,
      feeLamports: fee ? BigInt(fee) : null,
    });

    const confirmResult = await confirmation.waitForConfirmation(signature);

    if (confirmResult.confirmed) {
      return await updateStatus(record, 'confirmed', {
        confirmedAt: new Date(),
      } as Partial<TransactionRecord>);
    }

    record = await updateStatus(record, 'failed', {
      errorMessage: confirmResult.error ?? 'Confirmation failed',
    });

    if (record.retryCount < maxRetries) {
      record = await updateStatus(record, 'retrying', {
        retryCount: record.retryCount + 1,
      });
      return await executeRetry(record, params);
    }

    return await updateStatus(record, 'permanently_failed');
  };

  const executeRetry = async (record: TransactionRecord, params: CreateTransactionParams): Promise<TransactionRecord> => {
    const tx = await buildTransactionFromParams(params);
    const txBase64 = Buffer.from(tx.serialize({ requireAllSignatures: false })).toString('base64');
    const signedTxBase64 = await signer.signTransaction(params.walletId, txBase64);

    record = await updateStatus(record, 'submitting');

    let signature: string;
    try {
      signature = await submitter.submitTransaction(signedTxBase64, {
        gasless: params.gasless,
      });
    } catch (err) {
      const failedRecord = await updateStatus(record, 'submitted');
      const errorRecord = await updateStatus(failedRecord, 'failed', {
        errorMessage: err instanceof Error ? err.message : 'Retry submission failed',
      });

      if (errorRecord.retryCount >= maxRetries) {
        return await updateStatus(errorRecord, 'permanently_failed');
      }
      return errorRecord;
    }

    record = await updateStatus(record, 'submitted', { signature });

    const confirmResult = await confirmation.waitForConfirmation(signature);
    if (confirmResult.confirmed) {
      return await updateStatus(record, 'confirmed', {
        confirmedAt: new Date(),
      } as Partial<TransactionRecord>);
    }

    return await updateStatus(record, 'failed', {
      errorMessage: confirmResult.error ?? 'Retry confirmation failed',
    });
  };

  const buildTransactionFromParams = async (params: CreateTransactionParams) => {
    if (params.type === 'transfer' && params.destination && params.amount) {
      if (params.tokenMint) {
        return builder.buildTokenTransferTransaction(
          params.walletId,
          params.destination,
          params.tokenMint,
          BigInt(params.amount),
        );
      }
      return builder.buildTransferTransaction(
        params.walletId,
        params.destination,
        BigInt(params.amount),
      );
    }

    return builder.buildCustomTransaction([], params.walletId);
  };

  const getTransaction = async (txId: string): Promise<TransactionRecord> => {
    const record = await repo.findById(txId);
    if (!record) throw new TransactionNotFoundError(txId);
    return record;
  };

  const getTransactionsByWallet = async (
    walletId: string,
    opts: TransactionListOptions,
  ) => repo.findByWalletId(walletId, opts);

  const retryTransaction = async (txId: string): Promise<TransactionRecord> => {
    let record = await getTransaction(txId);

    if (record.status !== 'failed' && record.status !== 'permanently_failed') {
      throw new TransactionNotFoundError(txId);
    }

    record = await repo.updateStatus(record.id, 'retrying', {
      retryCount: record.retryCount + 1,
      errorMessage: null,
    }) as TransactionRecord;

    await publishEvent(record, 'retrying' as TransactionStatus);

    return await executeRetry(record, {
      walletId: record.walletId,
      agentId: record.agentId ?? undefined,
      type: record.type,
      instructions: record.instructions,
      gasless: record.gasless,
    });
  };

  return {
    createAndExecuteTransaction,
    getTransaction,
    getTransactionsByWallet,
    retryTransaction,
  };
};
