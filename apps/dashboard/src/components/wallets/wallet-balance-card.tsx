'use client';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wallet, Copy, Check, ExternalLink } from 'lucide-react';
import type { Wallet as WalletType } from '@/types';
import { truncateAddress } from '@/lib/format';
import { useCopyToClipboard } from '@/lib/use-copy-to-clipboard';

const networkColors: Record<string, string> = {
  'mainnet-beta': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  devnet: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  testnet: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

interface WalletBalanceCardProps {
  wallet: WalletType;
  isPrimary?: boolean;
}

export function WalletBalanceCard({ wallet, isPrimary }: WalletBalanceCardProps) {
  const { copied, copy } = useCopyToClipboard();

  const copyAddress = () => copy(wallet.address);

  return (
    <Card
      className={`border-border/50 bg-card/50 transition-colors hover:bg-accent/50 ${isPrimary ? 'ring-1 ring-violet-500/30' : ''}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">{wallet.label}</CardTitle>
          </div>
          <div className="flex items-center gap-1.5">
            {isPrimary && (
              <Badge variant="outline" className="border-violet-500/30 text-violet-400 text-[10px]">
                Primary
              </Badge>
            )}
            <Badge variant="outline" className={networkColors[wallet.network]}>
              {wallet.network}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold">{wallet.balance.toFixed(4)}</span>
          <span className="text-sm text-muted-foreground">SOL</span>
        </div>

        <div className="flex items-center gap-1.5">
          <code className="rounded bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
            {truncateAddress(wallet.address)}
          </code>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyAddress}>
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          </Button>
          {wallet.address && (
            <a
              href={`https://explorer.solana.com/address/${wallet.address}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex"
            >
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          )}
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
        </div>
      </CardFooter>
    </Card>
  );
}
