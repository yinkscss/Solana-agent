import { Badge } from "@/components/ui/badge";
import type { TransactionStatus } from "@/types";

const statusConfig: Record<
  TransactionStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  confirmed: {
    label: "Confirmed",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
  },
};

export function TransactionStatusBadge({
  status,
}: {
  status: TransactionStatus;
}) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={config.className}>
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {config.label}
    </Badge>
  );
}
