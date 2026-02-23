'use client';

import { Badge } from '@/components/ui/badge';
import { LiveIndicator } from '@/components/live-indicator';
import { TransactionTable } from '@/components/transactions/transaction-table';
import { useWebSocketContext } from '@/lib/websocket-context';

export default function TransactionsPage() {
  const { connected, lastEvent } = useWebSocketContext();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor and filter on-chain transaction history across all wallets.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {connected && (
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            >
              Live
            </Badge>
          )}
          <LiveIndicator connected={connected} />
        </div>
      </div>

      <TransactionTable lastWsEvent={lastEvent} />
    </div>
  );
}
