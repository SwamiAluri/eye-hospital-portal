'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { ipManagementApi, WardPostOpChecklistDto } from '@/lib/api/ip-management.api';

export interface JourneyPostOpSummaryProps {
  journeyId: string;
  clinicalState: string;
  onOpenWorkspace?: () => void;
}

function fmtTime(dt: string | null | undefined): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function JourneyPostOpSummary({
  journeyId,
  clinicalState,
  onOpenWorkspace,
}: JourneyPostOpSummaryProps) {
  const [checklist, setChecklist] = useState<WardPostOpChecklistDto | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await ipManagementApi.getWardPostOpChecklist(journeyId);
    setChecklist(data);
    setLoading(false);
  }, [journeyId]);

  useEffect(() => {
    load();
  }, [load]);

  const canDeepLink = clinicalState === 'PostOp' && !!onOpenWorkspace;
  const pct = checklist && checklist.totalItems > 0
    ? Math.round((checklist.completedItems / checklist.totalItems) * 100)
    : 0;

  return (
    <div className="space-y-4" data-testid="journey-postop-summary">
      <div className="rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-3 text-sm text-violet-900">
        <p className="font-medium">Read-only post-op summary</p>
        <p className="mt-1 text-xs text-violet-800/80">
          Complete Form 4 checklist in the Post-Op Workspace. Legacy nurse/surgeon tabs are retired.
        </p>
        {canDeepLink && (
          <button
            type="button"
            onClick={onOpenWorkspace}
            data-testid="journey-deep-link-postop-workspace"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Post-Op Workspace
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading Form 4 progress…
        </div>
      ) : !checklist || checklist.items.length === 0 ? (
        <p className="text-sm text-gray-500">Post-op checklist not configured.</p>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-800">Form 4 progress</p>
            <span className="text-xs font-medium text-violet-700">
              {checklist.completedItems}/{checklist.totalItems} ({pct}%)
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-violet-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <ul className="divide-y divide-gray-50 text-sm">
            {checklist.items.slice(0, 8).map(item => {
              const done = item.isCompleted || item.isBypassed;
              return (
                <li key={item.itemId} className="flex items-center justify-between gap-2 py-2">
                  <span className={done ? 'text-gray-500 line-through' : 'text-gray-800'}>
                    {item.itemLabel}
                  </span>
                  <span className={`text-xs font-medium ${done ? 'text-green-600' : 'text-gray-400'}`}>
                    {done ? 'Done' : 'Pending'}
                  </span>
                </li>
              );
            })}
            {checklist.items.length > 8 && (
              <li className="py-2 text-xs text-gray-400">
                +{checklist.items.length - 8} more items in workspace
              </li>
            )}
          </ul>
          {checklist.receivedFromOtAt && (
            <p className="text-xs text-gray-500 pt-1">
              Received from OT: {fmtTime(checklist.receivedFromOtAt)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
