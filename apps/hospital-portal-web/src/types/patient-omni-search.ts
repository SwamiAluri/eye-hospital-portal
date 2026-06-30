export const PATIENT_OMNI_SEARCH_SCOPES = [
  { key: 'patients', label: 'Patients' },
  { key: 'care_programs', label: 'Care programs' },
  { key: 'conditions', label: 'Conditions' },
  { key: 'procedures', label: 'Procedures' },
  { key: 'providers', label: 'Providers' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'ip', label: 'IP' },
  { key: 'camps', label: 'Camps' },
] as const;

export type PatientOmniSearchScope = (typeof PATIENT_OMNI_SEARCH_SCOPES)[number]['key'];

export type PatientOmniSearchActionType = 'patient_profile' | 'hub_filter' | 'hub_path';

export interface PatientOmniSearchHit {
  id: string;
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  actionType: PatientOmniSearchActionType;
  patientId?: string | null;
  hubFilter?: Record<string, string> | null;
  path?: string | null;
}

export function omniSearchMinQueryLength(scope: PatientOmniSearchScope): number {
  return scope === 'care_programs' ? 0 : 2;
}

export function omniSearchPlaceholder(scope: PatientOmniSearchScope): string {
  switch (scope) {
    case 'patients':
      return 'Search by name, MRN, or phone…';
    case 'care_programs':
      return 'Filter care programs…';
    case 'conditions':
      return 'Search ICD codes or diagnosis…';
    case 'procedures':
      return 'Search procedures…';
    case 'providers':
      return 'Search doctors, optometrists, counselors…';
    case 'insurance':
      return 'Search payers or open coverage cases…';
    case 'ip':
      return 'Search admitted patients or wards…';
    case 'camps':
      return 'Search camp patients today…';
    default:
      return 'Search…';
  }
}

export function omniSearchEmptyHint(scope: PatientOmniSearchScope): string {
  if (scope === 'care_programs') {
    return 'Browse ophthalmology care programs';
  }
  return `Type at least ${omniSearchMinQueryLength(scope)} characters`;
}
