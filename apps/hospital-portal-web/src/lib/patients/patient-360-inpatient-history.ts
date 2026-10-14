import { getApi } from '@/lib/api';
import { PATIENT_360_LIST_PAGE_SIZE, patient360PageFields } from '@/lib/patients/patient-360-list-paging';

export type InpatientHistoryReadState = 'ready' | 'unauthorized' | 'unavailable';

export interface InpatientHistoryRow {
  id: string;
  admittedAt: string | null;
  dischargedAt: string | null;
  clinicalState: string;
}

export interface InpatientHistoryListResult {
  state: InpatientHistoryReadState;
  rows: InpatientHistoryRow[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

export function inpatientHistoryEmptyMessage(): string {
  return 'No inpatient history recorded.';
}

export function inpatientHistoryUnauthorizedMessage(): string {
  return 'Inpatient history is not available to this sign-in.';
}

export function inpatientHistoryUnavailableMessage(): string {
  return 'Inpatient history is not available in Patient 360.';
}

export function classifyInpatientHistoryError(error: unknown): Exclude<InpatientHistoryReadState, 'ready'> {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === 401 || status === 403) return 'unauthorized';
  return 'unavailable';
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function displayWhen(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (match) return `${match[1]} ${match[2]}`;
  return raw;
}

export function mapInpatientHistory(raw: Record<string, unknown>): InpatientHistoryRow | null {
  const id = text(raw.id);
  const clinicalState = text(raw.clinicalState);
  if (!id || !clinicalState) return null;
  return {
    id,
    admittedAt: displayWhen(raw.admittedAt),
    dischargedAt: displayWhen(raw.dischargedAt),
    clinicalState,
  };
}

function itemsOf(payload: unknown): unknown[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const items = (payload as { items?: unknown }).items;
  return Array.isArray(items) ? items : null;
}

export async function loadPatient360InpatientHistory(
  patientId: string,
  pageNumber = 1,
): Promise<InpatientHistoryListResult> {
  try {
    const response = await getApi().get(
      `/patient-journeys/patients/${patientId}/patient-360/inpatient-history`,
      { params: { pageNumber, pageSize: PATIENT_360_LIST_PAGE_SIZE } },
    );
    const list = itemsOf(response.data);
    if (!list) {
      return {
        state: 'unavailable',
        rows: [],
        totalCount: 0,
        pageNumber,
        pageSize: PATIENT_360_LIST_PAGE_SIZE,
      };
    }
    return {
      state: 'ready',
      rows: list
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map(mapInpatientHistory)
        .filter((row): row is InpatientHistoryRow => row != null),
      ...patient360PageFields(response.data, pageNumber),
    };
  } catch (error) {
    return {
      state: classifyInpatientHistoryError(error),
      rows: [],
      totalCount: 0,
      pageNumber,
      pageSize: PATIENT_360_LIST_PAGE_SIZE,
    };
  }
}
