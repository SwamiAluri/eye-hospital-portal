'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LmsPageShell } from '@/components/lms/LmsPageShell';
import { TestingWorkbench } from '@/components/lms/testing/TestingWorkbench';
import { LMS_VIEW } from '@/lib/lms/lms-permissions';

export default function Page() {
  return (
    <ProtectedRoute requiredPermission={LMS_VIEW}>
      <LmsPageShell
        title="Testing Workbench"
        subtitle="Enterprise LMS · Eligible Received work items (L-TST-01A)"
      >
        <TestingWorkbench />
      </LmsPageShell>
    </ProtectedRoute>
  );
}
