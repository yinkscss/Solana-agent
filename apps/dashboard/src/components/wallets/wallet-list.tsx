'use client';

import { useEffect, useState, useCallback } from 'react';
import { Wallet as WalletIcon, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { WalletBalanceCard } from './wallet-balance-card';
import { CreateWalletDialog } from './create-wallet-dialog';
import type { Wallet } from '@/types';

async function fetchSolBalance(address: string): Promise<number> {
  try {
    const res = await fetch('https://api.devnet.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [address],
      }),
    });
    const data = await res.json();
    return (data.result?.value ?? 0) / 1_000_000_000;
  } catch {
    return 0;
  }
}

export function WalletList() {
  const { walletId, walletPublicKey, apiKey } = useAuth();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadWallets = useCallback(async () => {
    if (!walletId) {
      setLoading(false);
      return;
    }

    try {
      const stored = localStorage.getItem('solagent-extra-wallets');
      const extraWalletIds: { id: string; label: string }[] = stored ? JSON.parse(stored) : [];

      const allWalletEntries = [
        { id: walletId, label: 'My Wallet', isPrimary: true },
        ...extraWalletIds.map((w) => ({ ...w, isPrimary: false })),
      ];

      const resolved = await Promise.all(
        allWalletEntries.map(async (entry) => {
          try {
            const res = await fetch('/api/wallet-provision', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(apiKey ? { 'x-api-key': apiKey } : {}),
              },
              body: JSON.stringify({ existingWalletId: entry.id }),
            });
            if (!res.ok) return null;
            const data = await res.json();
            const address = data.publicKey || '';
            const balance = address ? await fetchSolBalance(address) : 0;

            return {
              id: data.id ?? entry.id,
              address,
              label: entry.label,
              network: 'devnet' as const,
              status: 'active' as const,
              balance,
              keyProvider: 'local',
              createdAt: new Date().toISOString(),
            } satisfies Wallet;
          } catch {
            return null;
          }
        }),
      );

      setWallets(resolved.filter(Boolean) as Wallet[]);
    } catch {
      if (walletPublicKey) {
        setWallets([
          {
            id: walletId,
            address: walletPublicKey,
            label: 'My Wallet',
            network: 'devnet',
            status: 'active',
            balance: 0,
            keyProvider: 'local',
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [walletId, walletPublicKey]);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  useEffect(() => {
    const handler = () => loadWallets();
    window.addEventListener('solagent-wallet-created', handler);
    return () => window.removeEventListener('solagent-wallet-created', handler);
  }, [loadWallets]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadWallets();
  };

  const handleWalletCreated = (newWallet: { id: string; label: string }) => {
    const stored = localStorage.getItem('solagent-extra-wallets');
    const extra: { id: string; label: string }[] = stored ? JSON.parse(stored) : [];
    extra.push(newWallet);
    localStorage.setItem('solagent-extra-wallets', JSON.stringify(extra));
    loadWallets();
  };

  if (loading) {
    return (
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border/50 text-muted-foreground">
        <WalletIcon className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm font-medium">No wallets found</p>
        <p className="mt-1 text-xs">Go to the chat to set up your wallet automatically</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <CreateWalletDialog onCreated={handleWalletCreated} />
      </div>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {wallets.map((wallet, i) => (
          <WalletBalanceCard key={wallet.id} wallet={wallet} isPrimary={i === 0} />
        ))}
      </div>
    </div>
  );
}
