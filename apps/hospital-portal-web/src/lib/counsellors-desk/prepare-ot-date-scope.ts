import type { FinalizeSurgeryRecord } from '@/types/counsellors-desk';

/** True when `yyyy-MM-dd` (or ISO prefix) is a usable Prepare OT surgery date. */
export function isValidPrepareOtSurgeryDate(date: string | null | undefined): boolean {
  if (!date || typeof date !== 'string') return false;
  const day = date.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const parsed = new Date(`${day}T00:00:00`);
  return !Number.isNaN(parsed.getTime()) && parsed.getFullYear() >= 1900;
}

/**
 * Finalised rows eligible for Prepare OT on the selected surgery date.
 * Uses scheduleDate (yyyy-MM-dd) — never "all Finalised across dates".
 */
export function selectFinalisedForPrepareDate(
  records: FinalizeSurgeryRecord[],
  selectedDate: string | null | undefined,
): FinalizeSurgeryRecord[] {
  if (!isValidPrepareOtSurgeryDate(selectedDate)) return [];
  const day = selectedDate!.trim().slice(0, 10);
  return records.filter(
    (r) => r.status === 'Finalised' && (r.scheduleDate?.slice(0, 10) ?? '') === day,
  );
}
