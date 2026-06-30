export const PATIENT_RECORD_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'vitals', label: 'Vitals' },
  { key: 'medical_records', label: 'Medical records' },
  { key: 'allergies', label: 'Allergies' },
  { key: 'medications', label: 'Medications' },
  { key: 'prescriptions', label: 'Prescriptions' },
  { key: 'lab_results', label: 'Lab results' },
  { key: 'examinations', label: 'Examinations' },
  { key: 'diagnoses', label: 'Diagnoses' },
  { key: 'eye_history', label: 'Eye history' },
  { key: 'imaging', label: 'Imaging' },
  { key: 'documents', label: 'Documents' },
  { key: 'encounters', label: 'Encounters' },
  { key: 'visits', label: 'Visits' },
  { key: 'scheduling', label: 'Scheduling' },
  { key: 'billing', label: 'Billing' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'admissions', label: 'Admissions' },
  { key: 'counseling', label: 'Counseling' },
  { key: 'surgery', label: 'Surgery' },
  { key: 'preop', label: 'Pre-op' },
  { key: 'procedures', label: 'Procedures' },
  { key: 'optical', label: 'Optical' },
  { key: 'consents', label: 'Consents' },
  { key: 'communications', label: 'Communications' },
  { key: 'referrals', label: 'Referrals' },
  { key: 'notes', label: 'Notes' },
  { key: 'queue', label: 'Queue' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'portal_access', label: 'Portal' },
] as const;

export type PatientRecordTabKey = (typeof PATIENT_RECORD_TABS)[number]['key'];

export type PatientRecordTabGroupKey = 'clinical' | 'admin' | 'billing';

export const PATIENT_RECORD_TAB_GROUPS: Record<
  PatientRecordTabGroupKey,
  {
    label: string;
    shortLabel: string;
    visible: readonly PatientRecordTabKey[];
    overflow: readonly PatientRecordTabKey[];
  }
> = {
  clinical: {
    label: 'Clinical',
    shortLabel: 'Clinical',
    visible: [
      'overview',
      'vitals',
      'eye_history',
      'examinations',
      'diagnoses',
      'medications',
      'lab_results',
      'imaging',
    ],
    overflow: [
      'medical_records',
      'allergies',
      'prescriptions',
      'optical',
      'queue',
      'referrals',
      'notes',
      'communications',
      'feedback',
      'portal_access',
    ],
  },
  admin: {
    label: 'Admin',
    shortLabel: 'Admin',
    visible: ['documents', 'encounters', 'visits', 'scheduling', 'consents'],
    overflow: [],
  },
  billing: {
    label: 'Billing & pathways',
    shortLabel: 'Billing',
    visible: [
      'billing',
      'insurance',
      'admissions',
      'counseling',
      'surgery',
      'preop',
      'procedures',
    ],
    overflow: [],
  },
};

const TAB_TO_GROUP = new Map<PatientRecordTabKey, PatientRecordTabGroupKey>();
for (const [groupKey, group] of Object.entries(PATIENT_RECORD_TAB_GROUPS) as [
  PatientRecordTabGroupKey,
  (typeof PATIENT_RECORD_TAB_GROUPS)[PatientRecordTabGroupKey],
][]) {
  for (const tabKey of [...group.visible, ...group.overflow]) {
    TAB_TO_GROUP.set(tabKey, groupKey);
  }
}

export const PATIENT_RECORD_TAB_GROUP_KEYS = Object.keys(
  PATIENT_RECORD_TAB_GROUPS,
) as PatientRecordTabGroupKey[];

export function isPatientRecordTabKey(value: string | null | undefined): value is PatientRecordTabKey {
  return PATIENT_RECORD_TABS.some((t) => t.key === value);
}

export function patientRecordTabLabel(key: PatientRecordTabKey): string {
  return PATIENT_RECORD_TABS.find((t) => t.key === key)?.label ?? key;
}

export function resolveTabGroup(tab: PatientRecordTabKey): PatientRecordTabGroupKey {
  return TAB_TO_GROUP.get(tab) ?? 'clinical';
}

export function isTabInGroup(tab: PatientRecordTabKey, group: PatientRecordTabGroupKey): boolean {
  const config = PATIENT_RECORD_TAB_GROUPS[group];
  return config.visible.includes(tab) || config.overflow.includes(tab);
}

export function getDefaultTabForGroup(group: PatientRecordTabGroupKey): PatientRecordTabKey {
  return PATIENT_RECORD_TAB_GROUPS[group].visible[0];
}

export function getOverflowTabsForGroup(
  group: PatientRecordTabGroupKey,
): PatientRecordTabKey[] {
  return [...PATIENT_RECORD_TAB_GROUPS[group].overflow];
}

export function isOverflowTab(tab: PatientRecordTabKey, group: PatientRecordTabGroupKey): boolean {
  return PATIENT_RECORD_TAB_GROUPS[group].overflow.includes(tab);
}
