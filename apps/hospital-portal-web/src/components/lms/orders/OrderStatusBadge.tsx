'use client';

import { cn } from '@/lib/utils';

const STYLES: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-800 border-slate-200',
  Submitted: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Cancelled: 'bg-rose-50 text-rose-800 border-rose-200',
};

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium',
        STYLES[status] ?? 'bg-muted text-muted-foreground border-border',
      )}
      data-testid="order-status-badge"
    >
      {status}
    </span>
  );
}
