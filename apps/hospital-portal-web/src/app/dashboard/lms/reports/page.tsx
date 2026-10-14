'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LmsPageShell } from '@/components/lms/LmsPageShell';
import { ReportsWorkbench } from '@/components/lms/reports/ReportsWorkbench';
import { LMS_VIEW } from '@/lib/lms/lms-permissions';

export default function Page() {
  return (
    <ProtectedRoute requiredPermission={LMS_VIEW}>
      <LmsPageShell title="Reports" subtitle="Enterprise LMS Draft Report foundation (L-REP-01).">
        <ReportsWorkbench />
      </LmsPageShell>
    </ProtectedRoute>
  );
}
