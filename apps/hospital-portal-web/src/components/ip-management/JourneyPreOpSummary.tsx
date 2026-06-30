'use client';

import { ExternalLink } from 'lucide-react';
import { ChecklistPhaseSummary } from '@/components/ip-management/ChecklistPhaseSummary';

export interface JourneyPreOpSummaryProps {
  journeyId: string;
  counselingSessionId?: string | null;
  paymentMode?: string;
  clinicalState: string;
  onOpenWorkspace?: () => void;
}

export function JourneyPreOpSummary({
  journeyId,
  counselingSessionId,
  paymentMode,
  clinicalState,
  onOpenWorkspace,
}: JourneyPreOpSummaryProps) {
  const editableStates = new Set(['Expected', 'Admitted', 'ReadyForSurgery']);
  const canDeepLink = editableStates.has(clinicalState) && !!onOpenWorkspace;

  return (
    <div className="space-y-4" data-testid="journey-preop-summary">
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-blue-900">
        <p className="font-medium">Read-only pre-op summary</p>
        <p className="mt-1 text-xs text-blue-800/80">
          Ward checklist editing lives in the Pre-Op Workspace. This tab shows progress only.
        </p>
        {canDeepLink && (
          <button
            type="button"
            onClick={onOpenWorkspace}
            data-testid="journey-deep-link-preop-workspace"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Ward Pre-Op Workspace
          </button>
        )}
      </div>

      <ChecklistPhaseSummary
        journeyId={journeyId}
        counselingSessionId={counselingSessionId}
        paymentMode={paymentMode}
      />
    </div>
  );

}
