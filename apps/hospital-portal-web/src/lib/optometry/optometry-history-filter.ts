import type { OptometryVisitExamRecord } from './optometry-history.types';

const INDIA_TZ = 'Asia/Kolkata';

/** Local calendar date (YYYY-MM-DD) in Asia/Kolkata for an ISO timestamp. */
export function toIndiaCalendarDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: INDIA_TZ });
}

/**
 * Client-side defense: drop visits on the same calendar day as the anchor visit.
 * Used when history was loaded without excludeSameDayAsVisitId (legacy callers).
 */
export function filterPriorDayVisits(
  visits: OptometryVisitExamRecord[],
  anchorVisitId?: string,
  anchorExaminationDate?: string,
): OptometryVisitExamRecord[] {
  if (!anchorVisitId && !anchorExaminationDate) return visits;

  const anchorInList = anchorVisitId
    ? visits.find((v) => v.visitId === anchorVisitId)
    : undefined;
  const anchorDate = anchorExaminationDate
    ? toIndiaCalendarDate(anchorExaminationDate)
    : anchorInList
      ? toIndiaCalendarDate(anchorInList.examinationDate)
      : '';

  if (!anchorDate) {
    return anchorVisitId ? visits.filter((v) => v.visitId !== anchorVisitId) : visits;
  }

  return visits.filter((v) => {
    if (anchorVisitId && v.visitId === anchorVisitId) return false;
    return toIndiaCalendarDate(v.examinationDate) !== anchorDate;
  });
}
