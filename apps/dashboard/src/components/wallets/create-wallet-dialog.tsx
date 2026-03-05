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
import { Plus, Loader2 } from 'lucide-react';

interface CreateWalletDialogProps {
  trigger?: React.ReactNode;
  onCreated?: (wallet: { id: string; label: string }) => void;
}

export function CreateWalletDialog({ trigger, onCreated }: CreateWalletDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/wallet-provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim() || 'New Wallet' }),
      });
      if (!res.ok) throw new Error('Failed to create wallet');
      const data = await res.json();
      onCreated?.({ id: data.id, label: label.trim() || 'New Wallet' });
      setOpen(false);
      setLabel('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create wallet');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="bg-violet-600 hover:bg-violet-700">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Wallet
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Wallet</DialogTitle>
          <DialogDescription>
            Add another Solana devnet wallet for your agent to manage.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Wallet Name</label>
            <Input
              placeholder="e.g. Trading Wallet, Savings, etc."
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-violet-600 hover:bg-violet-700">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Wallet'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
