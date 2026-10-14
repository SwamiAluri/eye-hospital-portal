'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LmsPageShell } from '@/components/lms/LmsPageShell';
import { TestingWorkbench } from '@/components/lms/testing/TestingWorkbench';
import { LMS_VIEW } from '@/lib/lms/lms-permissions';

/**
 * L-CRT-UX-01 — Authorized Results discovery (PD-CRT-UX-01).
 * Lists ClinicallyAuthorized Results so staff can open Result Detail
 * and use existing CriticalResultPanel for Mark as Critical.
 * Not Final, Released, Published, or patient-visible.
 */
export default function Page() {
  return (
    <ProtectedRoute requiredPermission={LMS_VIEW}>
      <LmsPageShell
        title="Authorized Results"
        subtitle="Enterprise LMS · ClinicallyAuthorized Results only. Not Final, Released, Published, or patient-visible. Open a result to use Critical classification where permitted."
      >
        <TestingWorkbench resultStatus="ClinicallyAuthorized" />
      </LmsPageShell>
    </ProtectedRoute>
  );
}
