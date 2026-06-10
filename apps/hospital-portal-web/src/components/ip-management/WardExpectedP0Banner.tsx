'use client';

import { AlertTriangle } from 'lucide-react';
import { useP0OutpatientProgress } from '@/hooks/useP0OutpatientProgress';

export interface WardExpectedP0BannerProps {
  journeyId: string;
  counselingSessionId?: string | null;
  clinicalState: string;
}

/** Soft banner when journey is Expected and P0 outpatient checklist is incomplete. */
export function WardExpectedP0Banner({
  counselingSessionId,
  clinicalState,
}: WardExpectedP0BannerProps) {
  const p0 = useP0OutpatientProgress(counselingSessionId, clinicalState);
  if (!p0) return null;

  const pct = p0.percent;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
      <p>
        P0 outpatient checklist is {pct}% complete ({p0.completedItems}/{p0.totalItems}).
        Admission is allowed, but counsellor items may still be pending.
      </p>
    </div>
  );
}
