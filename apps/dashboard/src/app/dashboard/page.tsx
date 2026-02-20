"use client";

import { useEffect, useState } from "react";
import { Bot, Wallet, ArrowLeftRight, Shield, Activity, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/stat-card";
import { api } from "@/lib/api";
import { mockStats, mockTransactions, mockAgents } from "@/lib/mock-data";
import type { DashboardStats, Transaction, Agent } from "@/types";
import { AgentStatusBadge } from "@/components/agents/agent-status-badge";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    api.getStats().then(setStats).catch(() => setStats(mockStats));
    api.listTransactions().then(setRecentTx).catch(() => setRecentTx(mockTransactions.slice(0, 5)));
    api.listAgents().then(setAgents).catch(() => setAgents(mockAgents));
  }, []);

  const s = stats ?? mockStats;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your SolAgent platform
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Agents"
          value={s.totalAgents}
          description={`${s.runningAgents} running`}
          icon={Bot}
          trend={{ value: 12, positive: true }}
        />
        <StatCard
          title="Wallets"
          value={s.totalWallets}
          description="Connected wallets"
          icon={Wallet}
        />
        <StatCard
          title="Transactions (24h)"
          value={s.totalTransactions24h}
          description="Last 24 hours"
          icon={ArrowLeftRight}
          trend={{ value: 8, positive: true }}
        />
        <StatCard
          title="Active Policies"
          value={s.activePolicies}
          description="Governing wallets"
          icon={Shield}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-violet-400" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentTx.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent transactions</p>
            ) : (
              <div className="space-y-3">
                {recentTx.slice(0, 5).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-lg border border-border/30 px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs capitalize">
                        {tx.type}
                      </Badge>
                      <span className="text-sm">
                        {tx.amount} {tx.token}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          tx.status === "confirmed"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : tx.status === "pending"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-red-500/10 text-red-400 border-red-500/20"
                        }
                      >
                        {tx.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-violet-400" />
              Agent Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No agents configured</p>
            ) : (
              <div className="space-y-3">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between rounded-lg border border-border/30 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {agent.framework} &middot; {agent.model}
                      </p>
                    </div>
                    <AgentStatusBadge status={agent.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
