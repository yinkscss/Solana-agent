import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import type Redis from 'ioredis';
import type { BalanceInfo, TokenBalanceInfo } from '../types';
import type { WalletService } from './wallet.service';

const BALANCE_TTL_SECONDS = 5;
const BALANCE_KEY_PREFIX = 'wallet:balance:';
const TOKEN_BALANCE_KEY_PREFIX = 'wallet:tokens:';

export const createBalanceService = (
  walletService: WalletService,
  redis: Redis,
  connection: Connection,
) => {
  const balanceCacheKey = (walletId: string) => `${BALANCE_KEY_PREFIX}${walletId}`;
  const tokenCacheKey = (walletId: string) => `${TOKEN_BALANCE_KEY_PREFIX}${walletId}`;

  const getBalance = async (walletId: string): Promise<BalanceInfo> => {
    const cached = await redis.get(balanceCacheKey(walletId));
    if (cached) return JSON.parse(cached, reviveBigInt);

    const wallet = await walletService.getWallet(walletId);
    const publicKey = new PublicKey(wallet.publicKey);
    const lamports = await connection.getBalance(publicKey);

    const info: BalanceInfo = {
      walletId,
      publicKey: wallet.publicKey,
      solBalance: lamports / 1e9,
      lamports: BigInt(lamports),
    };

    await redis.setex(
      balanceCacheKey(walletId),
      BALANCE_TTL_SECONDS,
      JSON.stringify(info, bigIntReplacer),
    );
    return info;
  };

  const getTokenBalances = async (walletId: string): Promise<TokenBalanceInfo[]> => {
    const cached = await redis.get(tokenCacheKey(walletId));
    if (cached) return JSON.parse(cached);

    const wallet = await walletService.getWallet(walletId);
    const publicKey = new PublicKey(wallet.publicKey);

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
      programId: TOKEN_PROGRAM_ID,
    });

    const balances: TokenBalanceInfo[] = tokenAccounts.value.map((account) => {
      const parsed = account.account.data.parsed.info;
      return {
        mint: parsed.mint,
        amount: parsed.tokenAmount.amount,
        decimals: parsed.tokenAmount.decimals,
        uiAmount: parsed.tokenAmount.uiAmount ?? 0,
        ataAddress: account.pubkey.toBase58(),
      };
    });

    await redis.setex(
      tokenCacheKey(walletId),
      BALANCE_TTL_SECONDS,
      JSON.stringify(balances),
    );
    return balances;
  };

  const invalidateBalanceCache = async (walletId: string): Promise<void> => {
    await redis.del(balanceCacheKey(walletId), tokenCacheKey(walletId));
  };

  return { getBalance, getTokenBalances, invalidateBalanceCache };
};

export type BalanceService = ReturnType<typeof createBalanceService>;

const bigIntReplacer = (_key: string, value: unknown): unknown =>
  typeof value === 'bigint' ? value.toString() + 'n' : value;

const reviveBigInt = (_key: string, value: unknown): unknown => {
  if (typeof value === 'string' && /^\d+n$/.test(value)) {
    return BigInt(value.slice(0, -1));
  }
  return value;
};
