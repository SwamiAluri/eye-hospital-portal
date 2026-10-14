'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LmsPageShell } from '@/components/lms/LmsPageShell';
import { TestingWorkbench } from '@/components/lms/testing/TestingWorkbench';
import { LMS_VIEW } from '@/lib/lms/lms-permissions';

/**
 * L-VER-01 — Technical Verification presentation surface.
 * Reuses the authoritative Testing work queue with Draft Result filter (no duplicate SoT).
 */
export default function Page() {
  return (
    <ProtectedRoute requiredPermission={LMS_VIEW}>
      <LmsPageShell
        title="Technical Verification"
        subtitle="Enterprise LMS · Draft Results eligible for Technical Verification (L-VER-01). Not Clinical Authorization."
      >
        <TestingWorkbench resultStatus="Draft" />
      </LmsPageShell>
    </ProtectedRoute>
  );
}
