'use client';

import { cn } from '@/lib/utils';

const STYLES: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-700 border-slate-200',
  Review: 'bg-amber-50 text-amber-800 border-amber-200',
  Approved: 'bg-sky-50 text-sky-800 border-sky-200',
  Active: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Retired: 'bg-gray-100 text-gray-600 border-gray-200',
  Superseded: 'bg-violet-50 text-violet-800 border-violet-200',
};

export function CatalogueStatusBadge({ status }: { status: string }) {
  return (
    <span
      data-testid="catalogue-status-badge"
      className={cn(
        'inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium',
        STYLES[status] ?? 'bg-gray-50 text-gray-700 border-gray-200',
      )}
    >
      {status}
    </span>
  );
}
