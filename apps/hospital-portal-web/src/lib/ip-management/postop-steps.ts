/**
 * Ward Post-Op Workspace — 5-step Shell B (S-08).
 * See docs/mockups/ip-target/s-08-postop-workspace.html
 */
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ClipboardCheck,
  Droplets,
  FileText,
  ScanLine,
  UserCheck,
} from 'lucide-react';

export type PostOpStepKey =
  | 'vitals'
  | 'nurse'
  | 'iol'
  | 'taper'
  | 'instructions'
  | 'handover';

export interface PostOpStepMeta {
  key: PostOpStepKey;
  index: number;
  label: string;
  short: string;
  icon: LucideIcon;
}

export const POSTOP_STEPS: PostOpStepMeta[] = [
  { key: 'vitals', index: 1, label: 'Recovery vitals', short: 'Vitals', icon: Activity },
  { key: 'nurse', index: 2, label: 'Nurse checklist', short: 'Checklist', icon: ClipboardCheck },
  { key: 'iol', index: 3, label: 'IOL sticker & returns', short: 'IOL', icon: ScanLine },
  { key: 'taper', index: 4, label: 'Eyedrop plan', short: 'Taper', icon: Droplets },
  { key: 'instructions', index: 5, label: 'Post-op instructions', short: 'Instructions', icon: FileText },
  { key: 'handover', index: 6, label: 'Follow-up & handover', short: 'Handover', icon: UserCheck },
];

export function getPostOpStep(key: PostOpStepKey): PostOpStepMeta {
  return POSTOP_STEPS.find(s => s.key === key) ?? POSTOP_STEPS[0];
}
