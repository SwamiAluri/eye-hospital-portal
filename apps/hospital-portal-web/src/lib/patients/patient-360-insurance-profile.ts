import { patientInsuranceApi } from '@/lib/api/patient-insurance.api';

export type InsuranceProfileReadState = 'ready' | 'unauthorized' | 'unavailable';

export interface InsuranceProfileRow {
  id: string;
  providerName: string | null;
  policyNumber: string | null;
  groupNumber: string | null;
  policyType: string | null;
  planName: string | null;
  subscriberName: string | null;
  subscriberId: string | null;
  subscriberRelation: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string | null;
  copayAmount: string | null;
  deductibleAmount: string | null;
  deductibleMet: string | null;
  outOfPocketMax: string | null;
  outOfPocketMet: string | null;
  deletedAt: string | null;
}

export interface InsuranceProfileListResult {
  state: InsuranceProfileReadState;
  rows: InsuranceProfileRow[];
}

export function insuranceProfileEmptyMessage(): string {
  return 'No insurance profile recorded.';
}

export function insuranceProfileUnavailableMessage(): string {
  return 'Insurance profile is not available in Patient 360.';
}

export function insuranceProfileUnauthorizedMessage(): string {
  return 'Insurance profile is not available to this sign-in.';
}

export function classifyInsuranceProfileError(error: unknown): Exclude<InsuranceProfileReadState, 'ready'> {
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
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return value.trim();
  return null;
}

function unwrapList(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  return null;
}

export function mapInsuranceProfile(raw: Record<string, unknown>): InsuranceProfileRow | null {
  const id = text(raw.id);
  if (!id) return null;
  return {
    id,
    providerName: text(raw.providerName),
    policyNumber: text(raw.policyNumber),
    groupNumber: text(raw.groupNumber),
    policyType: text(raw.policyType),
    planName: text(raw.planName),
    subscriberName: text(raw.subscriberName),
    subscriberId: text(raw.subscriberId),
    subscriberRelation: text(raw.subscriberRelation),
    startDate: displayDate(raw.startDate),
    endDate: displayDate(raw.endDate),
    status: text(raw.status),
    copayAmount: money(raw.copayAmount),
    deductibleAmount: money(raw.deductibleAmount),
    deductibleMet: money(raw.deductibleMet),
    outOfPocketMax: money(raw.outOfPocketMax),
    outOfPocketMet: money(raw.outOfPocketMet),
    deletedAt: displayDate(raw.deletedAt),
  };
}

export async function loadPatient360InsuranceProfiles(patientId: string): Promise<InsuranceProfileListResult> {
  try {
    const response = await patientInsuranceApi.getByPatient(patientId);
    const list = unwrapList(response.data);
    if (!list) return { state: 'unavailable', rows: [] };
    return {
      state: 'ready',
      rows: list
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map(mapInsuranceProfile)
        .filter((row): row is InsuranceProfileRow => row != null),
    };
  } catch (error) {
    return { state: classifyInsuranceProfileError(error), rows: [] };
  }
}
