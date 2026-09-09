/** 24h `HH:mm` ↔ 12h parts for counselling time pickers. */

export type CounsellingTimePeriod = 'AM' | 'PM';

export interface CounsellingTimeParts {
  hour12: number; // 1–12
  minute: number; // 0–59
  period: CounsellingTimePeriod;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format stored `HH:mm` (24h) for display. Empty → ''. */
export function formatCounsellingTimeDisplay(value?: string | null): string {
  const parts = parseCounsellingTimeParts(value);
  if (!parts) return '';
  return `${pad2(parts.hour12)}:${pad2(parts.minute)} ${parts.period}`;
}

/** Parse `HH:mm` or `H:mm` into 12h parts. Invalid/empty → null. */
export function parseCounsellingTimeParts(value?: string | null): CounsellingTimeParts | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hour24 = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isFinite(hour24) || !Number.isFinite(minute)) return null;
  if (hour24 < 0 || hour24 > 23 || minute < 0 || minute > 59) return null;

  const period: CounsellingTimePeriod = hour24 >= 12 ? 'PM' : 'AM';
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, minute, period };
}

/** Convert 12h parts to `HH:mm` for OT save payloads. */
export function partsToHhMm(parts: CounsellingTimeParts): string {
  let hour24 = parts.hour12 % 12;
  if (parts.period === 'PM') hour24 += 12;
  return `${pad2(hour24)}:${pad2(parts.minute)}`;
}
