import { getApi } from '@/lib/api';
import { PATIENT_360_LIST_PAGE_SIZE, patient360PageFields } from '@/lib/patients/patient-360-list-paging';

export type SpecialtyReadState = 'ready' | 'unauthorized' | 'unavailable';

export interface BiometryContextRow {
  id: string;
  when: string | null;
  eye: string | null;
  status: string | null;
  device: string | null;
  deviceModel: string | null;
  measures: { label: string; value: string }[];
}

export interface RetinopathyContextRow {
  id: string;
  when: string | null;
  eye: string | null;
  status: string | null;
  device: string | null;
  deviceModel: string | null;
  drGrade: string | null;
  macularEdema: string | null;
  hemorrhagesCount: string | null;
  microaneurysmsCount: string | null;
  findings: string[];
  referralRequired: string | null;
}

export interface OctContextRow {
  id: string;
  when: string | null;
  eye: string | null;
  scanType: string | null;
  scanPattern: string | null;
  scanSize: string | null;
  device: string | null;
  deviceModel: string | null;
  status: string | null;
}

export interface SpecialtyListResult<T> {
  state: SpecialtyReadState;
  rows: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
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
  return text(value);
}

function yesNo(value: unknown): string | null {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return null;
}

export function biometryEmptyMessage(): string {
  return 'No biometry records found.';
}

export function biometryUnauthorizedMessage(): string {
  return 'Biometry records are not available to this sign-in.';
}

export function biometryUnavailableMessage(): string {
  return 'Biometry records are not available in Patient 360.';
}

export function retinopathyEmptyMessage(): string {
  return 'No retinopathy screening records found.';
}

export function retinopathyUnauthorizedMessage(): string {
  return 'Retinopathy screening records are not available to this sign-in.';
}

export function retinopathyUnavailableMessage(): string {
  return 'Retinopathy screening records are not available in Patient 360.';
}

export function octEmptyMessage(): string {
  return 'No OCT scans recorded.';
}

export function octUnauthorizedMessage(): string {
  return 'OCT scans are not available to this sign-in.';
}

export function octUnavailableMessage(): string {
  return 'OCT scans are not available in Patient 360.';
}

export function classifySpecialtyError(error: unknown): Exclude<SpecialtyReadState, 'ready'> {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === 401 || status === 403) return 'unauthorized';
  return 'unavailable';
}

function measure(label: string, value: unknown): { label: string; value: string } | null {
  const textValue = numberText(value);
  if (!textValue) return null;
  return { label, value: textValue };
}

export function mapBiometryContext(raw: Record<string, unknown>): BiometryContextRow | null {
  const id = text(raw.id);
  if (!id) return null;
  const measures = [
    measure('Axial length', raw.axialLength),
    measure('K1', raw.k1),
    measure('K2', raw.k2),
    measure('K1 axis', raw.k1Axis),
    measure('ACD', raw.acd),
    measure('Lens thickness', raw.lensThickness),
    measure('White to white', raw.whiteToWhite),
    measure('SNR', raw.snr),
    measure('Target refraction', raw.targetRefraction),
    measure('Calculated IOL', raw.calculatedIol),
    measure('Selected formula', raw.selectedFormula),
  ].filter((row): row is { label: string; value: string } => row != null);
  return {
    id,
    when: displayWhen(raw.examinationDate),
    eye: text(raw.eye),
    status: text(raw.status),
    device: text(raw.device),
    deviceModel: text(raw.deviceModel),
    measures,
  };
}

const FINDING_FLAGS: { key: string; label: string }[] = [
  { key: 'hardExudates', label: 'Hard exudates' },
  { key: 'softExudates', label: 'Soft exudates' },
  { key: 'neovascularization', label: 'Neovascularization' },
  { key: 'venousBeading', label: 'Venous beading' },
  { key: 'irma', label: 'IRMA' },
];

export function mapRetinopathyContext(raw: Record<string, unknown>): RetinopathyContextRow | null {
  const id = text(raw.id);
  if (!id) return null;
  return {
    id,
    when: displayWhen(raw.screeningDate),
    eye: text(raw.eye),
    status: text(raw.status),
    device: text(raw.device),
    deviceModel: text(raw.deviceModel),
    drGrade: text(raw.drGrade),
    macularEdema: text(raw.macularEdema),
    hemorrhagesCount: numberText(raw.hemorrhagesCount),
    microaneurysmsCount: numberText(raw.microaneurysmsCount),
    findings: FINDING_FLAGS.filter((flag) => raw[flag.key] === true).map((flag) => flag.label),
    referralRequired: yesNo(raw.referralRequired),
  };
}

export function mapOctContext(raw: Record<string, unknown>): OctContextRow | null {
  const id = text(raw.id);
  if (!id) return null;
  return {
    id,
    when: displayWhen(raw.scanDate),
    eye: text(raw.eye),
    scanType: text(raw.scanType),
    scanPattern: text(raw.scanPattern),
    scanSize: text(raw.scanSize),
    device: text(raw.device),
    deviceModel: text(raw.deviceModel),
    status: text(raw.status),
  };
}

function itemsOf(payload: unknown): unknown[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const items = (payload as { items?: unknown }).items;
  return Array.isArray(items) ? items : null;
}

async function readPage<T>(
  path: string,
  pageNumber: number,
  map: (raw: Record<string, unknown>) => T | null,
): Promise<SpecialtyListResult<T>> {
  try {
    const response = await getApi().get(path, {
      params: { pageNumber, pageSize: PATIENT_360_LIST_PAGE_SIZE },
    });
    const list = itemsOf(response.data);
    if (!list) return { state: 'unavailable', rows: [], totalCount: 0, pageNumber, pageSize: PATIENT_360_LIST_PAGE_SIZE };
    return {
      state: 'ready',
      rows: list
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map(map)
        .filter((row): row is T => row != null),
      ...patient360PageFields(response.data, pageNumber),
    };
  } catch (error) {
    return {
      state: classifySpecialtyError(error),
      rows: [],
      totalCount: 0,
      pageNumber,
      pageSize: PATIENT_360_LIST_PAGE_SIZE,
    };
  }
}

export function loadPatient360Biometry(patientId: string, pageNumber = 1) {
  return readPage(`/biometry/patients/${patientId}/patient-360`, pageNumber, mapBiometryContext);
}

export function loadPatient360Retinopathy(patientId: string, pageNumber = 1) {
  return readPage(`/retinopathyscreening/patients/${patientId}/patient-360`, pageNumber, mapRetinopathyContext);
}

export function loadPatient360Oct(patientId: string, pageNumber = 1) {
  return readPage(`/octimaging/patients/${patientId}/patient-360`, pageNumber, mapOctContext);
}
