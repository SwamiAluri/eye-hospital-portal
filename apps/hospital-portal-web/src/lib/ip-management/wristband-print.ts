import { operativeEyeDisplay } from '@/lib/ip-management/operative-eye-display';

/** Wristband can be minted after occupy/admit; cancelled expected stays blocked. */
export function canIssueWristband(clinicalState: string | null | undefined): boolean {
  const state = (clinicalState ?? '').trim();
  return state !== '' && state !== 'Expected' && state !== 'AdmissionCancelled';
}

export function formatWristbandDob(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatWristbandGender(value: string | null | undefined): string {
  const raw = (value ?? '').trim().toUpperCase();
  if (raw === 'F' || raw === 'FEMALE') return 'Female';
  if (raw === 'M' || raw === 'MALE') return 'Male';
  if (raw === 'O' || raw === 'OTHER') return 'Other';
  return (value ?? '').trim();
}

/** Spelled laterality for print. Colour is never the only cue. */
export function wristbandEyeLine(eyeOperated: string | null | undefined): {
  word: string;
  abbr: string | null;
} {
  const display = operativeEyeDisplay(eyeOperated);
  if (display.kind === 'eye') {
    return { word: display.word, abbr: display.code };
  }
  return { word: 'NOT RECORDED', abbr: null };
}
