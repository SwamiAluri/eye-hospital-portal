'use client';

import { useQuery } from '@tanstack/react-query';
import { useBranchContext } from '@/hooks/use-branch-context';
import { patientLookupApi } from '@/lib/api/patient-lookup.api';
import type { PatientLookupPage } from '@/types/patient-lookup';

export const specialtyClinicKeys = {
  patients: (branchId: string, programCode: string) =>
    ['specialty-clinic-patients', branchId, programCode] as const,
};

/** Branch-scoped patient queue for specialty clinics via GET /patients/lookup?programCodes=… */
export function useSpecialtyClinicPatients(programCode: string, pageSize = 100) {
  const { branchId, isReady } = useBranchContext();

  return useQuery<PatientLookupPage>({
    queryKey: specialtyClinicKeys.patients(branchId ?? '', programCode),
    queryFn: () =>
      patientLookupApi.lookup({
        branchId: branchId!,
        tab: 'current',
        programCodes: [programCode],
        page: 1,
        pageSize,
        sortBy: 'name',
        sortDir: 'asc',
      }),
    enabled: isReady && !!branchId && !!programCode,
    staleTime: 60_000,
  });
}
