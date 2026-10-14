/**
 * Patient Directory DOB display helpers (presentation only).
 * UI: DD/MM/YYYY · URL/API contract: yyyy-MM-dd (unchanged).
 */

export const DIRECTORY_DOB_PLACEHOLDER = 'DD/MM/YYYY';

/** Strip to digits and format as DD/MM/YYYY while typing. */
export function formatDirectoryDobDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Reject alphabetic characters; keep digits and slash. */
export function sanitizeDirectoryDobInput(raw: string): string {
  return formatDirectoryDobDigits(raw.replace(/[^\d/]/g, ''));
}

/** Convert ISO yyyy-MM-dd → DD/MM/YYYY for display. */
export function isoToDirectoryDobDisplay(iso?: string | null): string {
  const value = iso?.trim() ?? '';
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return '';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export type DirectoryDobParseResult =
  | { status: 'empty' }
  | { status: 'incomplete' }
  | { status: 'invalid' }
  | { status: 'valid'; iso: string };

/**
 * Parse DD/MM/YYYY display into API ISO date.
 * Incomplete (still typing) → incomplete; bad calendar date → invalid.
 */
export function parseDirectoryDobDisplay(display: string): DirectoryDobParseResult {
  const trimmed = display.trim();
  if (!trimmed) return { status: 'empty' };

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8) return { status: 'incomplete' };
  if (digits.length > 8) return { status: 'invalid' };

  const day = Number.parseInt(digits.slice(0, 2), 10);
  const month = Number.parseInt(digits.slice(2, 4), 10);
  const year = Number.parseInt(digits.slice(4, 8), 10);

  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    return { status: 'invalid' };
  }
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return { status: 'invalid' };
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { status: 'invalid' };
  }

  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // DOB cannot be today or a future calendar day (local date).
  if (!isDirectoryDobOnOrBeforeYesterday(iso)) {
    return { status: 'invalid' };
  }

  return { status: 'valid', iso };
}

/** True when ISO yyyy-MM-dd is strictly before local today. */
export function isDirectoryDobOnOrBeforeYesterday(iso: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return false;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth() + 1;
  const todayD = today.getDate();
  if (year > todayY) return false;
  if (year < todayY) return true;
  if (month > todayM) return false;
  if (month < todayM) return true;
  return day < todayD;
}

/** Latest selectable DOB calendar day (yesterday, local). */
export function directoryDobLatestSelectableDate(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
}
