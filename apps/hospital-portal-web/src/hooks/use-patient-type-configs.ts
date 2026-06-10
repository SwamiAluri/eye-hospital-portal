/**
 * @deprecated Use `usePatientTypeMaster` from `@/hooks/use-patient-type-master`.
 * Reads from Master Data (`patient.patient_type`), not the legacy Patient Type Configs API.
 */
import { useMemo } from 'react';
import type { PatientTypeConfig } from '@/lib/api/patient-type-configs.api';
import { usePatientTypeMaster, usePatientTypeMasterConfig } from '@/hooks/use-patient-type-master';
import { findPatientTypeConfig } from '@/lib/master-data/patient-type-master';

export const patientTypeConfigKeys = {
  all: ['patient-type-configs'] as const,
  lists: () => [...patientTypeConfigKeys.all, 'list'] as const,
  config: (patientType: string) => [...patientTypeConfigKeys.all, 'config', patientType] as const,
  validate: (patientType: string) => [...patientTypeConfigKeys.all, 'validate', patientType] as const,
};

type LegacyQueryResult<T> = {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};

/** @deprecated */
export function usePatientTypeConfigs(): LegacyQueryResult<PatientTypeConfig[]> {
  const { configs, loading, error } = usePatientTypeMaster();
  return {
    data: configs,
    isLoading: loading,
    isError: error,
    error: error ? new Error('Failed to load patient type rules from Master Data') : null,
  };
}

/** @deprecated */
export function usePatientTypeConfig(patientType: string): LegacyQueryResult<PatientTypeConfig> {
  const { config, loading, error } = usePatientTypeMasterConfig(patientType);
  return {
    data: config,
    isLoading: loading,
    isError: error || (!loading && !!patientType && !config),
    error: error ? new Error('Failed to load patient type rule') : null,
  };
}

/** @deprecated */
export function useValidatePatientType(patientType: string): LegacyQueryResult<{ isValid: boolean; message?: string }> {
  const { configs, loading, error } = usePatientTypeMaster();
  const data = useMemo(() => {
    const isValid = !!findPatientTypeConfig(configs, patientType);
    return { isValid, message: isValid ? undefined : `Invalid patient type: ${patientType}` };
  }, [configs, patientType]);
  return { data, isLoading: loading, isError: error, error: error ? new Error('Validation failed') : null };
}

export function getPatientTypeDisplayName(patientType: string): string {
  const displayNames: Record<string, string> = {
    Cash: 'Cash Payment',
    Insurance: 'Insurance (Full Coverage)',
    CoPay: 'Insurance (Co-Payment)',
    ESH: 'ESH Scheme',
    CGHS: 'CGHS Scheme',
    Arograshree: 'Arograshree Scheme',
    SGHS: 'State Government Scheme',
    Camp: 'Camp Sponsored',
  };
  return displayNames[patientType] || patientType;
}

export function requiresAdvancePayment(config?: PatientTypeConfig): boolean {
  return config?.configuration?.requiresAdvancePayment ?? false;
}

export function getAdvancePercentage(config?: PatientTypeConfig): number {
  return config?.configuration?.advancePercentage ?? 0;
}

export function calculateAdvanceAmount(packageAmount: number, config?: PatientTypeConfig): number {
  if (!requiresAdvancePayment(config)) return 0;
  return (packageAmount * getAdvancePercentage(config)) / 100;
}
