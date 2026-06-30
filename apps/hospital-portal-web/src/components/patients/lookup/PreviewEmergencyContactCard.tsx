'use client';

import { Phone } from 'lucide-react';
import type { PatientSummary } from '@/types/patient-lookup';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';

export function PreviewEmergencyContactCard({
  summary,
}: {
  summary: PatientSummary | undefined;
}) {
  const name = summary?.emergencyContactName;
  const phone = summary?.emergencyContactPhone;
  const relationship = summary?.emergencyContactRelationship;

  return (
    <section
      className="rounded-xl border border-gray-200 p-3"
      data-testid={patientLookupTestIds.previewEmergencyCard}
    >
      <p className="text-xs font-semibold uppercase text-gray-500">Emergency contact</p>

      {!name && !phone ? (
        <p className="mt-2 text-sm text-gray-500">No emergency contact on file.</p>
      ) : (
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {name && <p className="text-sm font-medium text-gray-900">{name}</p>}
            {relationship && (
              <p className="text-xs text-gray-500 capitalize">{relationship}</p>
            )}
            {phone && (
              <p className="mt-1 text-sm text-gray-700">{phone}</p>
            )}
          </div>
          {phone && (
            <a
              href={`tel:${phone}`}
              className="inline-flex shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 p-2 text-emerald-800 hover:bg-emerald-100"
              aria-label={`Call emergency contact ${name ?? ''}`.trim()}
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
        </div>
      )}
    </section>
  );
}
