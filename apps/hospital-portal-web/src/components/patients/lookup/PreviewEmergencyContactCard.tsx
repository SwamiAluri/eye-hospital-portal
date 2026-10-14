'use client';

import type { PatientSummary } from '@/types/patient-lookup';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';

const fieldLabel =
  'text-[11px] font-medium uppercase tracking-wide text-counselling-muted-foreground';
const fieldValue = 'mt-0.5 text-sm font-medium leading-5 text-counselling-foreground';
const callClass =
  'text-xs font-medium text-counselling-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40';

export function PreviewEmergencyContactCard({
  summary,
}: {
  summary: PatientSummary | undefined;
}) {
  const name = summary?.emergencyContactName?.trim();
  const phone = summary?.emergencyContactPhone?.trim();
  const relationship = summary?.emergencyContactRelationship?.trim();

  return (
    <div data-testid={patientLookupTestIds.previewEmergencyCard}>
      {!name && !phone ? (
        <p className="text-sm text-counselling-muted-foreground">No emergency contact on file.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {name ? (
            <div className="min-w-0">
              <p className={fieldLabel}>Name</p>
              <p className={fieldValue}>{name}</p>
            </div>
          ) : null}
          {relationship ? (
            <div className="min-w-0">
              <p className={fieldLabel}>Relationship</p>
              <p className={`${fieldValue} capitalize`}>{relationship}</p>
            </div>
          ) : null}
          {phone ? (
            <div className="min-w-0">
              <p className={fieldLabel}>Phone</p>
              <p className={fieldValue}>
                {phone}
                <a
                  href={`tel:${phone}`}
                  className={`ml-2 ${callClass}`}
                  aria-label={`Call emergency contact ${name ?? ''}`.trim()}
                >
                  Call
                </a>
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
