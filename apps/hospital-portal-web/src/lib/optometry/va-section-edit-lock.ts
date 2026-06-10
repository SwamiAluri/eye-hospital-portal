/** Hospital local timezone until org settings are wired into the exam UI. */
export const HOSPITAL_TIMEZONE = 'Asia/Kolkata';

/** Calendar day in hospital TZ as YYYY-MM-DD. */
export function hospitalCalendarDay(iso?: string | Date | null, tz = HOSPITAL_TIMEZONE): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString('en-CA', { timeZone: tz });
}

/**
 * True if section may still be edited.
 * Record day must match the visit day (when provided) or today's hospital calendar day.
 */
export function isVaSectionEditableOnVisitDay(
  recordedAtIso?: string | null,
  visitDateIso?: string | null,
  tz = HOSPITAL_TIMEZONE,
): boolean {
  if (!recordedAtIso) return true;
  const referenceDay = hospitalCalendarDay(visitDateIso ?? new Date(), tz);
  const recordDay = hospitalCalendarDay(recordedAtIso, tz);
  return recordDay === referenceDay;
}
