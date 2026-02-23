'use client';

import { WalletList } from '@/components/wallets/wallet-list';
import { CreateWalletDialog } from '@/components/wallets/create-wallet-dialog';

export default function WalletsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Wallets</h1>
          <p className="text-sm text-muted-foreground">Managed wallets across networks</p>
        </div>
        <CreateWalletDialog />
      </div>
      <WalletList />
    </div>
  );
}
