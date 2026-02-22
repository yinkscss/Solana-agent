import type { Context } from 'hono';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import type { WalletService } from '../services/wallet.service';
import type { BalanceService } from '../services/balance.service';
import type { CreateWalletBody, SignTransactionBody } from '../types';

export const createWalletController = (
  walletService: WalletService,
  balanceService: BalanceService,
) => {
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
    const wallet = await walletService.getWallet(walletId!);
    return c.json({ data: wallet });
  };

  const getBalance = async (c: Context) => {
    const { walletId } = c.req.param();
    const balance = await balanceService.getBalance(walletId!);
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

  return {
    create,
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
