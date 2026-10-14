import { getClaimsByPatient } from '@/lib/api/ccms/ccms-claims.api';
import { PATIENT_360_LIST_PAGE_SIZE, patient360PageFields } from '@/lib/patients/patient-360-list-paging';

export type ClaimReadState = 'ready' | 'unauthorized' | 'unavailable';

export interface ClaimRow {
  id: string;
  claimNumber: string | null;
  claimType: string | null;
  status: string | null;
  queryStatus: string | null;
  submissionMode: string | null;
  claimedAmount: string | null;
  submittedAt: string | null;
  acknowledgedAt: string | null;
  tpaClaimNumber: string | null;
  expectedSettlementDate: string | null;
}

export interface ClaimListResult {
  state: ClaimReadState;
  rows: ClaimRow[];
  totalCount?: number;
  pageNumber?: number;
  pageSize?: number;
}

export function claimEmptyMessage(): string {
  return 'No claims recorded.';
}

export function claimUnavailableMessage(): string {
  return 'Claims information is unavailable.';
}

export function claimUnauthorizedMessage(): string {
  return 'Claims information is not available to this sign-in.';
}

export function classifyClaimError(error: unknown): Exclude<ClaimReadState, 'ready'> {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === 401 || status === 403) return 'unauthorized';
  return 'unavailable';
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function displayDate(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : raw;
}

function money(value: unknown): string | null {
  const amount = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(amount)) return null;
  return `₹${amount.toFixed(2)}`;
}

function unwrapClaims(payload: unknown): unknown[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const claims = (payload as { claims?: unknown }).claims;
  return Array.isArray(claims) ? claims : null;
}

export function mapClaim(raw: Record<string, unknown>): ClaimRow | null {
  const id = text(raw.id);
  if (!id) return null;
  return {
    id,
    claimNumber: text(raw.claimNumber),
    claimType: text(raw.claimType),
    status: text(raw.status),
    queryStatus: text(raw.queryStatus),
    submissionMode: text(raw.submissionMode),
    claimedAmount: money(raw.claimedAmount),
    submittedAt: displayDate(raw.submittedAt),
    acknowledgedAt: displayDate(raw.acknowledgedAt),
    tpaClaimNumber: text(raw.tpaClaimNumber),
    expectedSettlementDate: displayDate(raw.expectedSettlementDate),
  };
}

export async function loadPatient360Claims(
  patientId: string,
  pageNumber = 1,
): Promise<ClaimListResult> {
  try {
    const response = await getClaimsByPatient(patientId, pageNumber, PATIENT_360_LIST_PAGE_SIZE);
    const list = unwrapClaims(response);
    if (!list) return { state: 'unavailable', rows: [] };
    return {
      state: 'ready',
      rows: list
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map(mapClaim)
        .filter((row): row is ClaimRow => row != null),
      ...patient360PageFields(response, pageNumber),
    };
  } catch (error) {
    return { state: classifyClaimError(error), rows: [] };
  }
}
