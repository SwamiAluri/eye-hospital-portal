import { getApi } from '@/lib/api';

export interface DirectoryPatientRow {
  id: string;
  patientName: string;
  mrn: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
}

function mapSearchRow(row: {
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

/** Branch-scoped patient search via optometry endpoint (CLINICAL:EXAMINATION:VIEW). Min 3 characters. */
export async function searchDirectoryPatients(
  branchId: string,
  q: string,
  limit = 20,
): Promise<DirectoryPatientRow[]> {
  const term = q.trim();
  if (term.length < 3 || !branchId) return [];

  const { data } = await getApi().get<unknown[]>('/visits/queue/optometrist/patients/search', {
    params: { branchId, q: term, limit },
  });

  return (data ?? []).map((row) => mapSearchRow(row as Parameters<typeof mapSearchRow>[0]));
}
