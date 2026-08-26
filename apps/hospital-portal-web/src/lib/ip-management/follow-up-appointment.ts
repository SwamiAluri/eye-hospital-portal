import axios from 'axios';

export const FOLLOW_UP_APPOINTMENT_TYPE = 'Follow-up';
export const FOLLOW_UP_DURATION_MINUTES = 30;

export function isActiveClinicAppointment(status: string | null | undefined): boolean {
  const s = (status ?? '').trim().toLowerCase();
  return s !== '' && s !== 'cancelled' && s !== 'deleted' && s !== 'no-show';
}

/** Auth conflict copy → discharge workspace copy. */
export function followUpBookErrorMessage(err: unknown, fallback = 'Could not book that visit.'): string {
  const raw = extractErrorMessage(err);
  if (raw && /not available/i.test(raw)) return 'That time is not available.';
  if (raw?.trim()) return raw.trim();
  return fallback;
}

export function defaultFollowUpLocalInput(from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatFollowUpWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function extractErrorMessage(err: unknown): string | undefined {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; error?: string; detail?: string } | undefined;
    return data?.message || data?.error || data?.detail || err.message;
  }
  if (err instanceof Error) return err.message;
  return undefined;
}
