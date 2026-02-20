"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, Pause, Square } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { mockAgents, mockTransactions } from "@/lib/mock-data";
import { AgentStatusBadge } from "@/components/agents/agent-status-badge";
import type { Agent, Transaction } from "@/types";

export default function AgentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [agent, setAgent] = useState<Agent | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getAgent(id).catch(() => mockAgents.find((a) => a.id === id) ?? mockAgents[0]),
      api.listTransactions({ walletId: id }).catch(() => mockTransactions.slice(0, 3)),
    ]).then(([a, tx]) => {
      setAgent(a);
      setTransactions(tx);
      setLoading(false);
    });
  }, [id]);

  if (loading || !agent) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted/50" />
        <div className="h-64 animate-pulse rounded-xl border border-border/50 bg-card/30" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/agents">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{agent.name}</h1>
            <AgentStatusBadge status={agent.status} />
          </div>
          <p className="text-muted-foreground">{agent.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-emerald-400 hover:text-emerald-300">
            <Play className="mr-1 h-3 w-3" /> Start
          </Button>
          <Button variant="outline" size="sm" className="text-amber-400 hover:text-amber-300">
            <Pause className="mr-1 h-3 w-3" /> Pause
          </Button>
          <Button variant="outline" size="sm" className="text-red-400 hover:text-red-300">
            <Square className="mr-1 h-3 w-3" /> Stop
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Framework</span>
                  <Badge variant="outline">{agent.framework}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Model</span>
                  <Badge variant="outline">{agent.model}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Wallet</span>
                  <span className="font-mono text-xs">{agent.walletId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Created</span>
                  <span>{new Date(agent.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Updated</span>
                  <span>{new Date(agent.updatedAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  System Prompt
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
                  {agent.systemPrompt}
                </pre>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="conversations" className="mt-6">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="flex h-48 items-center justify-center">
              <p className="text-muted-foreground">
                Conversation history will be available once agents are running.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <div className="space-y-3">
                  {transactions.map((tx) => (
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
                      <span className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
