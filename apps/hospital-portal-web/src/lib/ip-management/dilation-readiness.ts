/**
 * Dilation countdown (W-06 A3). Server remainingSeconds is the authority at fetch;
 * local ticks are display-only.
 */

export const DILATION_READY_MINUTES = 25;

export type DilationStatus = 'not_recorded' | 'not_ready' | 'ready';

export interface DilationSlice {
  startedAt: string | null;
  readyAt: string | null;
  remainingSeconds: number | null;
  status: DilationStatus;
  medicineName: string | null;
}

export function formatDilationMmSs(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export function remainingSecondsFromSlice(slice: DilationSlice, nowMs = Date.now()): number {
  if (slice.readyAt) {
    return Math.max(0, Math.ceil((new Date(slice.readyAt).getTime() - nowMs) / 1000));
  }
  return Math.max(0, slice.remainingSeconds ?? 0);
}

export function dilationChipLabel(slice: DilationSlice, remainingSeconds: number): string {
  if (slice.status === 'not_recorded') return 'No dilating drop recorded';
  const given = slice.startedAt
    ? new Date(slice.startedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    : null;
  if (slice.status === 'ready' || remainingSeconds <= 0) {
    const ready = slice.readyAt
      ? new Date(slice.readyAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
      : null;
    const bits = ['Dilation ready'];
    if (given) bits.push(`drops at ${given}`);
    if (ready) bits.push(`ready since ${ready}`);
    return bits.join(' · ');
  }
  const med = slice.medicineName ? ` · ${slice.medicineName}` : '';
  const at = given ? ` at ${given}` : '';
  return `remaining${med}${at}`;
}
