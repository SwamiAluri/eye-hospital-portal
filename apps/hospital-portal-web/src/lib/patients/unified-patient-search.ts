import { patientLookupApi } from '@/lib/api/patient-lookup.api';
import type { Patient } from '@/lib/api/patients.api';

/** Normalized patient hit from GET /api/patients/suggest (branch-scoped). */
export interface UnifiedPatientSearchHit {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  email?: string | null;
}

export async function searchPatientsUnified(
  branchId: string | null | undefined,
  q: string,
  limit = 20,
): Promise<UnifiedPatientSearchHit[]> {
  const trimmed = q.trim();
  if (!branchId || trimmed.length < 2) return [];

  const rows = await patientLookupApi.suggest(branchId, trimmed, limit);
  return rows.map((row) => ({
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    mrn: row.mrn,
    phone: row.phone,
    dateOfBirth: row.dateOfBirth,
    gender: row.gender,
    email: row.email,
  }));
}

/** Map unified suggest hit to legacy Patient shape used by comboboxes and booking flows. */
export function unifiedHitToPatient(hit: UnifiedPatientSearchHit): Patient {
  return {
    id: hit.id,
    firstName: hit.firstName,
    lastName: hit.lastName,
    medicalRecordNumber: hit.mrn,
    patientCode: hit.mrn,
    dateOfBirth: hit.dateOfBirth ?? '',
    gender: hit.gender ?? '',
    email: hit.email ?? undefined,
    contactNumber: hit.phone ?? undefined,
    phone: hit.phone ?? undefined,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
}

export function unifiedHitDisplayName(hit: UnifiedPatientSearchHit): string {
  return `${hit.firstName} ${hit.lastName}`.trim();
}
