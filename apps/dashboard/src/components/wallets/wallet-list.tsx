"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { mockWallets } from "@/lib/mock-data";
import { WalletBalanceCard } from "./wallet-balance-card";
import type { Wallet } from "@/types";

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-xl border border-border/50 bg-card/30"
          />
        ))}
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border/50 text-muted-foreground">
        No wallets found.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {wallets.map((wallet) => (
        <WalletBalanceCard key={wallet.id} wallet={wallet} />
      ))}
    </div>
  );
}
