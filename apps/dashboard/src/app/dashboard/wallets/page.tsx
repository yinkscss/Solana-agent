"use client";

import { WalletList } from "@/components/wallets/wallet-list";

export default function WalletsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Wallets</h1>
        <p className="text-muted-foreground">
          Manage Solana wallets and monitor balances
        </p>
      </div>
      <WalletList />
    </div>
  );
}
