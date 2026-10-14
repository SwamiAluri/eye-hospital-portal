'use client';

import { useParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LmsPageShell } from '@/components/lms/LmsPageShell';
import { SpecimenDetailView } from '@/components/lms/specimens/SpecimenDetailView';
import { useHasPermission } from '@/hooks/use-permissions';
import { LMS_SPECIMENS_PERMISSIONS, LMS_VIEW } from '@/lib/lms/lms-permissions';

export default function SpecimenDetailPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const canView =
    useHasPermission(LMS_SPECIMENS_PERMISSIONS.view) ||
    useHasPermission(LMS_SPECIMENS_PERMISSIONS.manage);

  return (
    <ProtectedRoute requiredPermission={LMS_VIEW}>
      <LmsPageShell
        title="Specimen"
        subtitle="Enterprise LMS · read-only specimen detail (L-COL-01C)"
      >
        {!canView ? (
          <p className="text-sm text-muted-foreground" data-testid="specimen-permission-denied">
            You do not have permission to view LMS specimens (`lms.specimens.view` or
            `lms.specimens.manage`).
          </p>
        ) : id ? (
          <SpecimenDetailView specimenId={id} />
        ) : (
          <p className="text-sm text-muted-foreground">Specimen id is required.</p>
        )}
      </LmsPageShell>
    </ProtectedRoute>
  );
}
