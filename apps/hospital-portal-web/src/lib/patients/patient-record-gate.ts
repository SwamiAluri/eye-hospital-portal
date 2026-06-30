import type { PatientRecordTabKey } from './patient-record-tabs';
import { patientRecordTabLabel } from './patient-record-tabs';

/** Tabs that require an active check-in (or emergency override). */
export const CHECK_IN_GATED_TABS: PatientRecordTabKey[] = [
  'vitals',
  'medications',
  'lab_results',
  'examinations',
  'prescriptions',
];

export function isCheckInGatedTab(tab: PatientRecordTabKey): boolean {
  return CHECK_IN_GATED_TABS.includes(tab);
}

export function checkInGateLabel(tab: PatientRecordTabKey): string {
  return patientRecordTabLabel(tab);
}

const OVERRIDE_ROLES = new Set([
  'doctor',
  'admin',
  'consultant',
  'junior doctor',
  'nurse manager',
  'it administrator',
  'super admin',
]);

export function canEmergencyOverride(roles: string[]): boolean {
  return roles.some((r) => OVERRIDE_ROLES.has(r.toLowerCase()));
}
