import { memo } from 'react';
import type { AgentStatus } from '@/types';

const statusConfig: Record<AgentStatus, { label: string; dotClass: string }> = {
  created: {
    label: 'Created',
    dotClass: 'bg-zinc-400',
  },
  running: {
    label: 'Running',
    dotClass: 'bg-emerald-400 animate-pulse',
  },
  paused: {
    label: 'Paused',
    dotClass: 'bg-amber-400',
  },
  stopped: {
    label: 'Stopped',
    dotClass: 'bg-red-400',
  },
};

export const AgentStatusBadge = memo(({ status }: { status: AgentStatus }) => {
  const config = statusConfig[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <span className={`inline-block h-2 w-2 rounded-full ${config.dotClass}`} />
      {config.label}
    </span>
  );
});
