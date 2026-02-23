'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  MessageSquare,
  Send,
  Loader2,
  Wrench,
  Activity,
  Sparkles,
  Bot,
} from 'lucide-react';
import Link from 'next/link';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { api } from '@/lib/api';
import { mockAgents, mockTransactions } from '@/lib/mock-data';
import { AgentStatusBadge } from '@/components/agents/agent-status-badge';
import { TransactionStatusBadge } from '@/components/transactions/transaction-status-badge';
import type { Agent, AgentStatus, Transaction, TransactionStatus } from '@/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{ name: string; arguments: string }>;
}

const SUGGESTED_PROMPTS = [
  'Check my wallet balance',
  'Show recent transactions',
  'Send 0.1 SOL to a friend',
];

export default function AgentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [agent, setAgent] = useState<Agent | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [agentStatus, setAgentStatus] = useState<AgentStatus>('created');
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      api.getAgent(id).catch(() => mockAgents.find((a) => a.id === id) ?? mockAgents[0]),
      api.listTransactions({ walletId: id }).catch(() => mockTransactions.slice(0, 3)),
    ]).then(([a, tx]) => {
      setAgent(a);
      setAgentStatus(a.status);
      setTransactions(tx);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  async function handleStart() {
    if (lifecycleLoading) return;
    setLifecycleLoading(true);
    try {
      const updated = await api.startAgent(id);
      setAgentStatus(updated.status);
    } catch (err) {
      console.error('Failed to start agent:', err);
    } finally {
      setLifecycleLoading(false);
    }
  }

  async function handlePause() {
    if (lifecycleLoading) return;
    setLifecycleLoading(true);
    try {
      const updated = await api.pauseAgent(id);
      setAgentStatus(updated.status);
    } catch (err) {
      console.error('Failed to pause agent:', err);
    } finally {
      setLifecycleLoading(false);
    }
  }

  async function handleStop() {
    if (lifecycleLoading) return;
    setLifecycleLoading(true);
    try {
      const updated = await api.stopAgent(id);
      setAgentStatus(updated.status);
    } catch (err) {
      console.error('Failed to stop agent:', err);
    } finally {
      setLifecycleLoading(false);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: 'user',
      content: text,
    };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/agent-execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: id,
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        setChatMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            role: 'assistant',
            content: err.error ?? 'Something went wrong.',
          },
        ]);
        return;
      }

      const data = await res.json();
      setChatMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          role: 'assistant',
          content: data.content ?? '(No response)',
          toolCalls: data.toolCalls?.length ? data.toolCalls : undefined,
        },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          role: 'assistant',
          content: 'Network error — could not reach the agent.',
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  function handlePromptClick(prompt: string) {
    setChatInput(prompt);
  }

  if (loading || !agent) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted/50" />
        <div className="h-64 animate-pulse rounded-xl border border-border/50 bg-card/30" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 items-center gap-3 border-b border-border/40 px-4 shrink-0">
        <SidebarTrigger className="-ml-1" />
        <Link
          href="/dashboard/settings"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Settings
        </Link>
        <div className="flex-1" />
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Back navigation */}
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/agents">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Agents
          </Link>
        </Button>

        {/* Agent header card */}
        <Card className="border-border/50 bg-card/50">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold tracking-tight">{agent.name}</h2>
                <AgentStatusBadge status={agentStatus} />
              </div>
              <p className="text-sm text-muted-foreground">{agent.description}</p>
              <div className="flex items-center gap-2 pt-1">
                <Badge variant="outline" className="text-xs">
                  {agent.framework}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {agent.model}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-emerald-400 hover:text-emerald-300"
                disabled={agentStatus === 'running' || lifecycleLoading}
                onClick={handleStart}
              >
                <Play className="mr-1.5 h-3.5 w-3.5" />
                Start
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-amber-400 hover:text-amber-300"
                disabled={agentStatus !== 'running' || lifecycleLoading}
                onClick={handlePause}
              >
                <Pause className="mr-1.5 h-3.5 w-3.5" />
                Pause
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-400 hover:text-red-300"
                disabled={
                  agentStatus === 'stopped' || agentStatus === 'created' || lifecycleLoading
                }
                onClick={handleStop}
              >
                <Square className="mr-1.5 h-3.5 w-3.5" />
                Stop
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="chat">
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Activity className="mr-1.5 h-3.5 w-3.5" />
              Activity
            </TabsTrigger>
          </TabsList>

          {/* ── Overview tab ── */}
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

            {/* Recent transactions preview */}
            {transactions.length > 0 && (
              <Card className="mt-4 border-border/50 bg-card/50">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Recent Transactions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {transactions.slice(0, 3).map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between rounded-lg border border-border/30 px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs capitalize">
                          {tx.type}
                        </Badge>
                        <span className="text-sm font-mono">
                          {tx.amount} {tx.token}
                        </span>
                      </div>
                      <TransactionStatusBadge status={tx.status as TransactionStatus} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Chat tab ── */}
          <TabsContent value="chat" className="mt-6">
            <div className="flex h-[calc(100vh-20rem)] flex-col overflow-hidden rounded-xl border border-border/50 bg-card/50">
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-6">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/50">
                      <Bot className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground">
                        Start a conversation with {agent.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ask your agent to check balances, send transactions, or manage your wallet.
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {SUGGESTED_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => handlePromptClick(prompt)}
                          className="rounded-full border border-border/50 bg-muted/30 px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                        >
                          <Sparkles className="mr-1.5 inline-block h-3 w-3" />
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {chatMessages.map((msg) => (
                      <div key={msg.id}>
                        <div
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={
                              msg.role === 'user'
                                ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%] ml-auto'
                                : 'bg-muted rounded-2xl rounded-bl-sm px-4 py-2 max-w-[80%]'
                            }
                          >
                            <p className="text-sm whitespace-pre-wrap">
                              {msg.content || (
                                <span className="italic text-muted-foreground">
                                  (tool call only)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        {msg.toolCalls && msg.toolCalls.length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            {msg.toolCalls.map((tc, j) => (
                              <div
                                key={`${msg.id}-tc-${j}`}
                                className="bg-muted/50 border border-border rounded-lg p-3 max-w-[80%]"
                              >
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Wrench className="h-3.5 w-3.5" />
                                  <span className="font-mono font-medium">{tc.name}</span>
                                </div>
                                <pre className="mt-1 text-xs text-muted-foreground/70 overflow-x-auto">
                                  {tc.arguments}
                                </pre>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {chatLoading && (
                      <div className="flex justify-start">
                        <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-4 py-2 text-sm text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Thinking...
                        </div>
                      </div>
                    )}

                    <div ref={chatEndRef} />
                  </>
                )}
              </div>

              {/* Input area */}
              <div className="border-t border-border p-4">
                <form onSubmit={sendMessage} className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message..."
                    disabled={chatLoading}
                    className="h-11 flex-1"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="h-11 w-11 shrink-0"
                    disabled={chatLoading || !chatInput.trim()}
                  >
                    {chatLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </TabsContent>

          {/* ── Activity tab ── */}
          <TabsContent value="activity" className="mt-6">
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Transaction History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Activity className="mb-3 h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      No activity yet. Start the agent to begin processing transactions.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between rounded-lg border border-border/30 px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-xs capitalize">
                            {tx.type}
                          </Badge>
                          <span className="text-sm font-mono">
                            {tx.amount} {tx.token}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <TransactionStatusBadge status={tx.status as TransactionStatus} />
                          <span className="text-xs text-muted-foreground">
                            {new Date(tx.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
