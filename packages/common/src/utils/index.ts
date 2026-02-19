import { LAMPORTS_PER_SOL } from '../constants/index.js';

export const lamportsToSol = (lamports: bigint): number =>
  Number(lamports) / Number(LAMPORTS_PER_SOL);

export const solToLamports = (sol: number): bigint =>
  BigInt(Math.round(sol * Number(LAMPORTS_PER_SOL)));

export const shortenAddress = (address: string, chars = 4): string => {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const generateId = (): string => crypto.randomUUID();

export const clampPage = (page: number, pageSize: number, total: number) => ({
  page: Math.max(1, page),
  pageSize: Math.max(1, Math.min(pageSize, 100)),
  totalPages: Math.ceil(total / Math.max(1, pageSize)),
});
