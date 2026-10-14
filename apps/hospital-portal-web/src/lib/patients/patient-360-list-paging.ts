export const PATIENT_360_LIST_PAGE_SIZE = 20;

export function patient360PageFields(payload: unknown, requestedPage: number): {
  totalCount: number;
  pageNumber: number;
  pageSize: number;
} {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const numberOr = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return {
    totalCount: numberOr(record.totalCount, 0),
    pageNumber: numberOr(record.pageNumber, requestedPage),
    pageSize: numberOr(record.pageSize, PATIENT_360_LIST_PAGE_SIZE),
  };
}
