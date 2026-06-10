import { priorRawFromSnapshot } from './prior-segment-raw';
import type {
  FundusExamData,
  PeripheralRetinaExamData,
  PosteriorSegmentExamData,
  VitreousExamData,
} from './posterior-segment-types';

function recordHasValue(obj: Record<string, unknown>): boolean {
  return Object.values(obj).some((v) => {
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && v !== '';
  });
}

export function posteriorTabHasAnyData(
  overview: PosteriorSegmentExamData,
  fundus: FundusExamData,
  vitreous: VitreousExamData,
  peripheralRetina: PeripheralRetinaExamData,
): boolean {
  return (
    recordHasValue(overview as Record<string, unknown>) ||
    recordHasValue(fundus as Record<string, unknown>) ||
    recordHasValue(vitreous as Record<string, unknown>) ||
    recordHasValue(peripheralRetina as Record<string, unknown>)
  );
}

export function formatPosteriorTabLastVisitLine(raw: Record<string, unknown> | undefined): string | null {
  if (!raw) return null;
  const {
    posteriorSegment: posterior,
    fundusExam: fundus,
    vitreousExam: vitreous,
    peripheralRetinaExam: peripheral,
  } = priorRawFromSnapshot(raw);
  const parts: string[] = [];
  if (posterior?.isDilatedOD || posterior?.isDilatedOS) {
    parts.push('Dilated');
  } else if (posterior?.isDilatedOD === false && posterior?.isDilatedOS === false) {
    parts.push('Undilated');
  }
  if (posterior?.mediaClarityOD || posterior?.mediaClarityOS) {
    parts.push(
      `Media OD ${posterior.mediaClarityOD ?? '—'} · OS ${posterior.mediaClarityOS ?? '—'}`,
    );
  }
  const abnormalFundus =
    posterior?.overallFindingOD?.toLowerCase().includes('abnormal') ||
    posterior?.overallFindingOS?.toLowerCase().includes('abnormal');
  if (abnormalFundus) {
    parts.push('Abnormal fundus');
  }
  if (fundus?.cupDiscRatioOD || fundus?.cupDiscRatioOS) {
    parts.push(`C/D OD ${fundus.cupDiscRatioOD ?? '—'} · OS ${fundus.cupDiscRatioOS ?? '—'}`);
  }
  if (vitreous?.clarityOD || vitreous?.clarityOS) {
    parts.push(
      `Vitreous OD ${vitreous.clarityOD ?? '—'} · OS ${vitreous.clarityOS ?? '—'}`,
    );
  }
  if (peripheral?.peripheralAppearanceOD || peripheral?.peripheralAppearanceOS) {
    parts.push(
      `Periph OD ${peripheral.peripheralAppearanceOD ?? '—'} · OS ${peripheral.peripheralAppearanceOS ?? '—'}`,
    );
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}
