import { getSettlementsByPatient } from '@/lib/api/ccms/ccms-settlements.api';
import { PATIENT_360_LIST_PAGE_SIZE, patient360PageFields } from '@/lib/patients/patient-360-list-paging';

export type SettlementReadState = 'ready' | 'unauthorized' | 'unavailable';

export interface SettlementRow {
  id: string;
  settlementNumber: string | null;
  settlementType: string | null;
  caseNumber: string | null;
  claimNumber: string | null;
  settledAmount: string | null;
  claimAmount: string | null;
  paymentMode: string | null;
  paymentReference: string | null;
  paymentDate: string | null;
  settledAt: string | null;
  reconciliationStatus: string | null;
  createdAt: string | null;
}

export interface SettlementListResult {
  state: SettlementReadState;
  rows: SettlementRow[];
  totalCount?: number;
  pageNumber?: number;
  pageSize?: number;
}

export function settlementEmptyMessage(): string {
  return 'No settlement records found.';
}

export function settlementUnauthorizedMessage(): string {
  return 'Settlement records are not available to this sign-in.';
}

export function settlementUnavailableMessage(): string {
  return 'Settlement records are not available in Patient 360.';
}

export function classifySettlementError(error: unknown): Exclude<SettlementReadState, 'ready'> {
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

function unwrapSettlements(payload: unknown): unknown[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const settlements = (payload as { settlements?: unknown }).settlements;
  return Array.isArray(settlements) ? settlements : null;
}

export function mapSettlement(raw: Record<string, unknown>): SettlementRow | null {
  const id = text(raw.id);
  if (!id) return null;
  return {
    id,
    settlementNumber: text(raw.settlementNumber),
    settlementType: text(raw.settlementType),
    caseNumber: text(raw.caseNumber),
    claimNumber: text(raw.claimNumber),
    settledAmount: money(raw.settledAmount),
    claimAmount: money(raw.claimAmount),
    paymentMode: text(raw.paymentMode),
    paymentReference: text(raw.paymentReference),
    paymentDate: displayDate(raw.paymentDate),
    settledAt: displayDate(raw.settledAt),
    reconciliationStatus: text(raw.reconciliationStatus),
    createdAt: displayDate(raw.createdAt),
  };
}

export async function loadPatient360Settlements(
  patientId: string,
  pageNumber = 1,
): Promise<SettlementListResult> {
  try {
    const response = await getSettlementsByPatient(patientId, pageNumber, PATIENT_360_LIST_PAGE_SIZE);
    const list = unwrapSettlements(response);
    if (!list) return { state: 'unavailable', rows: [] };
    return {
      state: 'ready',
      rows: list
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map(mapSettlement)
        .filter((row): row is SettlementRow => row != null),
      ...patient360PageFields(response, pageNumber),
    };
  } catch (error) {
    return { state: classifySettlementError(error), rows: [] };
  }
}
