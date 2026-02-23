'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, Loader2, Sparkles, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AgentStatusBadge } from '@/components/agents/agent-status-badge';
import type { Agent } from '@/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{ name: string; arguments: string }>;
}

const SUGGESTED_PROMPTS = [
  'Create a new wallet for me',
  'Airdrop 1 SOL to my wallet',
  'Check my wallet balance',
  'What can you do?',
];

interface ChatPanelProps {
  agents: Agent[];
  preselectedAgentId?: string | null;
  onAgentSelected?: () => void;
}

export function ChatPanel({ agents, preselectedAgentId, onAgentSelected }: ChatPanelProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>(agents[0]?.id ?? '');

  useEffect(() => {
    if (preselectedAgentId && agents.some((a) => a.id === preselectedAgentId)) {
      setSelectedAgentId(preselectedAgentId);
      onAgentSelected?.();
    }
  }, [preselectedAgentId, agents, onAgentSelected]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading || !selectedAgentId) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: content.trim(),
      };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setInput('');
      setIsLoading(true);

      try {
        const res = await fetch('/api/agent-execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: selectedAgentId,
            messages: nextMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        const data: {
          content?: string;
          error?: string;
          toolCalls?: Array<{ name: string; arguments: string }>;
        } = await res.json();

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.content ?? data.error ?? 'No response received.',
          toolCalls: data.toolCalls,
        };
        setMessages((prev) => [...prev, assistantMsg]);
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
    [isLoading, messages, selectedAgentId],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  return (
    <div className="flex h-full flex-col">
      {/* Agent selector */}
      <div className="border-b border-border p-3">
        <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select an agent" />
          </SelectTrigger>
          <SelectContent>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                <span className="flex items-center gap-2">
                  <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{agent.name}</span>
                  <AgentStatusBadge status={agent.status} />
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedAgent && (
          <p className="mt-1.5 truncate text-xs text-muted-foreground">
            {selectedAgent.description}
          </p>
        )}
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-full bg-violet-500/10 p-3">
              <Sparkles className="h-6 w-6 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Chat with {selectedAgent?.name ?? 'your agent'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ask anything or try a suggestion below
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-[260px]">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-secondary"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] min-w-0 rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user' ? 'bg-violet-600 text-white' : 'bg-secondary text-foreground'
              }`}
            >
              <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {msg.content}
              </p>
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-2 space-y-1">
                  {msg.toolCalls.map((tc, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 rounded-md bg-black/10 px-2 py-1 text-[11px] font-mono"
                    >
                      <Wrench className="h-3 w-3 shrink-0 opacity-60" />
                      <span className="truncate">{tc.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="border-t border-border p-3">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message the agent..."
            disabled={isLoading || !selectedAgentId}
            className="flex-1 text-sm"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim() || !selectedAgentId}
            className="shrink-0 bg-violet-600 hover:bg-violet-700"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
