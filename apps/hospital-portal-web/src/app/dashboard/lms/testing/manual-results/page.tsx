'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LmsPageShell } from '@/components/lms/LmsPageShell';
import { ResultDraftEntry } from '@/components/lms/testing/ResultDraftEntry';
import { LMS_VIEW } from '@/lib/lms/lms-permissions';

function ManualResultsInner() {
  const sp = useSearchParams();
  const orderTestId = sp.get('orderTestId') || '';
  const specimenId = sp.get('specimenId') || '';
  const operatingBranchId = sp.get('operatingBranchId') || '';

  if (!orderTestId || !specimenId || !operatingBranchId) {
    return (
      <div
        className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        data-testid="result-draft-missing-params"
      >
        Open a work item from the Testing queue. Required: orderTestId, specimenId,
        operatingBranchId.
      </div>
    );
  }

  return (
    <ResultDraftEntry
      orderTestId={orderTestId}
      specimenId={specimenId}
      operatingBranchId={operatingBranchId}
    />
  );
}

export default function Page() {
  return (
    <ProtectedRoute requiredPermission={LMS_VIEW}>
      <LmsPageShell
        title="Manual Result Draft"
        subtitle="Enterprise LMS · Draft entry only — not a released clinical result"
      >
        <Suspense
          fallback={
            <div className="rounded-lg border p-6 text-sm text-muted-foreground">Loading…</div>
          }
        >
          <ManualResultsInner />
        </Suspense>
      </LmsPageShell>
    </ProtectedRoute>
  );
}
