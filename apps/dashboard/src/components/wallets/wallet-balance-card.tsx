"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, ExternalLink } from "lucide-react";
import type { Wallet } from "@/types";

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const networkColors: Record<string, string> = {
  "mainnet-beta": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  devnet: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  testnet: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  inactive: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  locked: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function WalletBalanceCard({ wallet }: { wallet: Wallet }) {
  const [copied, setCopied] = useState(false);

  function copyAddress() {
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const explorerUrl =
    wallet.network === "mainnet-beta"
      ? `https://solscan.io/account/${wallet.address}`
      : `https://solscan.io/account/${wallet.address}?cluster=${wallet.network}`;

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{wallet.label}</CardTitle>
            <div className="mt-1 flex items-center gap-1.5">
              <code className="text-xs text-muted-foreground">
                {truncateAddress(wallet.address)}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={copyAddress}
              >
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
          <Badge variant="outline" className={statusColors[wallet.status]}>
            {wallet.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{wallet.balance} SOL</div>
        <div className="mt-3 flex items-center gap-2 text-xs">
          <Badge variant="outline" className={networkColors[wallet.network]}>
            {wallet.network}
          </Badge>
          <span className="text-muted-foreground">
            Provider: {wallet.keyProvider}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
