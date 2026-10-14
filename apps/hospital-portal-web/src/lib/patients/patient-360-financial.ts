import { format } from 'date-fns';
import { opdBillsApi } from '@/lib/api';

export type FinancialReadState = 'ready' | 'unauthorized' | 'unavailable';

export interface FinancialBillRow {
  id: string;
  billNumber: string | null;
  billDate: string | null;
  status: string | null;
  netAmount: string | null;
  amountPaid: string | null;
  balanceDue: string | null;
  isFreeVisit: boolean;
}

export interface FinancialListResult {
  state: FinancialReadState;
  rows: FinancialBillRow[];
}

export function financialEmptyMessage(): string {
  return 'No billing records found.';
}

export function financialUnavailableMessage(): string {
  return 'Financial information is not available in Patient 360.';
}

export function financialUnauthorizedMessage(): string {
  return 'Financial information is not available to this sign-in.';
}

export function classifyFinancialError(error: unknown): Exclude<FinancialReadState, 'ready'> {
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
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  try {
    return format(date, 'dd MMM yyyy');
  } catch {
    return raw;
  }
}

function money(value: unknown): string | null {
  const amount = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(amount)) return null;
  return `₹${amount.toFixed(2)}`;
}

function unwrapBills(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return null;
  const bills = (payload as { bills?: unknown }).bills;
  return Array.isArray(bills) ? bills : null;
}

export function mapFinancialBill(raw: Record<string, unknown>): FinancialBillRow | null {
  const id = text(raw.id);
  if (!id) return null;
  return {
    id,
    billNumber: text(raw.billNumber),
    billDate: displayDate(raw.billDate ?? raw.createdAt),
    status: text(raw.status),
    netAmount: money(raw.netAmount),
    amountPaid: money(raw.amountPaid),
    balanceDue: money(raw.balanceDue),
    isFreeVisit: raw.isFreeVisit === true,
  };
}

export async function loadPatient360Bills(patientId: string): Promise<FinancialListResult> {
  try {
    const response = await opdBillsApi.getByPatient(patientId, 1, 50);
    const list = unwrapBills(response.data);
    if (!list) return { state: 'unavailable', rows: [] };
    return {
      state: 'ready',
      rows: list
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map(mapFinancialBill)
        .filter((row): row is FinancialBillRow => row != null),
    };
  } catch (error) {
    return { state: classifyFinancialError(error), rows: [] };
  }
}
