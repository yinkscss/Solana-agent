'use client';

import { Send, ArrowLeftRight, Droplets, Wallet, Check, X, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface ToolCallInfo {
  name: string;
  arguments: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'executed';
}

interface ConfirmationCardProps {
  toolCall: ToolCallInfo;
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const TOOL_CONFIG: Record<string, { icon: React.ReactNode; label: string }> = {
  transfer: { icon: <Send className="h-4 w-4" />, label: 'Send SOL' },
  swap: { icon: <ArrowLeftRight className="h-4 w-4" />, label: 'Swap Tokens' },
  request_airdrop: { icon: <Droplets className="h-4 w-4" />, label: 'Get Test SOL' },
  create_wallet: { icon: <Wallet className="h-4 w-4" />, label: 'Create Wallet' },
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function buildDetails(
  name: string,
  args: Record<string, unknown>,
): Array<{ label: string; value: string }> {
  switch (name) {
    case 'transfer':
      return [
        { label: 'Amount', value: `${args.amount ?? '?'} SOL` },
        { label: 'To', value: truncateAddress(String(args.to ?? args.destination ?? 'unknown')) },
        { label: 'Fee', value: '~0.000005 SOL' },
      ];
    case 'swap':
      return [
        { label: 'From', value: truncateAddress(String(args.inputMint ?? args.inputToken ?? '?')) },
        { label: 'To', value: truncateAddress(String(args.outputMint ?? args.outputToken ?? '?')) },
        { label: 'Amount', value: String(args.amount ?? '?') },
      ];
    case 'request_airdrop':
      return [{ label: 'Amount', value: `${args.amount ?? 1} SOL` }];
    case 'create_wallet':
      return [{ label: 'Label', value: String(args.label ?? args.name ?? 'default') }];
    default:
      return [];
  }
}

export function ConfirmationCard({
  toolCall,
  onConfirm,
  onCancel,
  disabled,
}: ConfirmationCardProps) {
  const config = TOOL_CONFIG[toolCall.name];
  if (!config) return null;

  const args = parseArgs(toolCall.arguments);
  const details = buildDetails(toolCall.name, args);
  const resolved = toolCall.status !== 'pending';

  return (
    <Card className="mt-2 gap-0 border-violet-500/30 bg-violet-500/5 py-0 overflow-hidden">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="text-violet-400">{config.icon}</span>
          {config.label}
        </div>

        <div className="space-y-1.5">
          {details.map((d) => (
            <DetailRow key={d.label} label={d.label} value={d.value} />
          ))}
        </div>

        {resolved ? (
          <Badge
            variant="outline"
            className={
              toolCall.status === 'confirmed' || toolCall.status === 'executed'
                ? 'border-emerald-500/30 text-emerald-400'
                : 'border-zinc-500/30 text-zinc-400'
            }
          >
            {toolCall.status === 'confirmed' || toolCall.status === 'executed'
              ? 'Confirmed ✓'
              : 'Cancelled'}
          </Badge>
        ) : (
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              className="bg-violet-600 hover:bg-violet-700 text-xs h-7"
              onClick={onConfirm}
              disabled={disabled}
            >
              <Check className="h-3 w-3" />
              Confirm
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={onCancel}
              disabled={disabled}
            >
              <X className="h-3 w-3" />
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ReadOnlyToolBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />
      {name === 'get_balance' ? 'Checking balance...' : name}
    </span>
  );
}
