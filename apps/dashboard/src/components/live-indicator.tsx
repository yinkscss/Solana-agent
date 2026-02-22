"use client";

import { cn } from "@/lib/utils";

interface LiveIndicatorProps {
  connected: boolean;
  className?: string;
}

export function LiveIndicator({ connected, className }: LiveIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className="relative flex h-2 w-2">
        {connected && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            connected ? "bg-emerald-500" : "bg-red-500"
          )}
        />
      </span>
      <span className="text-xs text-muted-foreground">
        {connected ? "Live" : "Disconnected"}
      </span>
    </div>
  );
}
