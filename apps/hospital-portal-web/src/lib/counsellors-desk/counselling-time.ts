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

/**
 * Package LA / UAT-FS-RT-01 — normalize backend ReportingTime (TimeSpan / ISO)
 * to machine-readable `HH:mm` for list validation and form state.
 * Does not accept 12-hour display strings (those are display-only).
 */
export function normalizeOtReportingTimeToHhMm(value?: string | null): string {
  if (value == null) return '';
  const raw = String(value).trim();
  if (!raw) return '';

  if (raw.includes('T')) {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  // TimeSpan "HH:mm:ss" or already "HH:mm"
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(raw);
  if (!m) return '';
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return '';
  if (h < 0 || h > 23 || min < 0 || min > 59) return '';
  return `${pad2(h)}:${pad2(min)}`;
}
