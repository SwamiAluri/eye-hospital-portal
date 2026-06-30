'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { readPatientRecordNav } from '@/lib/patients/patient-record-nav';
import { patientProfileUrl } from '@/lib/patients/patient-routes';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import { cn } from '@/lib/utils';

export function PatientRecordNav({
  patientId,
  className,
}: {
  patientId: string;
  className?: string;
}) {
  const { prevId, nextId, positionLabel } = readPatientRecordNav(patientId);

  if (!prevId && !nextId) return null;

  return (
    <div
      className={cn('inline-flex items-center gap-1', className)}
      data-testid={patientLookupTestIds.recordNav}
    >
      <Link
        href={prevId ? patientProfileUrl(prevId) : '#'}
        aria-disabled={!prevId}
        className={cn(
          'inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200',
          prevId ? 'hover:bg-gray-50 text-gray-700' : 'text-gray-300 pointer-events-none',
        )}
        data-testid={patientLookupTestIds.recordNavPrev}
      >
        <ChevronLeft className="w-4 h-4" />
      </Link>
      {positionLabel && (
        <span className="text-xs text-gray-500 px-1 min-w-[4.5rem] text-center">{positionLabel}</span>
      )}
      <Link
        href={nextId ? patientProfileUrl(nextId) : '#'}
        aria-disabled={!nextId}
        className={cn(
          'inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200',
          nextId ? 'hover:bg-gray-50 text-gray-700' : 'text-gray-300 pointer-events-none',
        )}
        data-testid={patientLookupTestIds.recordNavNext}
      >
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
