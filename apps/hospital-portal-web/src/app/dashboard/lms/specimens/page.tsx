'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LmsPageShell } from '@/components/lms/LmsPageShell';
import { SpecimenWorkbench } from '@/components/lms/specimens/SpecimenWorkbench';
import { LMS_VIEW } from '@/lib/lms/lms-permissions';

export default function Page() {
  return (
    <ProtectedRoute requiredPermission={LMS_VIEW}>
      <LmsPageShell
        title="Specimens"
        subtitle="Enterprise LMS · Receiving & accession (L-COL-01D)"
      >
        <SpecimenWorkbench />
      </LmsPageShell>
    </ProtectedRoute>
  );
}
