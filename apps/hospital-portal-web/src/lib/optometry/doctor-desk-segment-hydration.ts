import type { OptometrySegmentExamDto } from '@/lib/api/optometry-segment.api';
import { optometryHistoryApi } from '@/lib/api/optometry-history.api';
import { optometrySegmentApi } from '@/lib/api/optometry-segment.api';
import { OPTOMETRY_SEGMENT_KEYS } from './optometry-segment-keys';
import type { OptometrySegmentBundle } from './optometry-history.types';

export interface DoctorDeskAnteriorBundle {
  pupil: unknown;
  segment: unknown;
}

export interface DoctorDeskPosteriorBundle {
  overview: unknown;
  fundus: unknown;
  vitreous: unknown;
  peripheralRetina: unknown;
}

export interface DoctorDeskSegmentBundles {
  anterior: DoctorDeskAnteriorBundle | null;
  posterior: DoctorDeskPosteriorBundle | null;
  visitId: string | null;
}

function segmentMap(rows: OptometrySegmentExamDto[]): Map<string, unknown> {
  return new Map(rows.map((r) => [r.segmentKey, r.data]));
}

function bundlesFromSegmentMap(map: Map<string, unknown>): Omit<DoctorDeskSegmentBundles, 'visitId'> {
  const pupil = map.get(OPTOMETRY_SEGMENT_KEYS.pupilExam);
  const anterior = map.get(OPTOMETRY_SEGMENT_KEYS.anteriorSegment);
  const overview = map.get(OPTOMETRY_SEGMENT_KEYS.posteriorSegment);
  const fundus = map.get(OPTOMETRY_SEGMENT_KEYS.fundusExam);
  const vitreous = map.get(OPTOMETRY_SEGMENT_KEYS.vitreousExam);
  const peripheral = map.get(OPTOMETRY_SEGMENT_KEYS.peripheralRetinaExam);

  const hasAnterior = pupil != null || anterior != null;
  const hasPosterior =
    overview != null || fundus != null || vitreous != null || peripheral != null;

  return {
    anterior: hasAnterior
      ? {
          pupil: pupil ?? null,
          segment: anterior ?? null,
        }
      : null,
    posterior: hasPosterior
      ? {
          overview: overview ?? null,
          fundus: fundus ?? null,
          vitreous: vitreous ?? null,
          peripheralRetina: peripheral ?? null,
        }
      : null,
  };
}

export function mapDoctorDeskBundlesFromSegmentRows(
  rows: OptometrySegmentExamDto[],
): Omit<DoctorDeskSegmentBundles, 'visitId'> {
  return bundlesFromSegmentMap(segmentMap(rows));
}

export function mapDoctorDeskBundlesFromVisitSegments(
  segments: OptometrySegmentBundle,
): Omit<DoctorDeskSegmentBundles, 'visitId'> {
  const map = new Map<string, unknown>(Object.entries(segments));
  return bundlesFromSegmentMap(map);
}

/** Resolve active visit id for doctor desk (prop → latest history visit). */
export async function resolveDoctorDeskVisitId(
  patientId: string,
  visitId?: string | null,
): Promise<string | null> {
  if (visitId) return visitId;
  try {
    const history = await optometryHistoryApi.getHistory(patientId, { limit: 1 });
    const latest = history.visits?.[0];
    return latest?.visitId ?? null;
  } catch {
    return null;
  }
}

/** Load AS/PS bundles for doctor's desk from visit segment API. */
export async function fetchDoctorDeskSegmentBundles(
  patientId: string,
  visitId?: string | null,
): Promise<DoctorDeskSegmentBundles> {
  const resolvedVisitId = await resolveDoctorDeskVisitId(patientId, visitId);
  if (!resolvedVisitId) {
    return { anterior: null, posterior: null, visitId: null };
  }

  try {
    const rows = await optometrySegmentApi.listByVisit(resolvedVisitId);
    const bundles = mapDoctorDeskBundlesFromSegmentRows(rows);
    return { ...bundles, visitId: resolvedVisitId };
  } catch {
    try {
      const visitExam = await optometryHistoryApi.getVisitExam(resolvedVisitId);
      const bundles = mapDoctorDeskBundlesFromVisitSegments(visitExam.segments ?? {});
      return { ...bundles, visitId: resolvedVisitId };
    } catch {
      return { anterior: null, posterior: null, visitId: resolvedVisitId };
    }
  }
}
