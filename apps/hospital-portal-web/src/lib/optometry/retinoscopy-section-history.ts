import type { RetinoscopySectionId } from './retinoscopy-section-constants';
import type {
  DryRetinoscopyData,
  RetinoscopyReading,
  SubjectiveRefractionData,
  WetRetinoscopyData,
} from './retinoscopy-types';
import type { OptometryVisitExamRecord } from './optometry-history.types';
import type { PriorVisitSnapshot } from './optometry-exam-types';

function formatDate(d: unknown): string {
  if (!d) return '—';
  try {
    return new Date(String(d)).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return String(d);
  }
}

export function formatPrescription(
  sphere: number,
  cylinder?: number,
  axis?: number,
): string {
  let result = `${sphere >= 0 ? '+' : ''}${sphere.toFixed(2)}`;
  if (cylinder != null && axis != null) {
    result += ` / ${cylinder >= 0 ? '+' : ''}${cylinder.toFixed(2)} × ${axis}°`;
  }
  return result;
}

export function calculateNeutralizingPower(grossPower: number, workingDistance: number): number {
  const workingDistanceDiopters = 100 / workingDistance;
  return grossPower - workingDistanceDiopters;
}

function latestReadingSummary(readings: RetinoscopyReading[]): string {
  if (!readings.length) return '—';
  const r = readings[readings.length - 1];
  const rx = formatPrescription(r.sphere, r.cylinder, r.axis);
  const neutral = calculateNeutralizingPower(r.sphere, r.workingDistance).toFixed(2);
  return `${rx} @ ${r.workingDistance}cm (${neutral}D)`;
}

export function hasWetSectionContent(data: WetRetinoscopyData | null | undefined): boolean {
  if (!data) return false;
  return Boolean(
    data.drug &&
      data.odReadings.length > 0 &&
      data.osReadings.length > 0,
  );
}

export function hasDrySectionContent(data: DryRetinoscopyData | null | undefined): boolean {
  if (!data) return false;
  return data.odReadings.length > 0 && data.osReadings.length > 0;
}

export function hasSubjectiveSectionContent(
  data: SubjectiveRefractionData | null | undefined,
): boolean {
  if (!data) return false;
  return data.readings.length > 0;
}

export function formatWetSectionSummary(data: WetRetinoscopyData | null | undefined): string {
  if (!data) return 'No data';
  const drug = data.drug ?? '—';
  const duration = data.duration != null ? `${data.duration} min` : null;
  const time = data.timeAdministered?.trim() || null;
  const admin = [duration, time].filter(Boolean).join(' @ ') || null;
  const od = latestReadingSummary(data.odReadings);
  const os = latestReadingSummary(data.osReadings);
  const parts = [drug, admin, `OD ${od}`, `OS ${os}`].filter(Boolean);
  return parts.join(' · ');
}

export function formatDrySectionSummary(data: DryRetinoscopyData | null | undefined): string {
  if (!data) return 'No data';
  return `OD ${latestReadingSummary(data.odReadings)} · OS ${latestReadingSummary(data.osReadings)}`;
}

export function formatSubjectiveSectionSummary(
  data: SubjectiveRefractionData | null | undefined,
): string {
  if (!data?.readings.length) return 'No readings';
  const final = data.readings.find((r) => r.isFinal);
  const target = final ?? data.readings[data.readings.length - 1];
  const od = formatPrescription(target.odSphere, target.odCylinder, target.odAxis);
  const os = formatPrescription(target.osSphere, target.osCylinder, target.osAxis);
  const va =
    target.vaAchievedOD || target.vaAchievedOS
      ? `VA OD ${target.vaAchievedOD || '—'} / OS ${target.vaAchievedOS || '—'}`
      : null;
  const tag = final ? '★ Final Rx' : `Reading #${target.entryNumber}`;
  return [tag, `OD ${od}`, `OS ${os}`, va].filter(Boolean).join(' · ');
}

/** Multi-line subjective prior summary (all readings; final highlighted). */
export function formatSubjectivePriorVisitDetail(
  data: SubjectiveRefractionData | null | undefined,
): string[] {
  if (!data?.readings.length) return [];
  return data.readings.map((r) => {
    const od = formatPrescription(r.odSphere, r.odCylinder, r.odAxis);
    const os = formatPrescription(r.osSphere, r.osCylinder, r.osAxis);
    const prefix = r.isFinal ? '★ Final' : `#${r.entryNumber}`;
    const va = `VA OD ${r.vaAchievedOD || '—'} / OS ${r.vaAchievedOS || '—'}`;
    return `${prefix}: OD ${od} · OS ${os} · ${va}`;
  });
}

function segmentKey(id: RetinoscopySectionId): keyof OptometryVisitExamRecord['segments'] {
  if (id === 'wet') return 'wet_retinoscopy';
  if (id === 'dry') return 'dry_retinoscopy';
  return 'subjective_refraction';
}

export interface RetinoscopyPriorHistoryRow {
  examinationDate: string;
  visitId: string;
  snapshot: unknown;
  summary: string;
}

export function getRetinoscopyPriorHistory(
  sectionId: RetinoscopySectionId,
  visits: OptometryVisitExamRecord[],
  excludeVisitId?: string,
  maxItems = 5,
): RetinoscopyPriorHistoryRow[] {
  const key = segmentKey(sectionId);
  return visits
    .filter((v) => v.visitId !== excludeVisitId)
    .filter((v) => {
      const snap = v.segments[key];
      if (sectionId === 'wet') return hasWetSectionContent(snap as WetRetinoscopyData);
      if (sectionId === 'dry') return hasDrySectionContent(snap as DryRetinoscopyData);
      return hasSubjectiveSectionContent(snap as SubjectiveRefractionData);
    })
    .sort(
      (a, b) =>
        new Date(b.examinationDate).getTime() - new Date(a.examinationDate).getTime(),
    )
    .slice(0, maxItems)
    .map((v) => {
      const snap = v.segments[key];
      let summary = '—';
      if (sectionId === 'wet') summary = formatWetSectionSummary(snap as WetRetinoscopyData);
      else if (sectionId === 'dry') summary = formatDrySectionSummary(snap as DryRetinoscopyData);
      else summary = formatSubjectiveSectionSummary(snap as SubjectiveRefractionData);
      return {
        examinationDate: formatDate(v.examinationDate),
        visitId: v.visitId,
        snapshot: snap,
        summary,
      };
    });
}

export function hasPriorHistoryForRetinoscopySection(
  sectionId: RetinoscopySectionId,
  visits: OptometryVisitExamRecord[],
  excludeVisitId?: string,
): boolean {
  return getRetinoscopyPriorHistory(sectionId, visits, excludeVisitId, 1).length > 0;
}

export function formatRetinoscopyTabLastVisitLine(prior: PriorVisitSnapshot): string | null {
  const raw = prior.raw as {
    wet_retinoscopy?: WetRetinoscopyData;
    wetRetinoscopy?: WetRetinoscopyData;
    dry_retinoscopy?: DryRetinoscopyData;
    dryRetinoscopy?: DryRetinoscopyData;
    subjective_refraction?: SubjectiveRefractionData;
    subjectiveRefraction?: SubjectiveRefractionData;
  } | undefined;

  const wet = raw?.wet_retinoscopy ?? raw?.wetRetinoscopy;
  const dry = raw?.dry_retinoscopy ?? raw?.dryRetinoscopy;
  const subj = raw?.subjective_refraction ?? raw?.subjectiveRefraction;

  const parts: string[] = [];
  if (hasWetSectionContent(wet)) parts.push(`Wet: ${formatWetSectionSummary(wet)}`);
  if (hasDrySectionContent(dry)) parts.push(`Dry: ${formatDrySectionSummary(dry)}`);
  if (hasSubjectiveSectionContent(subj)) parts.push(`Subj: ${formatSubjectiveSectionSummary(subj)}`);
  return parts.length ? parts.join(' · ') : null;
}
