'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';

interface LiveIndicatorProps {
  connected: boolean;
  className?: string;
}

export const LiveIndicator = memo(({ connected, className }: LiveIndicatorProps) => {
  return (
    <div className={cn('flex items-center gap-1.5', !connected && 'opacity-50', className)}>
      <span className="relative flex h-2 w-2">
        {connected && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={cn(
            'relative inline-flex h-2 w-2 rounded-full',
            connected ? 'bg-emerald-500' : 'bg-muted-foreground',
          )}
        />
      </span>
      <span className="text-xs text-muted-foreground">{connected ? 'Live' : 'Offline'}</span>
    </div>
  );
});
