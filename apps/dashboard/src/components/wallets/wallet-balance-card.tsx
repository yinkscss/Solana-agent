'use client';

import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wallet, Copy, Check } from 'lucide-react';
import type { Wallet as WalletType } from '@/types';

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const networkColors: Record<string, string> = {
  'mainnet-beta': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  devnet: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  testnet: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

export function WalletBalanceCard({ wallet }: { wallet: WalletType }) {
  const [copied, setCopied] = useState(false);

  function copyAddress() {
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="border-border/50 bg-card/50 transition-colors hover:bg-accent/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">{wallet.label}</CardTitle>
          </div>
          <Badge variant="outline" className={networkColors[wallet.network]}>
            {wallet.network}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold">{wallet.balance}</span>
          <span className="text-sm text-muted-foreground">SOL</span>
        </div>

        <div className="flex items-center gap-1.5">
          <code className="rounded bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
            {truncateAddress(wallet.address)}
          </code>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyAddress}>
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      </CardContent>

      <CardFooter className="text-xs text-muted-foreground">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                wallet.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-500'
              }`}
            />
            <span className="capitalize">{wallet.status}</span>
          </div>
          <span>Created {new Date(wallet.createdAt).toLocaleDateString()}</span>
        </div>
      </CardFooter>
    </Card>
  );
}
