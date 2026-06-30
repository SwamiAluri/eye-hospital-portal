'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { patientProfileUrl } from '@/lib/patients/patient-routes';

export interface MergedMrGuardBannerProps {
  canonicalPatientId?: string | null;
  canonicalUhid?: string | null;
  className?: string;
}

/** Shown when ward actions are blocked on a superseded (merged) medical record. */
export function MergedMrGuardBanner({
  canonicalPatientId,
  canonicalUhid,
  className = '',
}: MergedMrGuardBannerProps) {
  const canonicalHref = canonicalPatientId ? patientProfileUrl(canonicalPatientId) : null;

  return (
    <div
      className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 ${className}`}
      data-testid="ward-merged-mr-banner"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
        <div className="space-y-2">
          <p className="font-medium">Superseded medical record</p>
          <p className="text-xs text-amber-800/90">
            This record was merged into another patient. Ward checklist editing and state transitions are
            read-only here.
          </p>
          {canonicalHref && (
            <Link
              href={canonicalHref}
              className="inline-flex items-center text-xs font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950"
              data-testid="ward-merged-mr-canonical-link"
            >
              Open canonical record
              {canonicalUhid ? ` (${canonicalUhid})` : ''}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
