import { getApi } from '@/lib/api';

export async function mergePatients(
  primaryPatientId: string,
  duplicatePatientId: string,
): Promise<void> {
  await getApi().post(`/patients/${primaryPatientId}/merge`, {
    duplicatePatientId,
  });
}
