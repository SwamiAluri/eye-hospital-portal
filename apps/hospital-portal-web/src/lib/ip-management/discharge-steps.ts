/**
 * Ward Discharge Workspace — 5-step Shell B (S-09).
 * See docs/mockups/ip-target/s-09-discharge-workspace.html
 */
import type { LucideIcon } from 'lucide-react';
import {
  CheckCircle2,
  ClipboardList,
  Pill,
  CalendarDays,
  ShieldAlert,
} from 'lucide-react';

export type DischargeStepKey =
  | 'clearance'
  | 'summary'
  | 'medications'
  | 'followup'
  | 'confirm';

export interface DischargeStepMeta {
  key: DischargeStepKey;
  index: number;
  label: string;
  short: string;
  icon: LucideIcon;
  /** Only clearance can hard-block discharge. */
  isGate?: boolean;
}

export const DISCHARGE_STEPS: DischargeStepMeta[] = [
  { key: 'clearance', index: 1, label: 'Clearance', short: 'Clearance', icon: ShieldAlert, isGate: true },
  { key: 'summary', index: 2, label: 'Discharge summary', short: 'Summary', icon: ClipboardList },
  { key: 'medications', index: 3, label: 'Medications', short: 'Meds', icon: Pill },
  { key: 'followup', index: 4, label: 'Follow-up', short: 'Follow-up', icon: CalendarDays },
  { key: 'confirm', index: 5, label: 'Confirm & discharge', short: 'Confirm', icon: CheckCircle2 },
];

export function getDischargeStep(key: DischargeStepKey): DischargeStepMeta {
  return DISCHARGE_STEPS.find(s => s.key === key) ?? DISCHARGE_STEPS[0];
}
