import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import type { TransactionStatus } from '@/types';

const statusConfig: Record<
  TransactionStatus,
  { label: string; className: string; dotClassName: string }
> = {
  pending: {
    label: 'Pending',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    dotClassName: 'bg-amber-400',
  },
  confirmed: {
    label: 'Confirmed',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    dotClassName: 'bg-emerald-400',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-500/10 text-red-400 border-red-500/20',
    dotClassName: 'bg-red-400',
  },
};

export const TransactionStatusBadge = memo(({ status }: { status: TransactionStatus }) => {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={config.className}>
      <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${config.dotClassName}`} />
      {config.label}
    </Badge>
  );
});
