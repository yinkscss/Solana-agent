"use client";

import { Badge } from "@/components/ui/badge";
import { LiveIndicator } from "@/components/live-indicator";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { useWebSocket } from "@/hooks/use-websocket";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/ws";

export default function TransactionsPage() {
  const { connected, lastEvent } = useWebSocket(WS_URL, "default");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">
            View and filter transaction history
          </p>
        </div>
        <div className="flex items-center gap-2">
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
