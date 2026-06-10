import type { PriorVisitSnapshot } from './optometry-exam-types';
import type { PosteriorSectionId } from './posterior-segment-section-constants';
import type {
  FundusExamData,
  PeripheralRetinaExamData,
  PosteriorSegmentExamData,
  VitreousExamData,
} from './posterior-segment-types';
import { formatPosteriorTabLastVisitLine } from './posterior-segment-tab-utils';
import { priorRawFromSnapshot } from './prior-segment-raw';

export { formatPosteriorTabLastVisitLine };

export function formatPosteriorTabLastVisitLineFromPrior(
  priorVisit: PriorVisitSnapshot,
): string | null {
  return formatPosteriorTabLastVisitLine(priorVisit.raw as Record<string, unknown> | undefined);
}

export function getPriorPosteriorForSection(
  priorVisit: PriorVisitSnapshot | null | undefined,
  sectionId: PosteriorSectionId,
): {
  overview?: PosteriorSegmentExamData;
  fundus?: FundusExamData;
  vitreous?: VitreousExamData;
  peripheralRetina?: PeripheralRetinaExamData;
} {
  if (!priorVisit) return {};
  const prior = priorRawFromSnapshot(priorVisit.raw as Record<string, unknown> | undefined);
  const all = {
    overview: prior.posteriorSegment,
    fundus: prior.fundusExam,
    vitreous: prior.vitreousExam,
    peripheralRetina: prior.peripheralRetinaExam,
  };
  switch (sectionId) {
    case 'dilation':
    case 'overview':
      return { overview: all.overview };
    case 'disc':
    case 'macula':
    case 'retina':
    case 'vessels':
      return { fundus: all.fundus };
    case 'vitreous':
      return { vitreous: all.vitreous };
    case 'peripheral-retina':
      return { peripheralRetina: all.peripheralRetina };
    default:
      return all;
  }
}

function priorFieldHint<T extends Record<string, unknown>>(
  prior: Partial<T> | undefined,
  field: keyof T,
): string | undefined {
  const v = prior?.[field];
  if (v === undefined || v === null || v === '') return undefined;
  if (Array.isArray(v)) return v.length > 0 ? v.join(', ') : undefined;
  return String(v);
}

export function priorFundusFieldHint(
  prior: Partial<FundusExamData> | undefined,
  field: keyof FundusExamData,
): string | undefined {
  return priorFieldHint(prior, field);
}

export function priorVitreousFieldHint(
  prior: Partial<VitreousExamData> | undefined,
  field: keyof VitreousExamData,
): string | undefined {
  return priorFieldHint(prior, field);
}

export function priorPeriphFieldHint(
  prior: Partial<PeripheralRetinaExamData> | undefined,
  field: keyof PeripheralRetinaExamData,
): string | undefined {
  return priorFieldHint(prior, field);
}
