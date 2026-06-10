'use client';

import { useMemo } from 'react';
import { useMasterValues } from '@/hooks/use-master-values';
import type { PatientTypeConfig } from '@/lib/api/patient-type-configs.api';
import {
  findPatientTypeConfig,
  masterOptionToPatientTypeConfig,
} from '@/lib/master-data/patient-type-master';

/**
 * Patient payment types from master.patient_type (replaces Patient Type Configs API).
 */
export function usePatientTypeMaster() {
  const { options, loading, error, refetch } = useMasterValues('patient.patient_type');

  const configs = useMemo(
    () => options.map((opt, i) => masterOptionToPatientTypeConfig(opt, i)),
    [options],
  );

  return { configs, loading, error, refetch };
}

export function usePatientTypeMasterConfig(patientType: string) {
  const { configs, loading, error, refetch } = usePatientTypeMaster();
  const config = useMemo(
    () => findPatientTypeConfig(configs, patientType),
    [configs, patientType],
  );
  return { config, loading, error, refetch };
}

export type { PatientTypeConfig };
