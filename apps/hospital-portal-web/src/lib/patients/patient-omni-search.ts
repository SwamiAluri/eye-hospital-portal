import { patientLookupApi } from '@/lib/api/patient-lookup.api';
import { mapOmniSearchApiHit } from '@/lib/patients/patient-omni-search-nav';
import type {
  PatientOmniSearchHit,
  PatientOmniSearchScope,
} from '@/types/patient-omni-search';
import { omniSearchMinQueryLength } from '@/types/patient-omni-search';

export async function searchPatientOmni(
  branchId: string | null | undefined,
  scope: PatientOmniSearchScope,
  q: string,
  limit = 15,
): Promise<PatientOmniSearchHit[]> {
  if (!branchId) return [];

  const trimmed = q.trim();
  if (trimmed.length < omniSearchMinQueryLength(scope)) {
    if (scope === 'care_programs') {
      const rows = await patientLookupApi.omniSearch(branchId, scope, '', limit);
      return rows.map(mapOmniSearchApiHit);
    }
    return [];
  }

  const rows = await patientLookupApi.omniSearch(branchId, scope, trimmed, limit);
  return rows.map(mapOmniSearchApiHit);
}
