import type { IopSectionId } from './iop-section-constants';
import type { OptometryVisitExamRecord } from './optometry-history.types';
import { fallbackIopSectionSnapshot } from './optometry-history-mappers';
import type {
  IopSectionSnapshotMap,
  IopMegaFormState,
} from './iop-section-snapshot';
import {
  EMPTY_PACHYMETRY,
  EMPTY_SCHIRMER,
  EMPTY_TONOMETRY_PHASE,
  EMPTY_VISUAL_FIELD,
  extractSectionSnapshot,
} from './iop-section-snapshot';
import type { PriorVisitSnapshot } from './optometry-exam-types';
import type {
  PachymetryData,
  TonometryData,
  VisualFieldData,
} from '@/lib/stores/clinical-store';

function formatDate(d: unknown): string {
  if (!d) return '—';
  try {
    return new Date(String(d)).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return String(d);
  }
}

function iopFromRecord(rec: Record<string, unknown>, eye: 'OD' | 'OS'): string | undefined {
  const side = (rec[eye] ?? rec[eye.toLowerCase()]) as Record<string, unknown> | number | undefined;
  if (typeof side === 'number') return String(side);
  if (side && typeof side === 'object') {
    const v = side.measuredIOP ?? side.iop ?? side.predilation ?? side.value;
    if (v != null && v !== '') return String(v);
  }
  return undefined;
}

const ATN_METHOD_MARKERS = ['ATN', 'GOLDMANN', 'APPLANATION', 'PERKINS', 'TONOPEN'];

export function isAtnTonometryMethod(method: unknown): boolean {
  if (method == null || method === '') return false;
  const m = String(method).toUpperCase();
  return ATN_METHOD_MARKERS.some((marker) => m.includes(marker));
}

/** Filter IOP trend rows by tonometry method for NCT vs ATN rails. */
export function filterTonometryTrendForSection(
  sectionId: 'nct' | 'atn',
  iopTrend: unknown[],
): Record<string, unknown>[] {
  const list = (Array.isArray(iopTrend) ? iopTrend : []) as Record<string, unknown>[];
  return list.filter((rec) => {
    const isAtn = isAtnTonometryMethod(rec.method);
    return sectionId === 'atn' ? isAtn : !isAtn;
  });
}

/** Prior IOP trend rows for tonometry section rails. */
export function getTonometryPriorHistory(
  sectionId: 'nct' | 'atn',
  iopTrend: unknown[],
  maxItems = 5,
): Record<string, unknown>[] {
  return [...filterTonometryTrendForSection(sectionId, iopTrend)]
    .sort(
      (a, b) =>
        new Date(String(b.examinationDate ?? 0)).getTime() -
        new Date(String(a.examinationDate ?? 0)).getTime(),
    )
    .slice(0, maxItems);
}

/** @deprecated use getTonometryPriorHistory */
export function getNctPriorHistory(iopTrend: unknown[], maxItems = 5): Record<string, unknown>[] {
  return getTonometryPriorHistory('nct', iopTrend, maxItems);
}

/** Build NCT IOP trend rows from patient optometry visit history. */
export function buildIopTrendFromVisits(visits: OptometryVisitExamRecord[]): unknown[] {
  return visits
    .map((v) => {
      const nct = v.segments.iop_bundle?.nct?.beforeDilatation;
      const od = nct?.OD?.value;
      const os = nct?.OS?.value;
      if (!od && !os) return null;
      return {
        id: v.visitId,
        examinationDate: v.examinationDate,
        method: 'NCT',
        OD: { measuredIOP: od ? parseFloat(od) : undefined },
        OS: { measuredIOP: os ? parseFloat(os) : undefined },
      };
    })
    .filter(Boolean);
}

export interface PriorIopSectionEntry {
  date: string;
  summary: string;
}

/** Prior section snapshots from last visit draft (`iopExtended.sectionSnapshots`). */
export function getPriorIopSectionSnapshots(
  priorIopExtended: unknown,
): IopSectionSnapshotMap {
  if (!priorIopExtended || typeof priorIopExtended !== 'object') return {};
  const ext = priorIopExtended as { sectionSnapshots?: IopSectionSnapshotMap };
  return ext.sectionSnapshots ?? {};
}

export function getSectionPriorHistory(
  sectionId: IopSectionId,
  priorIopExtended: unknown,
  priorExaminationDate?: string,
  maxItems = 3,
): PriorIopSectionEntry[] {
  const snaps = getPriorIopSectionSnapshots(priorIopExtended);
  const snap = snaps[sectionId];
  if (snap == null) return [];
  const date = priorExaminationDate ? formatDate(priorExaminationDate) : 'Last visit';
  const summary = formatSectionSnapshotOneLine(sectionId, snap);
  if (!summary || summary === '—') return [];
  return [{ date, summary }].slice(0, maxItems);
}

export function formatSectionSnapshotOneLine(sectionId: IopSectionId, snap: unknown): string {
  switch (sectionId) {
    case 'nct':
    case 'atn': {
      const s = formatTonometrySnapshotSummary(snap as object);
      return `Pre ${s.preOd ?? '—'}/${s.preOs ?? '—'} · Post ${s.postOd ?? '—'}/${s.postOs ?? '—'}`;
    }
    case 'schirmer':
      return formatSchirmerSnapshotSummary(snap as object);
    case 'pachymetry':
      return formatPachymetrySnapshotSummary(snap as object);
    case 'visual-field':
      return formatVisualFieldSnapshotSummary(snap as object);
    default:
      return '—';
  }
}

export function hasPriorHistoryForIopSection(
  sectionId: IopSectionId,
  iopTrend: unknown[],
  priorIopExtended?: unknown,
): boolean {
  if (sectionId === 'nct' || sectionId === 'atn') {
    return getTonometryPriorHistory(sectionId, iopTrend, 1).length > 0;
  }
  return getSectionPriorHistory(sectionId, priorIopExtended).length > 0;
}

/** Patient-scoped IOP section history from visit records. */
export function hasPriorHistoryForIopSectionFromVisits(
  sectionId: IopSectionId,
  patientHistory: OptometryVisitExamRecord[],
  excludeVisitId?: string,
): boolean {
  return getIopSectionPriorHistoryFromVisits(sectionId, patientHistory, excludeVisitId, 1).length > 0;
}

export function getIopSectionPriorHistoryFromVisits(
  sectionId: IopSectionId,
  patientHistory: OptometryVisitExamRecord[],
  excludeVisitId?: string,
  maxItems = 5,
): PriorIopSectionEntry[] {
  return patientHistory
    .filter((v) => (excludeVisitId ? v.visitId !== excludeVisitId : true))
    .filter((v) => {
      const iop = v.segments.iop_bundle;
      if (!iop) return false;
      return iop.sectionRecorded?.[sectionId] || fallbackIopSectionSnapshot(sectionId, iop) != null;
    })
    .slice(0, maxItems)
    .map((v) => {
      const snap = fallbackIopSectionSnapshot(sectionId, v.segments.iop_bundle);
      const summary = formatSectionSnapshotOneLine(sectionId, snap);
      return {
        date: formatDate(v.examinationDate),
        summary,
        visitId: v.visitId,
        snapshot: snap,
      };
    })
    .filter((e) => e.summary && e.summary !== '—');
}

export interface PriorIopSectionEntryWithVisit extends PriorIopSectionEntry {
  visitId?: string;
  snapshot?: unknown;
}

export function formatTonometrySnapshotSummary(
  snap: {
    beforeDilatation?: { OD?: { value?: string }; OS?: { value?: string } };
    afterDilatation?: { OD?: { value?: string }; OS?: { value?: string } };
  } | null | undefined,
): { preOd?: string; preOs?: string; postOd?: string; postOs?: string } {
  if (!snap) return {};
  return {
    preOd: snap.beforeDilatation?.OD?.value,
    preOs: snap.beforeDilatation?.OS?.value,
    postOd: snap.afterDilatation?.OD?.value,
    postOs: snap.afterDilatation?.OS?.value,
  };
}

export function formatTrendRowSummary(rec: Record<string, unknown>): {
  date: string;
  od?: string;
  os?: string;
  method?: string;
} {
  return {
    date: formatDate(rec.examinationDate),
    od: iopFromRecord(rec, 'OD'),
    os: iopFromRecord(rec, 'OS'),
    method: rec.method != null ? String(rec.method) : undefined,
  };
}

export function formatSchirmerSnapshotSummary(
  snap: {
    OD?: { measurement?: string; interpretation?: string };
    OS?: { measurement?: string; interpretation?: string };
  } | null | undefined,
): string {
  if (!snap) return '—';
  const od = snap.OD?.measurement ? `${snap.OD.measurement} mm` : '—';
  const os = snap.OS?.measurement ? `${snap.OS.measurement} mm` : '—';
  return `OD ${od} · OS ${os}`;
}

export function formatPachymetrySnapshotSummary(
  snap: {
    OD?: { cct?: string; correctedIOP?: string };
    OS?: { cct?: string; correctedIOP?: string };
  } | null | undefined,
): string {
  if (!snap) return '—';
  const od = snap.OD?.cct ? `${snap.OD.cct} µm` : '—';
  const os = snap.OS?.cct ? `${snap.OS.cct} µm` : '—';
  return `CCT OD ${od} · OS ${os}`;
}

export function formatVisualFieldSnapshotSummary(
  snap: {
    OD?: { md?: string; psd?: string; reliability?: string };
    OS?: { md?: string; psd?: string; reliability?: string };
  } | null | undefined,
): string {
  if (!snap) return '—';
  const od = snap.OD?.md ? `MD ${snap.OD.md}` : '—';
  const os = snap.OS?.md ? `MD ${snap.OS.md}` : '—';
  return `OD ${od} · OS ${os}`;
}

/** ATN prior pre-dil values from last visit extended draft or summary IOP when method is ATN. */
export function getAtnPriorBeforeDil(
  priorVisit?: PriorVisitSnapshot | null,
  priorIopExtended?: unknown,
): { od?: string; os?: string } {
  const ext = priorIopExtended as { atn?: IopMegaFormState['atn'] } | undefined;
  if (ext?.atn?.beforeDilatation) {
    return {
      od: ext.atn.beforeDilatation.OD?.value || undefined,
      os: ext.atn.beforeDilatation.OS?.value || undefined,
    };
  }
  if (priorVisit?.iop?.method && isAtnTonometryMethod(priorVisit.iop.method)) {
    return {
      od: priorVisit.iop.od != null ? String(priorVisit.iop.od) : undefined,
      os: priorVisit.iop.os != null ? String(priorVisit.iop.os) : undefined,
    };
  }
  return {};
}

export function evaluateTargetIopStatus(
  values: { od?: string; os?: string },
  targetOD?: number,
  targetOS?: number,
): { od?: 'at-goal' | 'above'; os?: 'at-goal' | 'above' } {
  const out: { od?: 'at-goal' | 'above'; os?: 'at-goal' | 'above' } = {};
  if (targetOD != null && values.od) {
    const v = parseFloat(values.od);
    if (!Number.isNaN(v)) out.od = v <= targetOD ? 'at-goal' : 'above';
  }
  if (targetOS != null && values.os) {
    const v = parseFloat(values.os);
    if (!Number.isNaN(v)) out.os = v <= targetOS ? 'at-goal' : 'above';
  }
  return out;
}

/** Build form state from clinical segment props (for snapshot backfill on hydrate). */
export function buildClinicalIopFormState(input: {
  tonometryData?: TonometryData | null;
  pachymetryData?: PachymetryData | null;
  visualFieldData?: VisualFieldData | null;
  calculateCorrectedIOP: (cct: number, iop: number) => string;
}): Partial<IopMegaFormState> {
  const { tonometryData, pachymetryData, visualFieldData, calculateCorrectedIOP } = input;
  const partial: Partial<IopMegaFormState> = {};

  if (tonometryData) {
    partial.nct = {
      beforeDilatation: {
        OD: { value: tonometryData.OD?.predilation?.toString() || tonometryData.OD?.measuredIOP?.toString() || '', time: '' },
        OS: { value: tonometryData.OS?.predilation?.toString() || tonometryData.OS?.measuredIOP?.toString() || '', time: '' },
      },
      afterDilatation: {
        OD: { value: tonometryData.OD?.postdilation?.toString() || '', time: '' },
        OS: { value: tonometryData.OS?.postdilation?.toString() || '', time: '' },
      },
    };
  }

  if (pachymetryData) {
    const odCct = pachymetryData.OD?.centralThickness ?? 0;
    const osCct = pachymetryData.OS?.centralThickness ?? 0;
    const odIop = parseFloat(
      tonometryData?.OD?.predilation?.toString() || tonometryData?.OD?.measuredIOP?.toString() || '0',
    );
    const osIop = parseFloat(
      tonometryData?.OS?.predilation?.toString() || tonometryData?.OS?.measuredIOP?.toString() || '0',
    );
    partial.pachymetry = {
      OD: { cct: odCct ? String(odCct) : '', correctedIOP: calculateCorrectedIOP(Number(odCct), odIop) },
      OS: { cct: osCct ? String(osCct) : '', correctedIOP: calculateCorrectedIOP(Number(osCct), osIop) },
    };
  }

  if (visualFieldData) {
    partial.visualField = {
      OD: {
        testType: visualFieldData.testType || 'Automated Perimetry',
        md: visualFieldData.OD?.MD?.toString() || '',
        psd: visualFieldData.OD?.PSD?.toString() || '',
        reliability: visualFieldData.OD?.reliability || 'Good',
        defects: visualFieldData.OD?.notes || '',
      },
      OS: {
        testType: visualFieldData.testType || 'Automated Perimetry',
        md: visualFieldData.OS?.MD?.toString() || '',
        psd: visualFieldData.OS?.PSD?.toString() || '',
        reliability: visualFieldData.OS?.reliability || 'Good',
        defects: visualFieldData.OS?.notes || '',
      },
    };
  }

  return partial;
}

function trendRecordToTonometry(rec: Record<string, unknown>): TonometryData | null {
  const od = (rec.OD ?? rec.od) as Record<string, unknown> | number | undefined;
  const os = (rec.OS ?? rec.os) as Record<string, unknown> | number | undefined;
  const readEye = (side: Record<string, unknown> | number | undefined) => {
    if (typeof side === 'number') return { measuredIOP: side, predilation: side };
    if (!side || typeof side !== 'object') return {};
    const measured = side.measuredIOP ?? side.iop ?? side.predilation;
    const pre = side.predilation ?? side.measuredIOP ?? side.iop;
    const post = side.postdilation;
    return {
      measuredIOP: measured != null ? Number(measured) : undefined,
      predilation: pre != null ? Number(pre) : undefined,
      postdilation: post != null ? Number(post) : undefined,
    };
  };
  const odEye = readEye(od);
  const osEye = readEye(os);
  if (odEye.measuredIOP == null && osEye.measuredIOP == null) return null;
  return {
    patientId: String(rec.patientId ?? ''),
    examinationDate: rec.examinationDate ? String(rec.examinationDate) : undefined,
    method: rec.method != null ? String(rec.method) : undefined,
    OD: odEye,
    OS: osEye,
    targetIOPOD: rec.targetIOPOD != null ? Number(rec.targetIOPOD) : undefined,
    targetIOPOS: rec.targetIOPOS != null ? Number(rec.targetIOPOS) : undefined,
  } as TonometryData;
}

/** Build prior-visit section snapshots from persisted clinical segments (pachymetry, VF, tonometry trend). */
export function buildPriorIopSectionSnapshotsFromClinical(input: {
  tonometryRecord?: Record<string, unknown> | null;
  pachymetryData?: PachymetryData | null;
  visualFieldData?: VisualFieldData | null;
  calculateCorrectedIOP?: (cct: number, iop: number) => string;
}): IopSectionSnapshotMap {
  const calc =
    input.calculateCorrectedIOP ??
    ((cct: number, iop: number) => {
      if (!cct || !iop) return '';
      const difference = cct - 545;
      const correction = (difference / 10) * 0.7;
      return (iop - correction).toFixed(1);
    });

  const tonometryData = input.tonometryRecord
    ? trendRecordToTonometry(input.tonometryRecord)
    : null;

  const partial = buildClinicalIopFormState({
    tonometryData,
    pachymetryData: input.pachymetryData,
    visualFieldData: input.visualFieldData,
    calculateCorrectedIOP: calc,
  });

  const state: IopMegaFormState = {
    nct: partial.nct ?? { ...EMPTY_TONOMETRY_PHASE },
    atn: partial.atn ?? { ...EMPTY_TONOMETRY_PHASE },
    schirmer: { ...EMPTY_SCHIRMER },
    pachymetry: partial.pachymetry ?? { ...EMPTY_PACHYMETRY },
    visualField: partial.visualField ?? { ...EMPTY_VISUAL_FIELD },
  };

  const snaps: IopSectionSnapshotMap = {};
  const method = tonometryData?.method;

  if (partial.nct && !isAtnTonometryMethod(method)) {
    snaps.nct = extractSectionSnapshot('nct', state);
  }
  if (isAtnTonometryMethod(method) && tonometryData) {
    state.atn = {
      beforeDilatation: {
        OD: {
          value:
            tonometryData.OD?.predilation?.toString() ||
            tonometryData.OD?.measuredIOP?.toString() ||
            '',
          time: '',
        },
        OS: {
          value:
            tonometryData.OS?.predilation?.toString() ||
            tonometryData.OS?.measuredIOP?.toString() ||
            '',
          time: '',
        },
      },
      afterDilatation: {
        OD: { value: tonometryData.OD?.postdilation?.toString() || '', time: '' },
        OS: { value: tonometryData.OS?.postdilation?.toString() || '', time: '' },
      },
    };
    snaps.atn = extractSectionSnapshot('atn', state);
  }
  if (partial.pachymetry?.OD?.cct || partial.pachymetry?.OS?.cct) {
    snaps.pachymetry = extractSectionSnapshot('pachymetry', state);
  }
  if (partial.visualField?.OD?.md || partial.visualField?.OS?.md) {
    snaps['visual-field'] = extractSectionSnapshot('visual-field', state);
  }

  return snaps;
}
