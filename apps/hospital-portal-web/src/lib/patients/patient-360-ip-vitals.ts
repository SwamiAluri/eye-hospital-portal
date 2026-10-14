import { getApi } from '@/lib/api';
import { PATIENT_360_LIST_PAGE_SIZE, patient360PageFields } from '@/lib/patients/patient-360-list-paging';

export const IP_VITALS_UNAVAILABLE = 'IP vitals are not available in Patient 360.';

export type IpVitalsReadState = 'ready' | 'unauthorized' | 'unavailable';

export interface IpVitalMeasure {
  label: string;
  value: string;
}

export interface IpVitalRow {
  id: string;
  recordedAt: string | null;
  context: 'Ward' | 'PreOp';
  measures: IpVitalMeasure[];
}

export interface IpVitalsListResult {
  state: IpVitalsReadState;
  rows: IpVitalRow[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

export function ipVitalsEmptyMessage(): string {
  return 'No IP vitals recorded.';
}

export function ipVitalsUnauthorizedMessage(): string {
  return 'IP vitals are not available to this sign-in.';
}

export function ipVitalsUnavailableMessage(): string {
  return IP_VITALS_UNAVAILABLE;
}

export function classifyIpVitalsError(error: unknown): Exclude<IpVitalsReadState, 'ready'> {
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

function numberText(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

export function mapIpVital(raw: Record<string, unknown>): IpVitalRow | null {
  const id = text(raw.id);
  const context = text(raw.context);
  if (!id || (context !== 'Ward' && context !== 'PreOp')) return null;

  const measures: IpVitalMeasure[] = [];
  const temperature = numberText(raw.temperature);
  if (temperature) measures.push({ label: 'Temperature', value: `${temperature} °C` });

  const systolic = numberText(raw.bloodPressureSystolic);
  const diastolic = numberText(raw.bloodPressureDiastolic);
  if (systolic && diastolic) measures.push({ label: 'Blood pressure', value: `${systolic}/${diastolic}` });
  else if (systolic) measures.push({ label: 'Blood pressure', value: systolic });
  else if (diastolic) measures.push({ label: 'Blood pressure', value: diastolic });

  const pulse = numberText(raw.pulseRate);
  if (pulse) measures.push({ label: 'Pulse rate', value: pulse });

  const respiratory = numberText(raw.respiratoryRate);
  if (respiratory) measures.push({ label: 'Respiratory rate', value: respiratory });

  const oxygen = numberText(raw.oxygenSaturation);
  if (oxygen) measures.push({ label: 'Oxygen saturation', value: `${oxygen}%` });

  const weight = numberText(raw.weight);
  if (weight) measures.push({ label: 'Weight', value: `${weight} kg` });

  const height = numberText(raw.height);
  if (height) measures.push({ label: 'Height', value: `${height} cm` });

  return {
    id,
    recordedAt: displayWhen(raw.recordedAt),
    context,
    measures,
  };
}

function itemsOf(payload: unknown): unknown[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const items = (payload as { items?: unknown }).items;
  return Array.isArray(items) ? items : null;
}

export async function loadPatient360IpVitals(
  patientId: string,
  pageNumber = 1,
): Promise<IpVitalsListResult> {
  try {
    const response = await getApi().get(
      `/patient-journeys/patients/${patientId}/patient-360/ip-vitals`,
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
        .map(mapIpVital)
        .filter((row): row is IpVitalRow => row != null),
      ...patient360PageFields(response.data, pageNumber),
    };
  } catch (error) {
    return {
      state: classifyIpVitalsError(error),
      rows: [],
      totalCount: 0,
      pageNumber,
      pageSize: PATIENT_360_LIST_PAGE_SIZE,
    };
  }
}
