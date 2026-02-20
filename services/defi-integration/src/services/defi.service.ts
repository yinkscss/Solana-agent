import type { AdapterRegistry } from '../adapters/adapter-registry';
import type { SwapQuoteParams, SwapQuote, SwapExecuteParams, StakeParams } from '../adapters/adapter.interface';
import type { PriceFeed, PriceFeedService } from './price-feed.service';
import { ProtocolNotFoundError, OperationNotSupportedError, ExternalServiceError } from '../types';

export interface DeFiService {
  getSwapQuote(protocol: string, params: SwapQuoteParams): Promise<SwapQuote>;
  executeSwap(walletId: string, protocol: string, params: SwapExecuteParams): Promise<{ transactionId: string }>;
  stake(walletId: string, protocol: string, params: StakeParams): Promise<{ transactionId: string }>;
  unstake(walletId: string, protocol: string, params: StakeParams): Promise<{ transactionId: string }>;
  getPrice(mint: string): Promise<PriceFeed>;
  listProtocols(): { name: string; programIds: string[]; capabilities: string[] }[];
  getPoolInfo(protocol: string, poolId: string): Promise<unknown>;
}

const getCapabilities = (adapter: { getSwapQuote?: unknown; buildStakeInstructions?: unknown; buildUnstakeInstructions?: unknown; buildSupplyInstructions?: unknown; buildBorrowInstructions?: unknown; getPoolInfo?: unknown }) => {
  const caps: string[] = [];
  if (adapter.getSwapQuote) caps.push('swap');
  if (adapter.buildStakeInstructions) caps.push('stake');
  if (adapter.buildUnstakeInstructions) caps.push('unstake');
  if (adapter.buildSupplyInstructions) caps.push('supply');
  if (adapter.buildBorrowInstructions) caps.push('borrow');
  if (adapter.getPoolInfo) caps.push('pool');
  return caps;
};

export const createDeFiService = (
  registry: AdapterRegistry,
  priceFeedService: PriceFeedService,
  transactionEngineUrl: string,
): DeFiService => {
  const requireAdapter = (protocol: string) => {
    const adapter = registry.get(protocol);
    if (!adapter) throw new ProtocolNotFoundError(protocol);
    return adapter;
  };

  const submitToTransactionEngine = async (walletId: string, type: string, instructions: unknown[]): Promise<string> => {
    const res = await fetch(`${transactionEngineUrl}/api/v1/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletId,
        type,
        instructions,
        metadata: { source: 'defi-integration' },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown error');
      throw new ExternalServiceError('transaction-engine', text);
    }

    const data = (await res.json()) as { data: { id: string } };
    return data.data.id;
  };

  return {
    async getSwapQuote(protocol, params) {
      const adapter = requireAdapter(protocol);
      if (!adapter.getSwapQuote) throw new OperationNotSupportedError(protocol, 'swap');
      return adapter.getSwapQuote(params);
    },

    async executeSwap(walletId, protocol, params) {
      const adapter = requireAdapter(protocol);
      if (!adapter.buildSwapInstructions) throw new OperationNotSupportedError(protocol, 'swap');

      const instructions = await adapter.buildSwapInstructions(params);
      const transactionId = await submitToTransactionEngine(walletId, 'swap', instructions);
      return { transactionId };
    },

    async stake(walletId, protocol, params) {
      const adapter = requireAdapter(protocol);
      if (!adapter.buildStakeInstructions) throw new OperationNotSupportedError(protocol, 'stake');

      const instructions = await adapter.buildStakeInstructions(params);
      const transactionId = await submitToTransactionEngine(walletId, 'stake', instructions);
      return { transactionId };
    },

    async unstake(walletId, protocol, params) {
      const adapter = requireAdapter(protocol);
      if (!adapter.buildUnstakeInstructions) throw new OperationNotSupportedError(protocol, 'unstake');

      const instructions = await adapter.buildUnstakeInstructions(params);
      const transactionId = await submitToTransactionEngine(walletId, 'unstake', instructions);
      return { transactionId };
    },

    async getPrice(mint) {
      return priceFeedService.getPrice(mint);
    },

    listProtocols() {
      return registry.getAll().map((adapter) => ({
        name: adapter.name,
        programIds: adapter.programIds,
        capabilities: getCapabilities(adapter),
      }));
    },

    async getPoolInfo(protocol, poolId) {
      const adapter = requireAdapter(protocol);
      if (!adapter.getPoolInfo) throw new OperationNotSupportedError(protocol, 'pool');
      return adapter.getPoolInfo(poolId);
    },
  };
};
