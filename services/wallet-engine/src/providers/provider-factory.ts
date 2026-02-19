import type { KeyProvider, ProviderConfig } from './key-provider.interface';
import { LocalProvider } from './local.provider';
import { TurnkeyProvider } from './turnkey.provider';

const providers = new Map<string, KeyProvider>();

export const createKeyProvider = (
  providerName: string,
  config: ProviderConfig = {},
): KeyProvider => {
  const cached = providers.get(providerName);
  if (cached) return cached;

  const provider = buildProvider(providerName, config);
  providers.set(providerName, provider);
  return provider;
};

const buildProvider = (
  providerName: string,
  config: ProviderConfig,
): KeyProvider => {
  switch (providerName) {
    case 'local':
      return new LocalProvider();
    case 'turnkey': {
      if (!config.turnkey) {
        throw new Error('Turnkey configuration is required for turnkey provider');
      }
      return new TurnkeyProvider(config.turnkey);
    }
    default:
      throw new Error(`Unknown key provider: ${providerName}`);
  }
};

export const clearProviderCache = (): void => {
  providers.clear();
};
