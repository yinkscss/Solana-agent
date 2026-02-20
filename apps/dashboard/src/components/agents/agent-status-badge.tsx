import { Badge } from "@/components/ui/badge";
import type { AgentStatus } from "@/types";

const statusConfig: Record<
  AgentStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }
> = {
  created: { label: "Created", variant: "secondary", className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
  running: { label: "Running", variant: "default", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  paused: { label: "Paused", variant: "secondary", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  stopped: { label: "Stopped", variant: "destructive", className: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={config.className}>
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {config.label}
    </Badge>
  );
}
