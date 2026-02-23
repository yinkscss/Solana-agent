import type { Context } from 'hono';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import type { WalletService } from '../services/wallet.service';
import type { BalanceService } from '../services/balance.service';
import type { CreateWalletBody, SignTransactionBody } from '../types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const createWalletController = (
  walletService: WalletService,
  balanceService: BalanceService,
) => {
  const resolveWallet = (param: string) =>
    UUID_RE.test(param)
      ? walletService.getWallet(param)
      : walletService.getWalletByPublicKey(param);

  const create = async (c: Context) => {
    const body = c.get('validatedBody') as CreateWalletBody;
    const wallet = await walletService.createWallet(
      body.agentId,
      body.provider,
      body.label,
      body.network,
    );
    return c.json({ data: wallet }, 201);
  };

  const getById = async (c: Context) => {
    const { walletId } = c.req.param();
    const wallet = await resolveWallet(walletId!);
    return c.json({ data: wallet });
  };

  const getBalance = async (c: Context) => {
    const { walletId } = c.req.param();
    const wallet = await resolveWallet(walletId!);
    const balance = await balanceService.getBalance(wallet.id);
    return c.json({
      data: {
        ...balance,
        lamports: balance.lamports.toString(),
      },
    });
  };

  const getTokenBalances = async (c: Context) => {
    const { walletId } = c.req.param();
    const tokens = await balanceService.getTokenBalances(walletId!);
    return c.json({ data: tokens });
  };

  const deactivate = async (c: Context) => {
    const { walletId } = c.req.param();
    const wallet = await walletService.deactivateWallet(walletId!);
    return c.json({ data: wallet });
  };

  const recover = async (c: Context) => {
    const { walletId } = c.req.param();
    const wallet = await walletService.recoverWallet(walletId!);
    return c.json({ data: wallet });
  };

  const sign = async (c: Context) => {
    const { walletId } = c.req.param();
    const body = c.get('validatedBody') as SignTransactionBody;
    const txBytes = Buffer.from(body.transaction, 'base64');
    const signedTxBytes = await walletService.signTransaction(walletId!, txBytes);

    let detachedSig: Uint8Array;
    try {
      const vtx = VersionedTransaction.deserialize(signedTxBytes);
      detachedSig = vtx.signatures[0];
    } catch {
      const tx = Transaction.from(signedTxBytes);
      detachedSig = tx.signature!;
    }

    return c.json({
      data: {
        signature: Buffer.from(detachedSig).toString('base64'),
        signedTransaction: Buffer.from(signedTxBytes).toString('base64'),
      },
    });
  };

  const getByAgent = async (c: Context) => {
    const { agentId } = c.req.param();
    const wallets = await walletService.getWalletsByAgent(agentId!);
    return c.json({ data: wallets });
  };

  const listAll = async (c: Context) => {
    const page = Number(c.req.query('page') ?? '1');
    const pageSize = Number(c.req.query('pageSize') ?? '50');
    const result = await walletService.listWallets({ page, pageSize });
    return c.json(result.data);
  };

  return {
    create,
    listAll,
    getById,
    getBalance,
    getTokenBalances,
    deactivate,
    recover,
    sign,
    getByAgent,
  };
};

export type WalletController = ReturnType<typeof createWalletController>;
