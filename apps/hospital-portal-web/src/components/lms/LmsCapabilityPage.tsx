'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LmsPageShell } from '@/components/lms/LmsPageShell';
import { LmsPlaceholderState } from '@/components/lms/LmsPlaceholderState';
import { LMS_VIEW } from '@/lib/lms/lms-permissions';
import { getLmsCapabilityByHref } from '@/lib/lms/lms-capability-registry';

export function LmsCapabilityPage({
  href,
  title,
  description,
}: {
  href: string;
  title?: string;
  description?: string;
}) {
  const capability = getLmsCapabilityByHref(href);
  const resolvedTitle = title ?? capability?.title ?? 'Laboratory Management';
  const resolvedDescription = description ?? capability?.description;

  return (
    <ProtectedRoute requiredPermission={LMS_VIEW}>
      <LmsPageShell
        title={resolvedTitle}
        subtitle="Enterprise LMS · capability not yet implemented"
      >
        <LmsPlaceholderState title={resolvedTitle} description={resolvedDescription} />
      </LmsPageShell>
    </ProtectedRoute>
  );
}
