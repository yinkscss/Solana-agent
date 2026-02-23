'use client';

import { useState } from 'react';
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
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { PolicyRule } from '@/types';

interface RuleDraft {
  type: PolicyRule['type'];
  params: string;
}

const DEFAULT_PARAMS: Record<PolicyRule['type'], string> = {
  max_amount: '{"max": 10, "token": "SOL"}',
  allowed_tokens: '{"tokens": ["SOL", "USDC"]}',
  time_window: '{"maxPerWindow": 50, "windowHours": 24}',
  whitelist: '{"addresses": []}',
};

export function CreatePolicyDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [walletId, setWalletId] = useState('');
  const [rules, setRules] = useState<RuleDraft[]>([]);

  function addRule() {
    setRules([...rules, { type: 'max_amount', params: DEFAULT_PARAMS.max_amount }]);
  }

  function removeRule(i: number) {
    setRules(rules.filter((_, idx) => idx !== i));
  }

  function updateRule(i: number, updates: Partial<RuleDraft>) {
    setRules(rules.map((r, idx) => (idx === i ? { ...r, ...updates } : r)));
  }

  function handleTypeChange(i: number, type: PolicyRule['type']) {
    updateRule(i, { type, params: DEFAULT_PARAMS[type] });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const parsedRules: PolicyRule[] = rules.map((r, i) => ({
        id: `r-${i}`,
        type: r.type,
        params: JSON.parse(r.params),
      }));
      await api.createPolicy({ name, walletId, rules: parsedRules, active: true });
      setOpen(false);
      window.location.reload();
    } catch {
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-violet-600 hover:bg-violet-700">
          <Plus className="mr-2 h-4 w-4" />
          Create Policy
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Policy</DialogTitle>
          <DialogDescription>Define rules to govern wallet transactions.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input
              placeholder="Trading Limits"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Wallet ID</label>
            <Input
              placeholder="wallet-1"
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
              required
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Rules</label>
              <Button type="button" variant="outline" size="sm" onClick={addRule}>
                <Plus className="mr-1 h-3 w-3" />
                Add Rule
              </Button>
            </div>

            {rules.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No rules added yet. Click &ldquo;Add Rule&rdquo; to define transaction constraints.
              </p>
            )}

            {rules.map((rule, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg border border-border/50 p-3"
              >
                <div className="flex-1 space-y-2">
                  <Select
                    value={rule.type}
                    onValueChange={(v) => handleTypeChange(i, v as PolicyRule['type'])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="max_amount">Max Amount</SelectItem>
                      <SelectItem value="allowed_tokens">Allowed Tokens</SelectItem>
                      <SelectItem value="time_window">Time Window</SelectItem>
                      <SelectItem value="whitelist">Whitelist</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder='{"max": 10, "token": "SOL"}'
                    value={rule.params}
                    onChange={(e) => updateRule(i, { params: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRule(i)}
                  className="mt-1 text-muted-foreground hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !name || !walletId}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {loading ? 'Creating...' : 'Create Policy'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
