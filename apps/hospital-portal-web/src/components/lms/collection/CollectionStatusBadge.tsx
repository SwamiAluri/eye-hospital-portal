'use client';

import { cn } from '@/lib/utils';

const STYLES: Record<string, string> = {
  Planned: 'bg-slate-100 text-slate-800 border-slate-200',
  Ready: 'bg-sky-50 text-sky-800 border-sky-200',
  InProgress: 'bg-amber-50 text-amber-900 border-amber-200',
  Completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Cancelled: 'bg-rose-50 text-rose-800 border-rose-200',
};

export function CollectionStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium',
        STYLES[status] ?? 'bg-muted text-muted-foreground border-border',
      )}
      data-testid="collection-status-badge"
    >
      {status}
    </span>
  );
}
