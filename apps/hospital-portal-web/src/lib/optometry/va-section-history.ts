import type { VaSectionId } from './visual-acuity-constants';
import type { OptometryVisitExamRecord, VaSectionPriorHistoryRow } from './optometry-history.types';
import { fallbackVaSectionSnapshot } from './optometry-history-mappers';

function sectionSummaryLine(sectionId: VaSectionId, visit: OptometryVisitExamRecord): string {
  const s = visit.summary;
  switch (sectionId) {
    case 'old':
      return s.previousGlassesLine ?? 'Previous glasses recorded';
    case 'new':
      return s.todaysRxLine ?? "Today's Rx recorded";
    case 'refraction':
      return s.refractionLine ?? 'Refraction recorded';
    case 'distance':
      return s.distanceVaLine ?? 'Distance & near recorded';
    case 'keratometry':
      return s.keratometryLine ?? 'Keratometry recorded';
    case 'color':
      return 'Color vision recorded';
    case 'contrast':
      return 'Contrast recorded';
    default:
      return 'Recorded';
  }
}

function hasVaSectionData(sectionId: VaSectionId, visit: OptometryVisitExamRecord): boolean {
  const va = visit.segments.visual_acuity_bundle;
  if (!va) return false;
  if (va.sectionRecorded?.[sectionId]) return true;
  return fallbackVaSectionSnapshot(sectionId, va) != null;
}

/** Whether patient history has prior visit rows for this VA section. */
export function hasPriorHistoryForSection(
  sectionId: VaSectionId,
  patientHistory: OptometryVisitExamRecord[],
): boolean {
  return getVaSectionPriorHistory(sectionId, patientHistory, undefined, 1).length > 0;
}

/** @deprecated use hasPriorHistoryForSection with patientHistory */
export function hasPriorHistoryForSectionLegacy(
  sectionId: VaSectionId,
  vaHistory: unknown[],
  refHistory: unknown[],
): boolean {
  if (sectionId === 'distance') return vaHistory.length > 0;
  if (['old', 'new', 'refraction'].includes(sectionId)) return refHistory.length > 0;
  return false;
}

/** Prior visit rows for the section rail, newest first. */
export function getVaSectionPriorHistory(
  sectionId: VaSectionId,
  patientHistory: OptometryVisitExamRecord[],
  excludeVisitId?: string,
  maxItems = 5,
): VaSectionPriorHistoryRow[] {
  return patientHistory
    .filter((v) => (excludeVisitId ? v.visitId !== excludeVisitId : true))
    .filter((v) => hasVaSectionData(sectionId, v))
    .slice(0, maxItems)
    .map((v) => ({
      examinationDate: v.examinationDate,
      visitId: v.visitId,
      snapshot: fallbackVaSectionSnapshot(sectionId, v.segments.visual_acuity_bundle),
      summary: sectionSummaryLine(sectionId, v),
    }));
}

/** @deprecated use getVaSectionPriorHistory */
export function getSectionPriorHistory(
  sectionId: VaSectionId,
  vaHistory: unknown[],
  refHistory: unknown[],
  maxItems = 5,
): Record<string, unknown>[] {
  const refList = (Array.isArray(refHistory) ? refHistory : []) as Record<string, unknown>[];
  const vaList = (Array.isArray(vaHistory) ? vaHistory : []) as Record<string, unknown>[];
  const source = sectionId === 'distance' ? vaList : ['old', 'new', 'refraction'].includes(sectionId) ? refList : [];
  return [...source]
    .sort(
      (a, b) =>
        new Date(String(b.examinationDate ?? 0)).getTime() -
        new Date(String(a.examinationDate ?? 0)).getTime(),
    )
    .slice(0, maxItems);
}
