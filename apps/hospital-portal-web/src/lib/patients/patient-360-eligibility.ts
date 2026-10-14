import { getEligibilityChecksByPatient } from '@/lib/api/ccms/ccms-eligibility.api';
import { PATIENT_360_LIST_PAGE_SIZE, patient360PageFields } from '@/lib/patients/patient-360-list-paging';

export type EligibilityReadState = 'ready' | 'unauthorized' | 'unavailable';

export interface EligibilityRow {
  id: string;
  policyNumber: string | null;
  membershipId: string | null;
  checkMethod: string | null;
  responseCode: string | null;
  eligible: string | null;
  checkedAt: string | null;
}

export interface EligibilityListResult {
  state: EligibilityReadState;
  rows: EligibilityRow[];
  totalCount?: number;
  pageNumber?: number;
  pageSize?: number;
}

export function eligibilityEmptyMessage(): string {
  return 'No eligibility records recorded.';
}

export function eligibilityUnavailableMessage(): string {
  return 'Eligibility information is unavailable.';
}

export function eligibilityUnauthorizedMessage(): string {
  return 'Eligibility information is not available to this sign-in.';
}

export function classifyEligibilityError(error: unknown): Exclude<EligibilityReadState, 'ready'> {
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

function eligibleLabel(value: unknown): string | null {
  if (value === true) return 'Eligible';
  if (value === false) return 'Ineligible';
  return null;
}

function unwrapChecks(payload: unknown): unknown[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const checks = (payload as { eligibilityChecks?: unknown }).eligibilityChecks;
  return Array.isArray(checks) ? checks : null;
}

export function mapEligibilityCheck(raw: Record<string, unknown>): EligibilityRow | null {
  const id = text(raw.id);
  if (!id) return null;
  return {
    id,
    policyNumber: text(raw.policyNumber),
    membershipId: text(raw.membershipId),
    checkMethod: text(raw.checkMethod),
    responseCode: text(raw.responseCode),
    eligible: eligibleLabel(raw.isEligible),
    checkedAt: displayDate(raw.checkedAt),
  };
}

export async function loadPatient360Eligibility(
  patientId: string,
  pageNumber = 1,
): Promise<EligibilityListResult> {
  try {
    const response = await getEligibilityChecksByPatient(patientId, pageNumber, PATIENT_360_LIST_PAGE_SIZE);
    const list = unwrapChecks(response);
    if (!list) return { state: 'unavailable', rows: [] };
    return {
      state: 'ready',
      rows: list
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map(mapEligibilityCheck)
        .filter((row): row is EligibilityRow => row != null),
      ...patient360PageFields(response, pageNumber),
    };
  } catch (error) {
    return { state: classifyEligibilityError(error), rows: [] };
  }
}
