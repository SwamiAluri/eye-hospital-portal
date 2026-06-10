/** snake_case group_key from API / DB — also used as URL slug. */
export const MASTER_DATA_GROUP_KEYS = [
  'patient_setup',
  'clinical',
  'appointments',
  'counsellor',
  'billing_finance',
  'insurance',
  'inventory',
  'pharmacy',
  'lab_diagnostics',
  'ward_ip',
  'hr_staff',
  'system',
  'operations',
] as const;

export type MasterDataGroupKey = (typeof MASTER_DATA_GROUP_KEYS)[number];

/** URL slug equals registry group_key (snake_case). */
export function masterDataGroupSlug(groupKey: string): string {
  return groupKey;
}

export const MASTER_DATA_GROUP_ICONS: Record<string, string> = {
  patient_setup: '🧑‍⚕️',
  clinical: '🔬',
  appointments: '📅',
  counsellor: '💬',
  billing_finance: '💰',
  insurance: '🛡️',
  inventory: '📦',
  pharmacy: '💊',
  lab_diagnostics: '🧪',
  ward_ip: '🏥',
  hr_staff: '👥',
  system: '⚙️',
  operations: '📍',
};

export function masterDataGroupIcon(groupKey: string): string {
  return MASTER_DATA_GROUP_ICONS[groupKey] ?? '📋';
}
