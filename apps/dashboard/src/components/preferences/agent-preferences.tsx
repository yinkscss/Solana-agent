'use client';

import { useEffect, useState } from 'react';
import { Bot, Save, Loader2, Check, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';

interface AgentConfig {
  id: string;
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  tools: string[];
  status: string;
}

const DEFAULT_PROMPT =
  'You are SolAgent, a helpful Solana blockchain assistant. Help users manage their wallets, check balances, transfer tokens, swap tokens, and explore transactions on the Solana devnet.';

const TOOL_LABELS: Record<string, { label: string; description: string }> = {
  get_balance: { label: 'Check Balance', description: 'Query wallet balances' },
  transfer: { label: 'Transfer', description: 'Send SOL or tokens' },
  swap: { label: 'Swap', description: 'Swap between tokens' },
  get_transactions: { label: 'Transaction History', description: 'View past transactions' },
  request_airdrop: { label: 'Faucet', description: 'Get free test SOL' },
  create_wallet: { label: 'Create Wallet', description: 'Provision new wallets' },
};

function saveButtonContent(saving: boolean, saved: boolean) {
  if (saving) {
    return (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Saving...
      </>
    );
  }
  if (saved) {
    return (
      <>
        <Check className="mr-2 h-4 w-4" />
        Saved
      </>
    );
  }
  return (
    <>
      <Save className="mr-2 h-4 w-4" />
      Save Preferences
    </>
  );
}

export function AgentPreferences() {
  const { agentId } = useAuth();
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrompt, setEditPrompt] = useState('');

  useEffect(() => {
    if (!agentId) {
      setLoading(false);
      return;
    }
    fetch('/api/agent-provision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ existingAgentId: agentId }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((data) => {
        setConfig(data);
        setEditName(data.name || 'SolAgent');
        setEditDescription(data.description || '');
        setEditPrompt(data.systemPrompt || DEFAULT_PROMPT);
      })
      .catch(() => {
        setConfig({
          id: agentId,
          name: 'SolAgent',
          description: 'Your personal Solana AI assistant',
          model: 'gpt-4o-mini',
          systemPrompt: DEFAULT_PROMPT,
          tools: [
            'get_balance',
            'transfer',
            'swap',
            'create_wallet',
            'request_airdrop',
            'get_transactions',
          ],
          status: 'idle',
        });
        setEditName('SolAgent');
        setEditDescription('Your personal Solana AI assistant');
        setEditPrompt(DEFAULT_PROMPT);
      })
      .finally(() => setLoading(false));
  }, [agentId]);

  async function handleSave() {
    if (!agentId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent-update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          name: editName,
          description: editDescription,
          systemPrompt: editPrompt,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Failed to save preferences. Make sure services are running.');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setEditName('SolAgent');
    setEditDescription('Your personal Solana AI assistant');
    setEditPrompt(DEFAULT_PROMPT);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!agentId) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border/50 text-muted-foreground">
        <Bot className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm font-medium">No agent provisioned</p>
        <p className="mt-1 text-xs">Go to the chat page to set up your agent automatically</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-violet-400" />
            Agent Identity
          </CardTitle>
          <CardDescription>Customize how your AI assistant introduces itself</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="SolAgent"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Input
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Your personal Solana AI assistant"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Model:</span>
            <Badge variant="outline" className="border-violet-500/30 text-violet-400">
              {config?.model || 'gpt-4o-mini'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-base">Personality & Instructions</CardTitle>
          <CardDescription>
            Tell your agent how to behave. This shapes its responses and decision-making style.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-y"
            placeholder="Describe how your agent should behave..."
          />
          <div className="flex items-center gap-2">
            <Button onClick={handleReset} variant="outline" size="sm">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset to Default
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-base">Capabilities</CardTitle>
          <CardDescription>Tools your agent can use during conversations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
            {(config?.tools || []).map((tool) => {
              const meta = TOOL_LABELS[tool];
              return (
                <div
                  key={tool}
                  className="flex items-center gap-3 rounded-lg border border-border/30 px-3 py-2.5"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{meta?.label || tool}</p>
                    {meta?.description && (
                      <p className="text-xs text-muted-foreground truncate">{meta.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-400 text-center">{error}</p>}

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-violet-600 hover:bg-violet-700"
        >
          {saveButtonContent(saving, saved)}
        </Button>
      </div>
    </div>
  );
}
