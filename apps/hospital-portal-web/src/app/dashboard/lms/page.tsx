'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LmsOverviewDashboard } from '@/components/lms/LmsOverviewDashboard';
import { LMS_VIEW } from '@/lib/lms/lms-permissions';

export default function LmsOverviewPage() {
  return (
    <ProtectedRoute requiredPermission={LMS_VIEW}>
      <div data-testid="lms-overview-page">
        <LmsOverviewDashboard />
      </div>
    </ProtectedRoute>
  );
}
