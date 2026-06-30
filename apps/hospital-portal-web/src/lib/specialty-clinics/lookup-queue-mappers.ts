import { calcPatientAge } from '@/lib/patients/patient-display-utils';
import type { PatientLookupRow } from '@/types/patient-lookup';

function acuityPriority(acuity?: string | null): string {
  if (acuity === 'high') return 'Urgent';
  if (acuity === 'medium') return 'Routine';
  return 'Routine';
}

/** Minimal display row for specialty clinic queues backed by patient lookup. */
export interface SpecialtyClinicQueueRow {
  id: string;
  name: string;
  mrn: string;
  age: number | null;
  gender: string;
  reasonForVisit?: string | null;
  priority: string;
  lastVisitAt?: string | null;
  engagements: PatientLookupRow['activeEngagements'];
  fromLookup: true;
}

export function mapLookupToSpecialtyQueueRow(row: PatientLookupRow): SpecialtyClinicQueueRow {
  return {
    id: row.id,
    name: `${row.firstName} ${row.lastName}`.trim(),
    mrn: row.mrn,
    age: row.dateOfBirth ? calcPatientAge(row.dateOfBirth) : null,
    gender: row.gender ?? '',
    reasonForVisit: row.reasonForVisit,
    priority: acuityPriority(row.clinicalAcuity),
    lastVisitAt: row.lastVisitAt,
    engagements: row.activeEngagements,
    fromLookup: true,
  };
}
