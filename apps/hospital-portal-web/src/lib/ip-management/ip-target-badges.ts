export type IpTargetBadgeTone = 'ok' | 'ot' | 'danger' | 'efc' | 'inhouse' | 'info' | 'cancel' | '';

const CLINICAL_TONE: Record<string, IpTargetBadgeTone> = {
  Expected: 'info',
  Admitted: 'inhouse',
  ReadyForSurgery: 'ok',
  SentToOT: 'ot',
  InOT: 'ot',
  SurgeryCompleted: 'ok',
  PostOp: 'inhouse',
  ReadyForDischarge: 'ok',
  Discharged: '',
  CancelledSurgery: 'cancel',
  AdmissionCancelled: 'cancel',
};

const CLINICAL_LABEL: Record<string, string> = {
  Expected: 'Expected',
  Admitted: 'Admitted',
  ReadyForSurgery: 'Ready for OT',
  SentToOT: 'Sent to OT',
  InOT: 'In OT',
  SurgeryCompleted: 'Surgery done',
  PostOp: 'Post-op',
  ReadyForDischarge: 'Ready D/C',
  Discharged: 'Discharged',
  CancelledSurgery: 'Cancelled',
  AdmissionCancelled: 'Admission cancelled',
};

export function clinicalBadgeTone(state: string | null | undefined): IpTargetBadgeTone {
  if (!state) return '';
  return CLINICAL_TONE[state] ?? '';
}

export function clinicalBadgeLabel(state: string | null | undefined): string {
  if (!state) return '—';
  return CLINICAL_LABEL[state] ?? state.replace(/([A-Z])/g, ' $1').trim();
}

export function coverageToneToBadge(tone: 'ok' | 'warn' | 'danger' | 'neutral' | 'info'): string {
  if (tone === 'ok') return 'ok';
  if (tone === 'warn') return 'ot';
  if (tone === 'danger') return 'danger';
  if (tone === 'info') return 'info';
  return '';
}
