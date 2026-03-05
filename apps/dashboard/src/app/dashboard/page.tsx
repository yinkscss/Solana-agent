'use client';

import { Suspense, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { Bot, Send, Loader2, Settings, Hexagon, Copy, Check } from 'lucide-react';
import { OnboardingWizard } from '@/components/onboarding-wizard';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import {
  ConfirmationCard,
  ReadOnlyToolBadge,
  type ToolCallInfo,
} from '@/components/chat/confirmation-card';
import { ChatMarkdown } from '@/components/chat/chat-markdown';
import { useCopyToClipboard } from '@/lib/use-copy-to-clipboard';

const ACTIONABLE_TOOLS = new Set(['transfer', 'swap', 'create_wallet']);

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
    label: 'View my transactions',
    description: 'See your recent activity',
    prompt: 'Show me my transaction history',
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
  const { agentId, walletId, walletPublicKey, apiKey, isLoading: authLoading } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string>(chatId || crypto.randomUUID());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('solagent-onboarded') !== 'true';
  });
  const { copied: walletCopied, copy: copyWallet } = useCopyToClipboard();

  useEffect(() => {
    if (!chatId) return;
    try {
      const stored = localStorage.getItem(`solagent-chat-${chatId}`);
      if (stored) {
        const data = JSON.parse(stored);
        setMessages(data.messages || []);
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
      agentId,
      messages,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(`solagent-chat-${currentChatId}`, JSON.stringify(chatData));

    const title = messages[0]?.content.slice(0, 50) || 'New chat';
    try {
      const historyRaw = localStorage.getItem('solagent-chat-history');
      const history = historyRaw ? JSON.parse(historyRaw) : [];
      const existing = history.findIndex((h: { id: string }) => h.id === currentChatId);
      const entry = {
        id: currentChatId,
        title,
        agentName: 'SolAgent',
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
  }, [messages, currentChatId, agentId]);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const addExtraWalletFromResult = useCallback((newId: string, label: string) => {
    try {
      const stored = localStorage.getItem('solagent-extra-wallets');
      const extra: { id: string; label: string }[] = stored ? JSON.parse(stored) : [];
      if (!extra.some((w) => w.id === newId)) {
        extra.push({ id: newId, label });
        localStorage.setItem('solagent-extra-wallets', JSON.stringify(extra));
        window.dispatchEvent(new CustomEvent('solagent-wallet-created'));
      }
    } catch {}
  }, []);

  const processToolResults = useCallback(
    (toolResults?: Array<{ name: string; result: unknown }>) => {
      if (!toolResults) return;
      for (const tr of toolResults) {
        if (tr.name !== 'create_wallet' || !tr.result || typeof tr.result !== 'object') continue;
        const r = tr.result as Record<string, unknown>;
        if (!r.success || !r.data || typeof r.data !== 'object') continue;
        const d = r.data as Record<string, unknown>;
        const newId = String(d.walletId ?? '');
        if (newId) addExtraWalletFromResult(newId, String(d.label ?? 'New Wallet'));
      }
    },
    [addExtraWalletFromResult],
  );

  const extractFailedTools = (toolResults?: Array<{ name: string; result: unknown }>) => {
    const failed = new Set<string>();
    if (!toolResults) return failed;
    for (const tr of toolResults) {
      const r = tr.result as Record<string, unknown> | undefined;
      if (r && r.success === false) failed.add(tr.name);
    }
    return failed;
  };

  const toolCallStatus = (
    name: string,
    confirmedTools: string[] | undefined,
    failedTools: Set<string>,
  ): 'pending' | 'executed' | 'failed' => {
    if (!confirmedTools?.includes(name)) return 'pending';
    return failedTools.has(name) ? 'failed' : 'executed';
  };

  const transitionToolStatus = (
    tc: ToolCallInfo,
    confirmedTools: string[] | undefined,
    failedTools: Set<string>,
  ): ToolCallInfo['status'] => {
    if (tc.status !== 'confirmed' || !confirmedTools?.includes(tc.name)) return tc.status;
    return failedTools.has(tc.name) ? 'failed' : 'executed';
  };

  const buildToolCalls = (
    rawToolCalls: Array<{ name: string; arguments: string }> | undefined,
    confirmedTools: string[] | undefined,
    failedTools: Set<string>,
  ): ToolCallInfo[] | undefined =>
    rawToolCalls?.map((tc) => ({
      ...tc,
      status: toolCallStatus(tc.name, confirmedTools, failedTools),
    }));

  const transitionConfirmedCards = (
    confirmedTools: string[] | undefined,
    failedTools: Set<string>,
  ) => {
    if (!confirmedTools?.length) return;
    setMessages((prev) =>
      prev.map((msg) => {
        if (!msg.toolCalls) return msg;
        const updated = msg.toolCalls.map((tc) => {
          const newStatus = transitionToolStatus(tc, confirmedTools, failedTools);
          return newStatus !== tc.status ? { ...tc, status: newStatus } : tc;
        });
        return { ...msg, toolCalls: updated };
      }),
    );
  };

  const appendAssistantMessage = (
    data: {
      content?: string;
      error?: string;
      toolCalls?: Array<{ name: string; arguments: string }>;
      toolResults?: Array<{ name: string; result: unknown }>;
    },
    confirmedTools?: string[],
  ) => {
    processToolResults(data.toolResults);
    const failedTools = extractFailedTools(data.toolResults);
    const toolCalls = buildToolCalls(data.toolCalls, confirmedTools, failedTools);
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.content ?? data.error ?? 'No response received.',
        toolCalls,
      },
    ]);
    transitionConfirmedCards(confirmedTools, failedTools);
  };

  const executeAgent = async (msgs: ChatMessage[], confirmedTools?: string[]) => {
    const res = await fetch('/api/agent-execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
      },
      body: JSON.stringify({
        agentId,
        walletId: walletId ?? undefined,
        walletPublicKey: walletPublicKey ?? undefined,
        ...(confirmedTools && { confirmedTools }),
        messages: msgs.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    return res.json();
  };

  const sendMessage = useCallback(
    async (content: string, confirmedTools?: string[]) => {
      if (!content.trim() || isLoading || !agentId) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: content.trim(),
      };
      const nextMessages = [...messagesRef.current, userMsg];
      setMessages(nextMessages);
      setInput('');
      setIsLoading(true);

      try {
        const data = await executeAgent(nextMessages, confirmedTools);
        appendAssistantMessage(data, confirmedTools);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Failed to reach the agent. Please try again.',
          },
        ]);
        if (confirmedTools?.length) {
          setMessages((prev) =>
            prev.map((msg) => {
              if (!msg.toolCalls) return msg;
              const updated = msg.toolCalls.map((tc) =>
                tc.status === 'confirmed' && confirmedTools.includes(tc.name)
                  ? { ...tc, status: 'pending' as const }
                  : tc,
              );
              return { ...msg, toolCalls: updated };
            }),
          );
        }
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, agentId, walletId, walletPublicKey, apiKey, processToolResults],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleToolAction = useCallback(
    async (messageId: string, toolIndex: number, action: 'confirmed' | 'cancelled') => {
      if (isLoading || !agentId) return;

      const currentMessages = messagesRef.current;
      const targetMsg = currentMessages.find((m) => m.id === messageId);
      const toolName = targetMsg?.toolCalls?.[toolIndex]?.name;
      const followUp = action === 'confirmed' ? 'Yes, go ahead' : 'No, cancel that';
      const confirmedTools = action === 'confirmed' && toolName ? [toolName] : undefined;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: followUp,
      };

      const nextMessages = currentMessages.map((msg) => {
        if (msg.id !== messageId || !msg.toolCalls) return msg;
        const updated = msg.toolCalls.map((tc, i) =>
          i === toolIndex ? { ...tc, status: action } : tc,
        );
        return { ...msg, toolCalls: updated };
      });
      nextMessages.push(userMsg);
      setMessages(nextMessages);
      setIsLoading(true);

      try {
        const data = await executeAgent(nextMessages, confirmedTools);
        appendAssistantMessage(data, confirmedTools);
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
    [isLoading, agentId, walletId, walletPublicKey, apiKey, processToolResults],
  );

  let walletStatusEl: React.ReactNode = null;
  if (walletPublicKey) {
    walletStatusEl = (
      <button
        type="button"
        onClick={() => walletPublicKey && copyWallet(walletPublicKey)}
        className="mx-auto flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/50 px-2.5 py-1 transition-colors hover:bg-accent text-xs"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" aria-hidden />
        <span className="font-mono text-muted-foreground">
          {walletPublicKey.slice(0, 4)}...{walletPublicKey.slice(-4)}
        </span>
        {walletCopied ? (
          <Check className="h-3 w-3 text-emerald-400" />
        ) : (
          <Copy className="h-3 w-3 text-muted-foreground" />
        )}
      </button>
    );
  } else if (apiKey && !authLoading) {
    walletStatusEl = (
      <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
        Setting up your wallet...
      </p>
    );
  }

  let mainContent: ReactNode;
  if (showOnboarding && walletPublicKey) {
    mainContent = (
      <OnboardingWizard
        walletPublicKey={walletPublicKey}
        agentName="SolAgent"
        onComplete={() => {
          localStorage.setItem('solagent-onboarded', 'true');
          setShowOnboarding(false);
        }}
        onSendMessage={sendMessage}
      />
    );
  } else if (messages.length === 0) {
    mainContent = (
      <div className="flex h-full flex-col items-center justify-center px-4">
        <div className="max-w-lg w-full text-center space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center justify-center rounded-full bg-violet-500/10 p-4 mb-2">
              <Hexagon className="h-8 w-8 text-violet-400" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">SolAgent</h1>
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
    );
  } else {
    mainContent = (
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
            <div className={`flex-1 min-w-0 ${msg.role === 'user' ? 'ml-auto max-w-[80%]' : ''}`}>
              {msg.role === 'user' ? (
                <div className="rounded-2xl bg-violet-600 px-4 py-2.5 text-white text-sm leading-relaxed">
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
              ) : (
                <div className="text-sm leading-relaxed text-foreground">
                  <div className="prose-sm">
                    <ChatMarkdown content={msg.content} />
                  </div>
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
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 items-center gap-3 border-b border-border/40 px-3 shrink-0">
        <SidebarTrigger className="-ml-1" />
        <div className="flex items-center gap-2">
          <Hexagon className="h-4 w-4 text-violet-400 shrink-0" />
          <span className="text-sm font-semibold">SolAgent</span>
        </div>
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
        {mainContent}
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
              placeholder="Message SolAgent..."
              disabled={isLoading || !agentId}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm leading-relaxed placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50 max-h-[150px]"
            />
            <Button
              onClick={() => sendMessage(input)}
              size="icon"
              disabled={isLoading || !input.trim() || !agentId}
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
