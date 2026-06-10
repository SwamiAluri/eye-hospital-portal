import type { PriorVisitSnapshot } from './optometry-exam-types';
import type { VaSectionId } from './visual-acuity-constants';

function formatRxEye(
  eye?: { sphere?: string; cylinder?: string; axis?: string; visualAcuity?: string },
): string | null {
  if (!eye?.sphere && !eye?.cylinder && !eye?.axis && !eye?.visualAcuity) return null;
  const parts = [eye.sphere, eye.cylinder, eye.axis].filter(Boolean).join(' / ');
  const va = eye.visualAcuity ? ` · VA ${eye.visualAcuity}` : '';
  return parts ? `${parts}${va}` : eye.visualAcuity ?? null;
}

function formatDate(d?: string): string | undefined {
  if (!d) return undefined;
  try {
    return new Date(d).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return d;
  }
}

function formatEyeVa(
  unaided?: string,
  aided?: string,
): string | null {
  if (!unaided && !aided) return null;
  if (unaided && aided) return `${unaided} unaided · ${aided} aided`;
  return unaided ?? aided ?? null;
}

export interface VaSectionPriorSummary {
  date?: string;
  lines: string[];
  emptyMessage: string;
}

export function getVaSectionPriorSummary(
  sectionId: VaSectionId,
  prior: PriorVisitSnapshot | null | undefined,
): VaSectionPriorSummary {
  const date = prior?.examinationDate ? formatDate(prior.examinationDate) : undefined;
  const raw = prior?.raw as Record<string, unknown> | undefined;

  switch (sectionId) {
    case 'old': {
      const od = prior?.refraction?.startingRxOD ?? prior?.refraction?.finalRxOD;
      const os = prior?.refraction?.startingRxOS ?? prior?.refraction?.finalRxOS;
      const lines: string[] = [];
      if (formatRxEye(od)) lines.push(`OD ${formatRxEye(od)}`);
      if (formatRxEye(os)) lines.push(`OS ${formatRxEye(os)}`);
      return {
        date,
        lines,
        emptyMessage: 'No prior glasses prescription on record.',
      };
    }
    case 'new': {
      const od = prior?.refraction?.finalRxOD;
      const os = prior?.refraction?.finalRxOS;
      const lines: string[] = [];
      if (formatRxEye(od)) lines.push(`Reference OD ${formatRxEye(od)}`);
      if (formatRxEye(os)) lines.push(`Reference OS ${formatRxEye(os)}`);
      return {
        date,
        lines,
        emptyMessage: 'No prior final Rx on record for reference.',
      };
    }
    case 'refraction': {
      const refRaw = raw?.refraction as
        | {
            subjectiveOD?: Record<string, unknown>;
            subjectiveOS?: Record<string, unknown>;
            objectiveOD?: Record<string, unknown>;
            objectiveOS?: Record<string, unknown>;
          }
        | undefined;
      const lines: string[] = [];
      const fmtSubObj = (label: string, eye?: Record<string, unknown>) => {
        if (!eye) return;
        const s = formatSphere(eye.sphere);
        const c = formatSphere(eye.cylinder);
        const a = eye.axis != null ? String(eye.axis) : '';
        if (s || c || a) lines.push(`${label}: ${[s, c, a].filter(Boolean).join(' / ')}`);
      };
      fmtSubObj('Subj OD', refRaw?.subjectiveOD);
      fmtSubObj('Subj OS', refRaw?.subjectiveOS);
      fmtSubObj('Obj OD', refRaw?.objectiveOD);
      fmtSubObj('Obj OS', refRaw?.objectiveOS);
      if (!lines.length) {
        const od = prior?.refraction?.finalRxOD;
        const os = prior?.refraction?.finalRxOS;
        if (formatRxEye(od)) lines.push(`OD ${formatRxEye(od)}`);
        if (formatRxEye(os)) lines.push(`OS ${formatRxEye(os)}`);
      }
      return {
        date,
        lines,
        emptyMessage: 'No prior refraction on record.',
      };
    }
    case 'distance': {
      const va = prior?.visualAcuity;
      const lines: string[] = [];
      const odDist = formatEyeVa(va?.distanceODUnaided, va?.distanceODAided);
      const osDist = formatEyeVa(va?.distanceOSUnaided, va?.distanceOSAided);
      if (odDist) lines.push(`Distance OD ${odDist}`);
      else if (va?.distanceOD) lines.push(`Distance OD ${va.distanceOD}`);
      if (osDist) lines.push(`Distance OS ${osDist}`);
      else if (va?.distanceOS) lines.push(`Distance OS ${va.distanceOS}`);
      const odNear = formatEyeVa(va?.nearODUnaided, va?.nearODAided);
      const osNear = formatEyeVa(va?.nearOSUnaided, va?.nearOSAided);
      if (odNear) lines.push(`Near OD ${odNear}`);
      else if (va?.nearOD) lines.push(`Near OD ${va.nearOD}`);
      if (osNear) lines.push(`Near OS ${osNear}`);
      else if (va?.nearOS) lines.push(`Near OS ${va.nearOS}`);
      return {
        date,
        lines,
        emptyMessage: 'No prior visual acuity on record.',
      };
    }
    case 'keratometry': {
      const k = prior?.keratometry;
      const lines: string[] = [];
      if (k?.od?.k1 || k?.od?.k2) {
        lines.push(`OD K ${k.od.k1 ?? '—'} / ${k.od.k2 ?? '—'} × ${k.od.axis ?? '—'}`);
      }
      if (k?.os?.k1 || k?.os?.k2) {
        lines.push(`OS K ${k.os.k1 ?? '—'} / ${k.os.k2 ?? '—'} × ${k.os.axis ?? '—'}`);
      }
      return {
        date,
        lines,
        emptyMessage: 'No prior keratometry on record.',
      };
    }
    case 'color': {
      const cv = raw?.colorVision as { result?: string; testType?: string } | undefined;
      const lines: string[] = [];
      if (cv?.result) lines.push(`${cv.testType ?? 'Test'}: ${cv.result}`);
      return {
        date,
        lines,
        emptyMessage: 'No prior color vision on record.',
      };
    }
    case 'contrast': {
      const cs = raw?.contrastSensitivity as { od?: string; os?: string } | undefined;
      const lines: string[] = [];
      if (cs?.od || cs?.os) lines.push(`OD ${cs.od ?? '—'} · OS ${cs.os ?? '—'}`);
      return {
        date,
        lines,
        emptyMessage: 'No prior contrast sensitivity on record.',
      };
    }
    default:
      return {
        date,
        lines: [],
        emptyMessage: 'No prior data on record.',
      };
  }
}

function formatSphere(v: unknown): string | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (Number.isNaN(n)) return String(v);
  return n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2);
}
