'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Bot, Send, Loader2, Settings, Hexagon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { mockAgents } from '@/lib/mock-data';
import {
  ConfirmationCard,
  ReadOnlyToolBadge,
  type ToolCallInfo,
} from '@/components/chat/confirmation-card';
import type { Agent } from '@/types';

const ACTIONABLE_TOOLS = new Set(['transfer', 'swap', 'request_airdrop', 'create_wallet']);

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallInfo[];
}

const SUGGESTED_PROMPTS = [
  {
    label: 'Check my balance',
    description: "See what's in your wallet",
    prompt: "What's my balance?",
  },
  {
    label: 'Get free test SOL',
    description: 'Add some Solana to play with',
    prompt: 'Can I get some free test SOL?',
  },
  {
    label: 'Send SOL to someone',
    description: 'Transfer to any address',
    prompt: 'I want to send some SOL',
  },
  {
    label: 'What can you do?',
    description: 'See all capabilities',
    prompt: 'What can you help me with?',
  },
];

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <DashboardChat />
    </Suspense>
  );
}

function DashboardChat() {
  const searchParams = useSearchParams();
  const chatId = searchParams.get('chat');
  const { walletId, walletPublicKey, apiKey, isLoading: authLoading } = useAuth();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string>(chatId || crypto.randomUUID());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api
      .listAgents()
      .then((data) => {
        setAgents(data);
        if (!selectedAgentId && data.length > 0) {
          setSelectedAgentId(data[0].id);
        }
      })
      .catch(() => {
        setAgents(mockAgents);
        if (!selectedAgentId && mockAgents.length > 0) {
          setSelectedAgentId(mockAgents[0].id);
        }
      });
  }, []);

  useEffect(() => {
    if (!chatId) return;
    try {
      const stored = localStorage.getItem(`solagent-chat-${chatId}`);
      if (stored) {
        const data = JSON.parse(stored);
        setMessages(data.messages || []);
        if (data.agentId) setSelectedAgentId(data.agentId);
        setCurrentChatId(chatId);
      }
    } catch {}
  }, [chatId]);

  useEffect(() => {
    const handler = () => {
      setMessages([]);
      setInput('');
      setCurrentChatId(crypto.randomUUID());
    };
    window.addEventListener('solagent-new-chat', handler);
    return () => window.removeEventListener('solagent-new-chat', handler);
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    });
  }, [messages, isLoading]);

  useEffect(() => {
    if (messages.length === 0) return;
    const chatData = {
      id: currentChatId,
      agentId: selectedAgentId,
      messages,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(`solagent-chat-${currentChatId}`, JSON.stringify(chatData));

    const title = messages[0]?.content.slice(0, 50) || 'New chat';
    const agent = agents.find((a) => a.id === selectedAgentId);
    try {
      const historyRaw = localStorage.getItem('solagent-chat-history');
      const history = historyRaw ? JSON.parse(historyRaw) : [];
      const existing = history.findIndex((h: { id: string }) => h.id === currentChatId);
      const entry = {
        id: currentChatId,
        title,
        agentName: agent?.name || 'Agent',
        timestamp: new Date().toISOString(),
      };
      if (existing >= 0) {
        history[existing] = entry;
      } else {
        history.unshift(entry);
      }
      localStorage.setItem('solagent-chat-history', JSON.stringify(history.slice(0, 50)));
      window.dispatchEvent(new CustomEvent('solagent-chat-updated'));
    } catch {}
  }, [messages, currentChatId, selectedAgentId, agents]);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading || !selectedAgentId) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: content.trim(),
      };
      const latestMessages = messagesRef.current;
      const nextMessages = [...latestMessages, userMsg];
      setMessages(nextMessages);
      setInput('');
      setIsLoading(true);

      try {
        const res = await fetch('/api/agent-execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: selectedAgentId,
            walletId: walletId ?? undefined,
            messages: nextMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });
        const data = await res.json();
        const toolCalls: ToolCallInfo[] | undefined = data.toolCalls?.map(
          (tc: { name: string; arguments: string }) => ({
            ...tc,
            status: 'pending' as const,
          }),
        );
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.content ?? data.error ?? 'No response received.',
            toolCalls,
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Failed to reach the agent. Please try again.',
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, selectedAgentId, walletId],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleToolAction = useCallback(
    (messageId: string, toolIndex: number, action: 'confirmed' | 'cancelled') => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId || !msg.toolCalls) return msg;
          const updated = msg.toolCalls.map((tc, i) =>
            i === toolIndex ? { ...tc, status: action } : tc,
          );
          return { ...msg, toolCalls: updated };
        }),
      );
      const followUp = action === 'confirmed' ? 'Yes, go ahead' : 'No, cancel';
      sendMessage(followUp);
    },
    [sendMessage],
  );

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  let walletStatusEl: React.ReactNode = null;
  if (walletPublicKey) {
    walletStatusEl = (
      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" aria-hidden />
        Your wallet: {walletPublicKey.slice(0, 4)}...{walletPublicKey.slice(-4)}
      </p>
    );
  } else if (apiKey && !authLoading) {
    walletStatusEl = (
      <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
        Setting up your wallet...
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 items-center gap-3 border-b border-border/40 px-3 shrink-0">
        <SidebarTrigger className="-ml-1" />
        <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
          <SelectTrigger className="w-auto max-w-[200px] border-0 bg-transparent shadow-none h-8 gap-2 text-sm font-medium">
            <Bot className="h-4 w-4 text-violet-400 shrink-0" />
            <SelectValue placeholder="Select agent" />
          </SelectTrigger>
          <SelectContent>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                <span className="flex items-center gap-2">
                  <span>{agent.name}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${
                      agent.status === 'running'
                        ? 'border-emerald-500/30 text-emerald-400'
                        : 'border-zinc-500/30 text-zinc-400'
                    }`}
                  >
                    {agent.status}
                  </Badge>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Badge
          variant="outline"
          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]"
        >
          Devnet
        </Badge>
        <Link href="/dashboard/settings">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings className="h-4 w-4 text-muted-foreground" />
          </Button>
        </Link>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4">
            <div className="max-w-lg w-full text-center space-y-6">
              <div className="space-y-3">
                <div className="inline-flex items-center justify-center rounded-full bg-violet-500/10 p-4 mb-2">
                  <Hexagon className="h-8 w-8 text-violet-400" />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {selectedAgent?.name ?? 'SolAgent'}
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                  Just talk to Solana.
                </p>
                {walletStatusEl}
              </div>
              <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
                {SUGGESTED_PROMPTS.map((item) => (
                  <button
                    key={item.prompt}
                    type="button"
                    onClick={() => sendMessage(item.prompt)}
                    className="group rounded-xl border border-border/60 bg-card/50 p-4 text-left transition-all hover:bg-accent hover:border-violet-500/30 hover:shadow-sm"
                  >
                    <p className="text-sm font-medium text-foreground group-hover:text-violet-400">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-3">
                {msg.role === 'assistant' && (
                  <div className="mt-1 shrink-0">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/10">
                      <Bot className="h-4 w-4 text-violet-400" />
                    </div>
                  </div>
                )}
                <div
                  className={`flex-1 min-w-0 ${msg.role === 'user' ? 'ml-auto max-w-[80%]' : ''}`}
                >
                  {msg.role === 'user' ? (
                    <div className="rounded-2xl bg-violet-600 px-4 py-2.5 text-white text-sm leading-relaxed">
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    </div>
                  ) : (
                    <div className="text-sm leading-relaxed text-foreground">
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {msg.toolCalls.map((tc, i) =>
                            ACTIONABLE_TOOLS.has(tc.name) ? (
                              <ConfirmationCard
                                key={i}
                                toolCall={tc}
                                onConfirm={() => handleToolAction(msg.id, i, 'confirmed')}
                                onCancel={() => handleToolAction(msg.id, i, 'cancelled')}
                                disabled={isLoading}
                              />
                            ) : (
                              <ReadOnlyToolBadge key={i} name={tc.name} />
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="mt-1 shrink-0">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/10">
                    <Bot className="h-4 w-4 text-violet-400" />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border/40 bg-background p-3">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-card/50 px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${selectedAgent?.name ?? 'SolAgent'}...`}
              disabled={isLoading || !selectedAgentId}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm leading-relaxed placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50 max-h-[150px]"
            />
            <Button
              onClick={() => sendMessage(input)}
              size="icon"
              disabled={isLoading || !input.trim() || !selectedAgentId}
              className="shrink-0 h-8 w-8 rounded-lg bg-violet-600 hover:bg-violet-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground/40">
            SolAgent on Solana Devnet &bull; Responses may not be accurate
          </p>
        </div>
      </div>
    </div>
  );
}
