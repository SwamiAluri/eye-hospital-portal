'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { CounsellingSessionProvider } from '@/components/counsellors-desk/session/CounsellingSessionContext';
import { CounsellingSessionPageContent } from '@/components/counsellors-desk/session/CounsellingSessionPageContent';

export default function CounsellingSessionPage() {
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
    <CounsellingSessionProvider
      sessionId={sessionId}
      initialTab={tabParam}
      initialSubtab={subtabParam}
    >
      <CounsellingSessionPageContent />
    </CounsellingSessionProvider>
  );
}
