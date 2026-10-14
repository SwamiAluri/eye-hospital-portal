import { getApi } from '@/lib/api';
import { PATIENT_360_LIST_PAGE_SIZE, patient360PageFields } from '@/lib/patients/patient-360-list-paging';

export type ImagingFileReadState = 'ready' | 'unauthorized' | 'unavailable';

export interface ImagingFileRow {
  id: string;
  fileName: string;
  modality: string | null;
  fileSize: string | null;
  contentType: string | null;
  uploadedAt: string | null;
}

export interface ImagingFileListResult {
  state: ImagingFileReadState;
  rows: ImagingFileRow[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

export function imagingFilesEmptyMessage(): string {
  return 'No imaging files recorded.';
}

export function imagingFilesUnauthorizedMessage(): string {
  return 'Imaging files are not available to this sign-in.';
}

export function imagingFilesUnavailableMessage(): string {
  return 'Imaging files are not available in Patient 360.';
}

export function classifyImagingFileError(error: unknown): Exclude<ImagingFileReadState, 'ready'> {
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

function fileSize(value: unknown): string | null {
  const amount = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(amount)) return null;
  return `${amount} bytes`;
}

export function mapImagingFile(raw: Record<string, unknown>): ImagingFileRow | null {
  const id = text(raw.id);
  const fileName = text(raw.fileName);
  if (!id || !fileName) return null;
  return {
    id,
    fileName,
    modality: text(raw.modality),
    fileSize: fileSize(raw.fileSize),
    contentType: text(raw.contentType),
    uploadedAt: displayWhen(raw.uploadedAt),
  };
}

function unwrapItems(payload: unknown): unknown[] | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const items = (payload as { items?: unknown }).items;
  return Array.isArray(items) ? items : null;
}

export async function loadPatient360ImagingFiles(
  patientId: string,
  pageNumber = 1,
): Promise<ImagingFileListResult> {
  try {
    const response = await getApi().get(`/Imaging/patient/${patientId}/patient-360/images`, {
      params: { pageNumber, pageSize: PATIENT_360_LIST_PAGE_SIZE },
    });
    const list = unwrapItems(response.data);
    if (!list) return { state: 'unavailable', rows: [], totalCount: 0, pageNumber, pageSize: PATIENT_360_LIST_PAGE_SIZE };
    return {
      state: 'ready',
      rows: list
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map(mapImagingFile)
        .filter((row): row is ImagingFileRow => row != null),
      ...patient360PageFields(response.data, pageNumber),
    };
  } catch (error) {
    return {
      state: classifyImagingFileError(error),
      rows: [],
      totalCount: 0,
      pageNumber,
      pageSize: PATIENT_360_LIST_PAGE_SIZE,
    };
  }
}
