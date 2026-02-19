import type {
  CreateWalletOpts,
  KeyProvider,
  TurnkeyConfig,
  WalletRef,
} from './key-provider.interface';
import { ProviderError } from '../types';

export class TurnkeyProvider implements KeyProvider {
  readonly name = 'turnkey';
  private readonly client: TurnkeyClient;

  constructor(config: TurnkeyConfig) {
    this.client = new TurnkeyClient(config);
  }

  createWallet = async (opts: CreateWalletOpts): Promise<WalletRef> => {
    try {
      const result = await this.client.createWallet(opts.label);
      return {
        id: result.walletId,
        publicKey: result.publicKey,
        provider: this.name,
        providerRef: result.walletId,
      };
    } catch (err) {
      throw new ProviderError(this.name, `Failed to create wallet: ${String(err)}`);
    }
  };

  getPublicKey = async (walletRef: WalletRef): Promise<string> => {
    try {
      return await this.client.getPublicKey(walletRef.providerRef);
    } catch (err) {
      throw new ProviderError(this.name, `Failed to get public key: ${String(err)}`);
    }
  };

  signTransaction = async (
    walletRef: WalletRef,
    transaction: Uint8Array,
  ): Promise<Uint8Array> => {
    try {
      const payload = Buffer.from(transaction).toString('hex');
      const signatureHex = await this.client.signPayload(walletRef.providerRef, payload);
      return Buffer.from(signatureHex, 'hex');
    } catch (err) {
      throw new ProviderError(this.name, `Failed to sign transaction: ${String(err)}`);
    }
  };

  signMessage = async (
    walletRef: WalletRef,
    message: Uint8Array,
  ): Promise<Uint8Array> => {
    try {
      const payload = Buffer.from(message).toString('hex');
      const signatureHex = await this.client.signPayload(walletRef.providerRef, payload);
      return Buffer.from(signatureHex, 'hex');
    } catch (err) {
      throw new ProviderError(this.name, `Failed to sign message: ${String(err)}`);
    }
  };
}

class TurnkeyClient {
  private readonly apiKey: string;
  private readonly organizationId: string;
  private readonly baseUrl = 'https://api.turnkey.com';
  private readonly privateKey: string;

  constructor(config: TurnkeyConfig) {
    if (!config.apiKey || !config.organizationId || !config.privateKey) {
      throw new ProviderError('turnkey', 'Missing required Turnkey configuration');
    }
    this.apiKey = config.apiKey;
    this.organizationId = config.organizationId;
    this.privateKey = config.privateKey;
  }

  createWallet = async (
    label: string,
  ): Promise<{ walletId: string; publicKey: string }> => {
    const body = {
      type: 'ACTIVITY_TYPE_CREATE_WALLET',
      organizationId: this.organizationId,
      parameters: {
        walletName: label,
        accounts: [
          {
            curve: 'CURVE_ED25519',
            pathFormat: 'PATH_FORMAT_BIP32',
            path: "m/44'/501'/0'/0'",
          },
        ],
      },
      timestampMs: Date.now().toString(),
    };

    const response = await this.post('/public/v1/submit/create_wallet', body);
    const wallet = response.activity?.result?.createWalletResult;
    if (!wallet) {
      throw new Error('Invalid Turnkey response: missing wallet result');
    }

    return {
      walletId: wallet.walletId,
      publicKey: wallet.addresses?.[0] ?? '',
    };
  };

  getPublicKey = async (walletId: string): Promise<string> => {
    const body = {
      organizationId: this.organizationId,
      walletId,
    };
    const response = await this.post('/public/v1/query/get_wallet_accounts', body);
    const accounts = response.accounts ?? [];
    if (accounts.length === 0) {
      throw new Error('No accounts found for wallet');
    }
    return accounts[0].address;
  };

  signPayload = async (walletId: string, payload: string): Promise<string> => {
    const body = {
      type: 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD',
      organizationId: this.organizationId,
      parameters: {
        signWith: walletId,
        payload,
        encoding: 'PAYLOAD_ENCODING_HEXADECIMAL',
        hashFunction: 'HASH_FUNCTION_NOT_APPLICABLE',
      },
      timestampMs: Date.now().toString(),
    };

    const response = await this.post('/public/v1/submit/sign_raw_payload', body);
    const signResult = response.activity?.result?.signRawPayloadResult;
    if (!signResult) {
      throw new Error('Invalid Turnkey response: missing sign result');
    }
    return `${signResult.r}${signResult.s}`;
  };

  private post = async (path: string, body: unknown): Promise<any> => {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Stamp': await this.createStamp(JSON.stringify(body)),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Turnkey API error (${response.status}): ${text}`);
    }

    return response.json();
  };

  private createStamp = async (_payload: string): Promise<string> => {
    // In production, this signs the payload with the API private key
    // using the Turnkey stamp protocol (ECDSA P-256 over the payload hash).
    // For now, return the API key as the stamp header — a real implementation
    // would use @turnkey/sdk-server's stamp utilities.
    return JSON.stringify({
      publicKey: this.apiKey,
      scheme: 'SIGNATURE_SCHEME_TK_API_P256',
      signature: this.privateKey,
    });
  };
}
