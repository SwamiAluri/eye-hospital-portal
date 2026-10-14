import { getCoverageCasesByPatient } from '@/lib/api/ccms/ccms-coverage-cases.api';
import { PATIENT_360_LIST_PAGE_SIZE, patient360PageFields } from '@/lib/patients/patient-360-list-paging';

export type CoverageCaseReadState = 'ready' | 'unauthorized' | 'unavailable';

export interface CoverageCaseRow {
  id: string;
  caseNumber: string | null;
  currentState: string | null;
  payerType: string | null;
  insurerName: string | null;
  paymentType: string | null;
  preAuthNumber: string | null;
  approvedAmount: string | null;
}

export interface CoverageCaseListResult {
  state: CoverageCaseReadState;
  rows: CoverageCaseRow[];
  totalCount?: number;
  pageNumber?: number;
  pageSize?: number;
}

export function coverageCaseEmptyMessage(): string {
  return 'No coverage cases recorded.';
}

export function coverageCaseUnavailableMessage(): string {
  return 'Coverage information is unavailable.';
}

export function coverageCaseUnauthorizedMessage(): string {
  return 'Coverage information is not available to this sign-in.';
}

export function classifyCoverageCaseError(error: unknown): Exclude<CoverageCaseReadState, 'ready'> {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === 401 || status === 403) return 'unauthorized';
  return 'unavailable';
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function money(value: unknown): string | null {
  const amount = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(amount)) return null;
  return `₹${amount.toFixed(2)}`;
}

function unwrapCases(payload: unknown): unknown[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const cases = (payload as { cases?: unknown }).cases;
  return Array.isArray(cases) ? cases : null;
}

export function mapCoverageCase(raw: Record<string, unknown>): CoverageCaseRow | null {
  const id = text(raw.id);
  if (!id) return null;
  return {
    id,
    caseNumber: text(raw.caseNumber),
    currentState: text(raw.currentState),
    payerType: text(raw.payerType),
    insurerName: text(raw.insurerName),
    paymentType: text(raw.paymentType),
    preAuthNumber: text(raw.preAuthNumber),
    approvedAmount: money(raw.approvedAmount),
  };
}

export async function loadPatient360CoverageCases(
  patientId: string,
  pageNumber = 1,
): Promise<CoverageCaseListResult> {
  try {
    const response = await getCoverageCasesByPatient(patientId, pageNumber, PATIENT_360_LIST_PAGE_SIZE);
    const list = unwrapCases(response);
    if (!list) return { state: 'unavailable', rows: [] };
    return {
      state: 'ready',
      rows: list
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map(mapCoverageCase)
        .filter((row): row is CoverageCaseRow => row != null),
      ...patient360PageFields(response, pageNumber),
    };
  } catch (error) {
    return { state: classifyCoverageCaseError(error), rows: [] };
  }
}
