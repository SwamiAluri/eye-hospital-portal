'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { CounsellingSessionProvider } from '@/components/counsellors-desk/session/CounsellingSessionContext';
import { CounsellingSessionPageContent } from '@/components/counsellors-desk/session/CounsellingSessionPageContent';
import { COUNSELLING_SESSIONS_READ_PERMISSION } from '@/lib/counsellors-desk/counselling-auth';

export default function CounsellingSessionPage() {
  return (
    <ProtectedRoute requiredPermission={COUNSELLING_SESSIONS_READ_PERMISSION}>
      <CounsellingSessionPageBody />
    </ProtectedRoute>
  );
}

function CounsellingSessionPageBody() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params.id as string;
  const tabParam = searchParams.get('tab') as 'counselling' | 'coverage' | 'outpatient' | null;
  const subtabParam = searchParams.get('subtab') as
    | 'eligibility'
    | 'preauth'
    | 'estimate'
    | 'status'
    | null;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <CounsellingSessionProvider
        sessionId={sessionId}
        initialTab={tabParam}
        initialSubtab={subtabParam}
      >
        <CounsellingSessionPageContent />
      </CounsellingSessionProvider>
    </div>
  );
}
