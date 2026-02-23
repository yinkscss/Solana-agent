'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { mockWallets } from '@/lib/mock-data';
import type { AgentFramework, AgentModel, Wallet } from '@/types';

const DEFAULT_ORG_ID = '00000000-0000-4000-a000-000000000001';
const DEFAULT_TOOLS = ['get_balance', 'transfer', 'swap', 'create_wallet', 'request_airdrop'];

interface CreateAgentDialogProps {
  trigger?: React.ReactNode;
}

interface FormState {
  name: string;
  description: string;
  framework: AgentFramework;
  model: AgentModel;
  llmProvider: 'openai' | 'anthropic';
  walletId: string;
  systemPrompt: string;
}

const initialForm: FormState = {
  name: '',
  description: '',
  framework: 'solagent',
  model: 'gpt-4o',
  llmProvider: 'openai',
  walletId: '',
  systemPrompt: '',
};

function buildDefaultPrompt(name: string, description: string): string {
  if (!name.trim()) return '';
  const desc = description.trim() ? ` ${description.trim()}.` : '';
  return `You are SolAgent ${name.trim()}, an autonomous AI agent on Solana devnet.${desc} You can check wallet balances, transfer SOL, and swap tokens via Jupiter. Always confirm amounts before executing transactions. Be concise and helpful.`;
}

function formatWalletOption(w: Wallet): string {
  return `${w.label} — ${w.address.slice(0, 6)}...${w.address.slice(-4)}`;
}

export function CreateAgentDialog({ trigger }: CreateAgentDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletsLoading, setWalletsLoading] = useState(true);
  const [promptTouched, setPromptTouched] = useState(false);

  useEffect(() => {
    api
      .listWallets()
      .catch(() => mockWallets)
      .then((data) => {
        setWallets(data);
        setWalletsLoading(false);
      });
  }, []);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };

      if ((key === 'name' || key === 'description') && !promptTouched) {
        next.systemPrompt = buildDefaultPrompt(
          key === 'name' ? (value as string) : prev.name,
          key === 'description' ? (value as string) : prev.description,
        );
      }

      return next;
    });
  }

  function handlePromptChange(value: string) {
    setPromptTouched(true);
    setForm((prev) => ({ ...prev, systemPrompt: value }));
  }

  function resetForm() {
    setForm(initialForm);
    setPromptTouched(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.createAgent({
        orgId: DEFAULT_ORG_ID,
        name: form.name,
        description: form.description,
        framework: form.framework,
        llmProvider: form.llmProvider,
        model: form.model,
        systemPrompt: form.systemPrompt,
        tools: DEFAULT_TOOLS,
        ...(form.walletId && { walletId: form.walletId }),
      });

      setOpen(false);
      resetForm();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="bg-violet-600 hover:bg-violet-700">
            <Plus className="mr-2 h-4 w-4" />
            Create Agent
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Agent</DialogTitle>
          <DialogDescription>Configure a new AI agent to interact with Solana.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input
              placeholder="My Trading Agent"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Input
              placeholder="What does this agent do?"
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Wallet</label>
            {walletsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading wallets…
              </div>
            ) : (
              <>
                <Select
                  value={form.walletId}
                  onValueChange={(v) => updateField('walletId', v === '__auto__' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Auto-create new wallet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__auto__">Auto-create new wallet</SelectItem>
                    {wallets.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        <span className="flex items-center gap-2">
                          {formatWalletOption(w)}
                          <Badge variant="outline" className="text-xs">
                            {w.network}
                          </Badge>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!form.walletId && (
                  <p className="text-xs text-muted-foreground">
                    Leave empty to auto-create a devnet wallet
                  </p>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Framework</label>
              <Select
                value={form.framework}
                onValueChange={(v) => updateField('framework', v as AgentFramework)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solagent">SolAgent</SelectItem>
                  <SelectItem value="vercel-ai">Vercel AI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">LLM Provider</label>
              <Select
                value={form.llmProvider}
                onValueChange={(v) => updateField('llmProvider', v as 'openai' | 'anthropic')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Model</label>
              <Select
                value={form.model}
                onValueChange={(v) => updateField('model', v as AgentModel)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="claude-3">Claude 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">System Prompt</label>
            <textarea
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Auto-generated from name and description…"
              value={form.systemPrompt}
              onChange={(e) => handlePromptChange(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !form.name.trim()}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create Agent'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
