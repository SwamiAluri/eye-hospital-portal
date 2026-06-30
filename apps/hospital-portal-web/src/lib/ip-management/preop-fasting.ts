/**
 * Fasting / NPO helpers (Phase 7, D5).
 * Thresholds mirror `PreOpClearanceService.FastingThresholdFor` on the server.
 */

export type IntakeType = 'clear' | 'light' | 'solid';

export const INTAKE_THRESHOLDS: Record<IntakeType, number> = {
  clear: 2,
  light: 6,
  solid: 8,
};

export const INTAKE_OPTIONS: Array<{ value: IntakeType; label: string }> = [
  { value: 'clear', label: 'Clear fluids (2h)' },
  { value: 'light', label: 'Light meal (6h)' },
  { value: 'solid', label: 'Solids / fatty (8h)' },
];

/** Beyond this a stored time is implausible (stale/typo) and must never read as confirmed. */
export const MAX_PLAUSIBLE_NPO_HOURS = 24;

export type FastingUiStatus = 'awaiting' | 'confirmed' | 'inadequate' | 'stale';

export interface FastingStatus {
  hours: number | null;
  threshold: number;
  status: FastingUiStatus;
  /** Server-aligned: adequate duration for the intake type and not stale. */
  confirmed: boolean;
  inadequate: boolean;
  stale: boolean;
}

export function normalizeIntakeType(unit: string | null | undefined): IntakeType {
  return unit === 'clear' || unit === 'solid' ? unit : 'light';
}

export function fastingThresholdFor(intakeType: IntakeType): number {
  return INTAKE_THRESHOLDS[intakeType];
}

export function hoursSinceNpo(value: string, now: Date = new Date()): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return null;
  return (now.getTime() - t) / 3_600_000;
}

export function formatFastingDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

/** Derive the fasting UI state from the single NPO writer (display only — server owns `fasting_confirmed`). */
export function computeFastingStatus(input: {
  npoValue: string;
  intakeType: IntakeType;
  now?: Date;
}): FastingStatus {
  const threshold = fastingThresholdFor(input.intakeType);
  const hours = hoursSinceNpo(input.npoValue, input.now);
  const stale = hours != null && hours > MAX_PLAUSIBLE_NPO_HOURS;
  const confirmed = hours != null && hours >= threshold && !stale;
  const inadequate = hours != null && hours < threshold && !stale;

  let status: FastingUiStatus = 'awaiting';
  if (stale) status = 'stale';
  else if (confirmed) status = 'confirmed';
  else if (inadequate) status = 'inadequate';

  return { hours, threshold, status, confirmed, inadequate, stale };
}
