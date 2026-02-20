import type { Context } from 'hono';
import type { DeFiService } from '../services/defi.service';
import type { SwapQuoteParams, SwapExecuteParams, StakeParams } from '../adapters/adapter.interface';

export const createDeFiController = (defiService: DeFiService) => {
  const getSwapQuote = async (c: Context) => {
    const query = c.get('validatedQuery') as {
      protocol: string;
      inputMint: string;
      outputMint: string;
      amount: string;
      slippage?: string;
      walletAddress: string;
    };

    const params: SwapQuoteParams = {
      inputMint: query.inputMint,
      outputMint: query.outputMint,
      amount: query.amount,
      slippageBps: query.slippage ? parseInt(query.slippage, 10) : undefined,
      walletAddress: query.walletAddress,
    };

    const quote = await defiService.getSwapQuote(query.protocol, params);
    return c.json({ data: quote });
  };

  const executeSwap = async (c: Context) => {
    const body = c.get('validatedBody') as {
      walletId: string;
      protocol: string;
      walletAddress: string;
      quote: SwapExecuteParams['quote'];
    };

    const result = await defiService.executeSwap(body.walletId, body.protocol, {
      walletAddress: body.walletAddress,
      quote: body.quote,
    });
    return c.json({ data: result }, 201);
  };

  const stake = async (c: Context) => {
    const body = c.get('validatedBody') as {
      walletId: string;
      protocol: string;
      walletAddress: string;
      amount: string;
      validator?: string;
    };

    const params: StakeParams = {
      walletAddress: body.walletAddress,
      amount: body.amount,
      validator: body.validator,
    };

    const result = await defiService.stake(body.walletId, body.protocol, params);
    return c.json({ data: result }, 201);
  };

  const unstake = async (c: Context) => {
    const body = c.get('validatedBody') as {
      walletId: string;
      protocol: string;
      walletAddress: string;
      amount: string;
    };

    const params: StakeParams = {
      walletAddress: body.walletAddress,
      amount: body.amount,
    };

    const result = await defiService.unstake(body.walletId, body.protocol, params);
    return c.json({ data: result }, 201);
  };

  const getPrice = async (c: Context) => {
    const mint = c.req.param('mint')!;
    const price = await defiService.getPrice(mint);
    return c.json({ data: price });
  };

  const listProtocols = async (c: Context) => {
    const protocols = defiService.listProtocols();
    return c.json({ data: protocols });
  };

  const getPoolInfo = async (c: Context) => {
    const protocol = c.req.param('protocol')!;
    const poolId = c.req.param('poolId')!;
    const pool = await defiService.getPoolInfo(protocol, poolId);
    return c.json({ data: pool });
  };

  return { getSwapQuote, executeSwap, stake, unstake, getPrice, listProtocols, getPoolInfo };
};

export type DeFiController = ReturnType<typeof createDeFiController>;
