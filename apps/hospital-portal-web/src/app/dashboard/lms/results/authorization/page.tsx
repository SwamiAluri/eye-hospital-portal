'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LmsPageShell } from '@/components/lms/LmsPageShell';
import { TestingWorkbench } from '@/components/lms/testing/TestingWorkbench';
import { LMS_VIEW } from '@/lib/lms/lms-permissions';

/**
 * L-AUTH-01 — Clinical Authorization presentation surface.
 * Reuses the authoritative Testing work queue with TechnicalVerified filter (same LmsResult SoT).
 */
export default function Page() {
  return (
    <ProtectedRoute requiredPermission={LMS_VIEW}>
      <LmsPageShell
        title="Clinical Authorization"
        subtitle="Enterprise LMS · Technical Verified Results eligible for Clinical Authorization (L-AUTH-01). Not Final, Released, or patient-visible."
      >
        <TestingWorkbench resultStatus="TechnicalVerified" />
      </LmsPageShell>
    </ProtectedRoute>
  );
}
