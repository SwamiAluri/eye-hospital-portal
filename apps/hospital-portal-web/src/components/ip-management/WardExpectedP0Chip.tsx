'use client';

import { AlertTriangle } from 'lucide-react';
import { useP0OutpatientProgress } from '@/hooks/useP0OutpatientProgress';

export interface WardExpectedP0ChipProps {
  counselingSessionId?: string | null;
  clinicalState: string;
}

/** Compact P0 incomplete indicator for ward journey list rows. */
export function WardExpectedP0Chip({ counselingSessionId, clinicalState }: WardExpectedP0ChipProps) {
  const p0 = useP0OutpatientProgress(counselingSessionId, clinicalState);
  if (!p0) return null;

  return (
    <span
      className="flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 mt-1 whitespace-nowrap"
      title={`P0 outpatient checklist ${p0.percent}% complete (${p0.completedItems}/${p0.totalItems})`}
    >
      <AlertTriangle className="h-3 w-3 shrink-0" />
      P0 {p0.percent}%
    </span>
  );
}
