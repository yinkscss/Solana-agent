import type { DeFiProtocolAdapter } from './adapter.interface';

export interface AdapterRegistry {
  register(adapter: DeFiProtocolAdapter): void;
  get(name: string): DeFiProtocolAdapter | undefined;
  getAll(): DeFiProtocolAdapter[];
  findByProgramId(programId: string): DeFiProtocolAdapter | undefined;
}

export const createAdapterRegistry = (): AdapterRegistry => {
  const adapters = new Map<string, DeFiProtocolAdapter>();
  const programIndex = new Map<string, string>();

  return {
    register(adapter) {
      adapters.set(adapter.name, adapter);
      for (const pid of adapter.programIds) {
        programIndex.set(pid, adapter.name);
      }
    },

    get(name) {
      return adapters.get(name);
    },

    getAll() {
      return [...adapters.values()];
    },

    findByProgramId(programId) {
      const name = programIndex.get(programId);
      if (!name) return undefined;
      return adapters.get(name);
    },
  };
};
