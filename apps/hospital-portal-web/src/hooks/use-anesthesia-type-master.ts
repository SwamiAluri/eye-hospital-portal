'use client';

import { useMasterValues } from '@/hooks/use-master-values';

/** B5 — clinical.anesthesia_type from master (replaces masterDataApi.getAnesthesiaTypes). */
export function useAnesthesiaTypeMaster() {
  const { options, loading, error, refetch } = useMasterValues('clinical.anesthesia_type');
  return { options, loading, error, refetch };
}
