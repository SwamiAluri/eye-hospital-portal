import { priorSnapshotHasClinicalData } from '@/lib/medical-history/medical-history-prior-visit';
import { optometryHistoryApi } from '@/lib/api/optometry-history.api';
import { filterPriorDayVisits } from './optometry-history-filter';
import { mapVisitRecordToPriorSnapshot } from './optometry-history-mappers';
import type { OptometryVisitExamRecord } from './optometry-history.types';
import type { PriorVisitSnapshot } from './optometry-exam-types';
import {
  historyQueryForExamVisit,
  type OptometryHistoryQuery,
} from './optometry-history-query';

export type { OptometryHistoryQuery };
export { historyQueryForExamVisit };

/**
 * Loads patient-scoped optometry examination history (prior-day visits when anchor visitId given).
 */
export async function fetchOptometryPatientHistory(
  patientId: string,
  visitIdOrOptions?: string | OptometryHistoryQuery,
  limit = 10,
): Promise<OptometryVisitExamRecord[]> {
  if (!patientId) return [];

  const options: OptometryHistoryQuery =
    typeof visitIdOrOptions === 'string' || visitIdOrOptions == null
      ? historyQueryForExamVisit(
          typeof visitIdOrOptions === 'string' ? visitIdOrOptions : undefined,
          limit,
        )
      : visitIdOrOptions;

  try {
    const res = await optometryHistoryApi.getHistory(patientId, options);
    let visits = res.visits ?? [];
    const anchorId = options.excludeSameDayAsVisitId ?? options.excludeVisitId;
    if (anchorId || options.anchorExaminationDate) {
      visits = filterPriorDayVisits(visits, anchorId, options.anchorExaminationDate);
    }
    return visits;
  } catch {
    return [];
  }
}

/**
 * Loads the most recent prior examination snapshot (prior calendar day only when visitId given).
 */
export async function fetchPriorVisitSnapshot(
  patientId: string,
  visitId?: string,
): Promise<PriorVisitSnapshot | null> {
  if (!patientId) return null;

  const options = historyQueryForExamVisit(visitId);

  try {
    const res = await optometryHistoryApi.getLatestPrior(patientId, options);
    if (!res.found || !res.visit) return null;
    const snapshot = mapVisitRecordToPriorSnapshot(res.visit);
    if (!priorSnapshotHasClinicalData(snapshot)) {
      return null;
    }
    return snapshot;
  } catch {
    return null;
  }
}

export { mapVisitRecordToPriorSnapshot } from './optometry-history-mappers';
