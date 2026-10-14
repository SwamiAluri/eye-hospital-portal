'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { patientHubUrl } from '@/lib/patients/patient-routes';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';

interface PatientRecordShellHeaderProps {
  patientName: string;
  mrn?: string | null;
  /** When the identity band owns the h1, the back link stays and the name is not repeated. */
  omitIdentity?: boolean;
}

export function PatientRecordShellHeader({
  patientName,
  mrn,
  omitIdentity = false,
}: PatientRecordShellHeaderProps) {
  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-3 border-b border-gray-100 pb-4"
      data-testid={patientLookupTestIds.recordShell}
    >
      <Link
        href={patientHubUrl()}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-900"
        data-testid={patientLookupTestIds.recordBackLink}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Patients
      </Link>
      {!omitIdentity && (
        <>
          <div className="h-4 w-px bg-gray-200 hidden sm:block" />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 truncate">{patientName}</h1>
            {mrn && (
              <p className="text-xs font-mono text-gray-500 mt-0.5">MRN {mrn}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
