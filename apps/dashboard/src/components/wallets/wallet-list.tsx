'use client';

import { useEffect, useState } from 'react';
import { Wallet as WalletIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { mockWallets } from '@/lib/mock-data';
import { WalletBalanceCard } from './wallet-balance-card';
import { CreateWalletDialog } from './create-wallet-dialog';
import type { Wallet } from '@/types';

export function WalletList() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listWallets()
      .then(setWallets)
      .catch(() => setWallets(mockWallets))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border/50 text-muted-foreground">
        <WalletIcon className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm font-medium">No wallets</p>
        <p className="mt-1 text-xs">Create a wallet to get started</p>
        <CreateWalletDialog
          trigger={
            <Button variant="outline" size="sm" className="mt-4">
              Create Wallet
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {wallets.map((wallet) => (
        <WalletBalanceCard key={wallet.id} wallet={wallet} />
      ))}
    </div>
  );
}
