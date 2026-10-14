import { getAuthorizationsByPatient } from '@/lib/api/ccms/ccms-authorizations.api';
import { PATIENT_360_LIST_PAGE_SIZE, patient360PageFields } from '@/lib/patients/patient-360-list-paging';

export type AuthorizationReadState = 'ready' | 'unauthorized' | 'unavailable';

export interface AuthorizationRow {
  id: string;
  authorizationType: string | null;
  preAuthNumber: string | null;
  processStatus: string | null;
  requestedAmount: string | null;
  approvedAmount: string | null;
  submittedAt: string | null;
  receivedAt: string | null;
  validFrom: string | null;
  validTo: string | null;
  tpaReferenceNumber: string | null;
  rejectionReason: string | null;
}

export interface AuthorizationListResult {
  state: AuthorizationReadState;
  rows: AuthorizationRow[];
  totalCount?: number;
  pageNumber?: number;
  pageSize?: number;
}

export function authorizationEmptyMessage(): string {
  return 'No authorizations recorded.';
}

export function authorizationUnavailableMessage(): string {
  return 'Authorization information is unavailable.';
}

export function authorizationUnauthorizedMessage(): string {
  return 'Authorization information is not available to this sign-in.';
}

export function classifyAuthorizationError(error: unknown): Exclude<AuthorizationReadState, 'ready'> {
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

function unwrapAuthorizations(payload: unknown): unknown[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const authorizations = (payload as { authorizations?: unknown }).authorizations;
  return Array.isArray(authorizations) ? authorizations : null;
}

export function mapAuthorization(raw: Record<string, unknown>): AuthorizationRow | null {
  const id = text(raw.id);
  if (!id) return null;
  return {
    id,
    authorizationType: text(raw.authorizationType),
    preAuthNumber: text(raw.preAuthNumber),
    processStatus: text(raw.processStatus),
    requestedAmount: money(raw.requestedAmount),
    approvedAmount: money(raw.approvedAmount),
    submittedAt: displayDate(raw.submittedAt),
    receivedAt: displayDate(raw.receivedAt),
    validFrom: displayDate(raw.validFrom),
    validTo: displayDate(raw.validTo),
    tpaReferenceNumber: text(raw.tpaReferenceNumber),
    rejectionReason: text(raw.rejectionReason),
  };
}

export async function loadPatient360Authorizations(
  patientId: string,
  pageNumber = 1,
): Promise<AuthorizationListResult> {
  try {
    const response = await getAuthorizationsByPatient(patientId, pageNumber, PATIENT_360_LIST_PAGE_SIZE);
    const list = unwrapAuthorizations(response);
    if (!list) return { state: 'unavailable', rows: [] };
    return {
      state: 'ready',
      rows: list
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map(mapAuthorization)
        .filter((row): row is AuthorizationRow => row != null),
      ...patient360PageFields(response, pageNumber),
    };
  } catch (error) {
    return { state: classifyAuthorizationError(error), rows: [] };
  }
}
