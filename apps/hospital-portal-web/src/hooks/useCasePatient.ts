import { useCcmsPatient } from './use-ccms-case';

/** @deprecated Prefer useCcmsPatient — kept for existing imports. */
export function useCasePatient(patientId?: string | null) {
  return useCcmsPatient(patientId);
}
