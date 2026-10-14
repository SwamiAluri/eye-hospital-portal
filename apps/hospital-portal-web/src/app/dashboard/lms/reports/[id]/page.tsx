'use client';

import { useSearchParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LmsPageShell } from '@/components/lms/LmsPageShell';
import { ReportDetailView } from '@/components/lms/reports/ReportDetailView';
import { LMS_VIEW } from '@/lib/lms/lms-permissions';

export default function Page({ params }: { params: { id: string } }) {
  const search = useSearchParams();
  const operatingBranchId = search.get('operatingBranchId') || '';

  return (
    <ProtectedRoute requiredPermission={LMS_VIEW}>
      <LmsPageShell title="Report detail" subtitle="Immutable ReportVersion snapshot (L-REP-01).">
        {!operatingBranchId ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm" role="alert">
            operatingBranchId query parameter is required.
          </div>
        ) : (
          <ReportDetailView reportId={params.id} operatingBranchId={operatingBranchId} />
        )}
      </LmsPageShell>
    </ProtectedRoute>
  );
}
