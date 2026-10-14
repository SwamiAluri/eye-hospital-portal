export const PATIENT_360_SECTIONS = [
  { key: 'overview', label: 'Overview', unwired: false },
  { key: 'clinical', label: 'Clinical', unwired: false },
  { key: 'care', label: 'Care', unwired: false },
  { key: 'documents', label: 'Documents', unwired: false },
  { key: 'coverage', label: 'Coverage', unwired: false },
  { key: 'administration', label: 'Administration', unwired: false },
  { key: 'timeline', label: 'Timeline', unwired: false },
] as const;

export type Patient360SectionKey = (typeof PATIENT_360_SECTIONS)[number]['key'];

const SECTION_KEYS = new Set<string>(PATIENT_360_SECTIONS.map((section) => section.key));

export function isPatient360SectionKey(value: string | null | undefined): value is Patient360SectionKey {
  return !!value && SECTION_KEYS.has(value);
}

export function parsePatient360Section(value: string | null | undefined): Patient360SectionKey {
  return isPatient360SectionKey(value) ? value : 'overview';
}

export function patient360SectionLabel(key: Patient360SectionKey): string {
  return PATIENT_360_SECTIONS.find((section) => section.key === key)?.label ?? key;
}

export function unwiredPatient360Sections() {
  return PATIENT_360_SECTIONS.filter((section) => section.unwired);
}

/** Honest shell state. Not an empty-history claim. */
export function notIntegratedMessage(label: string): string {
  return `${label} is not available in Patient 360.`;
}

export const PATIENT_360_OVERVIEW_PLACEHOLDER =
  'Overview content is not loaded in this view.';
