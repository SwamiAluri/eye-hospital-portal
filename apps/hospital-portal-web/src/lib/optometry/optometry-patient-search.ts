import { getApi } from '@/lib/api';
import {
  searchPatientsUnified,
  unifiedHitDisplayName,
} from '@/lib/patients/unified-patient-search';

export interface DirectoryPatientRow {
  id: string;
  patientName: string;
  mrn: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
}

function mapUnifiedRow(hit: Awaited<ReturnType<typeof searchPatientsUnified>>[number]): DirectoryPatientRow {
  return {
    id: hit.id,
    patientName: unifiedHitDisplayName(hit),
    mrn: hit.mrn,
    phone: hit.phone ?? undefined,
    gender: hit.gender ?? undefined,
    dateOfBirth: hit.dateOfBirth ?? undefined,
  };
}

function mapLegacySearchRow(row: {
  id?: string;
  Id?: string;
  patientName?: string;
  PatientName?: string;
  mrn?: string;
  Mrn?: string;
  phone?: string | null;
  Phone?: string | null;
  gender?: string | null;
  Gender?: string | null;
  dateOfBirth?: string | null;
  DateOfBirth?: string | null;
}): DirectoryPatientRow {
  return {
    id: String(row.id ?? row.Id ?? ''),
    patientName: row.patientName ?? row.PatientName ?? '',
    mrn: row.mrn ?? row.Mrn ?? '',
    phone: row.phone ?? row.Phone ?? undefined,
    gender: row.gender ?? row.Gender ?? undefined,
    dateOfBirth: row.dateOfBirth ?? row.DateOfBirth ?? undefined,
  };
}

/** Branch-scoped patient search via unified suggest; falls back to optometry endpoint. */
export async function searchDirectoryPatients(
  branchId: string,
  q: string,
  limit = 20,
): Promise<DirectoryPatientRow[]> {
  const term = q.trim();
  if (term.length < 2 || !branchId) return [];

  try {
    const hits = await searchPatientsUnified(branchId, term, limit);
    if (hits.length > 0) return hits.map(mapUnifiedRow);
  } catch {
    /* fall through to legacy optometry search */
  }

  if (term.length < 3) return [];

  const { data } = await getApi().get<unknown[]>('/visits/queue/optometrist/patients/search', {
    params: { branchId, q: term, limit },
  });

  return (data ?? []).map((row) => mapLegacySearchRow(row as Parameters<typeof mapLegacySearchRow>[0]));
}
