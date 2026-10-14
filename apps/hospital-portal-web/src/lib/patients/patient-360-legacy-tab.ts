import type { Patient360SectionKey } from '@/lib/patients/patient-360-sections';
import { isPatientRecordTabKey } from '@/lib/patients/patient-record-tabs';

/**
 * Unambiguous legacy `?tab=` destinations on Patient 360 only.
 * Do not add mappings that invent a new information architecture.
 */
const LEGACY_TAB_TO_SECTION: Record<string, Patient360SectionKey> = {
  counseling: 'care',
  insurance: 'coverage',
  billing: 'coverage',
  documents: 'documents',
  scheduling: 'care',
  visits: 'care',
  /** Legacy Patient Record Lab Results → Patient 360 Clinical (Laboratory / LabReportsTab). */
  lab_results: 'clinical',
};

export function mapLegacyRecordTabToPatient360Section(
  tab: string | null | undefined,
): Patient360SectionKey | null {
  if (!tab || !isPatientRecordTabKey(tab)) return null;
  return LEGACY_TAB_TO_SECTION[tab] ?? null;
}
