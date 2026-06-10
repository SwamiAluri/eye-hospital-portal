/** Query options for optometry patient history / latest-prior APIs. */
export interface OptometryHistoryQuery {
  excludeVisitId?: string;
  /** Exclude all visits on the same Asia/Kolkata calendar day as this visit. */
  excludeSameDayAsVisitId?: string;
  /** Anchor visit examination timestamp for client-side same-day defense. */
  anchorExaminationDate?: string;
  limit?: number;
}

/** History query for an in-progress exam visit (Rule A: prior-day only). */
export function historyQueryForExamVisit(
  visitId?: string,
  limit = 10,
  anchorExaminationDate?: string,
): OptometryHistoryQuery {
  if (!visitId) return { limit };
  return {
    excludeVisitId: visitId,
    excludeSameDayAsVisitId: visitId,
    anchorExaminationDate,
    limit,
  };
}
