import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import type { SimulationResult } from '../types';

export interface SimulatorService {
  simulateTransaction: (transaction: Transaction | VersionedTransaction) => Promise<SimulationResult>;
}

export const createSimulatorService = (connection: Connection): SimulatorService => {
  const simulateTransaction = async (transaction: Transaction | VersionedTransaction): Promise<SimulationResult> => {
    const response = await connection.simulateTransaction(transaction as any);
    const { value } = response;

    if (value.err) {
      return {
        success: false,
        logs: value.logs ?? [],
        unitsConsumed: value.unitsConsumed ?? 0,
        error: typeof value.err === 'string' ? value.err : JSON.stringify(value.err),
      };
    }

    return {
      success: true,
      logs: value.logs ?? [],
      unitsConsumed: value.unitsConsumed ?? 0,
    };
  };

  return { simulateTransaction };
};
