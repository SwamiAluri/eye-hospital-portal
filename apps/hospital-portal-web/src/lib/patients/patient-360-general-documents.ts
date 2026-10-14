import {
  downloadCanonicalPatientDocument,
  listCanonicalPatientDocuments,
  uploadCanonicalPatientDocument,
} from '@/lib/api/patient-canonical-documents.api';
import { PATIENT_360_LIST_PAGE_SIZE, patient360PageFields } from '@/lib/patients/patient-360-list-paging';

export type GeneralDocumentReadState = 'ready' | 'unauthorized' | 'unavailable';

export interface GeneralDocumentRow {
  id: string;
  fileName: string | null;
  classification: string | null;
  status: string | null;
  createdAt: string | null;
  mimeType: string | null;
  fileSizeBytes: string | null;
  createdByUserId: string | null;
}

export interface GeneralDocumentListResult {
  state: GeneralDocumentReadState;
  rows: GeneralDocumentRow[];
  totalCount?: number;
  pageNumber?: number;
  pageSize?: number;
}

export function generalDocumentEmptyMessage(): string {
  return 'No general patient documents recorded.';
}

export function generalDocumentUnavailableMessage(): string {
  return 'General patient document information is unavailable.';
}

export function generalDocumentUnauthorizedMessage(): string {
  return 'General patient documents are not available to this sign-in.';
}

export function classifyGeneralDocumentError(error: unknown): Exclude<GeneralDocumentReadState, 'ready'> {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === 401 || status === 403) return 'unauthorized';
  return 'unavailable';
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function displayTimestamp(value: unknown): string | null {
  return text(value);
}

function fileSize(value: unknown): string | null {
  const amount = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(amount)) return null;
  return `${amount} bytes`;
}

function unwrapDocuments(payload: unknown): unknown[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const documents = (payload as { documents?: unknown }).documents;
  return Array.isArray(documents) ? documents : null;
}

export function mapGeneralDocument(raw: Record<string, unknown>): GeneralDocumentRow | null {
  const id = text(raw.id);
  if (!id) return null;
  return {
    id,
    fileName: text(raw.fileName),
    classification: text(raw.classification),
    status: text(raw.status),
    createdAt: displayTimestamp(raw.createdAt),
    mimeType: text(raw.mimeType),
    fileSizeBytes: fileSize(raw.sizeBytes),
    createdByUserId: text(raw.createdByUserId),
  };
}

export async function loadPatient360GeneralDocuments(
  patientId: string,
  pageNumber = 1,
): Promise<GeneralDocumentListResult> {
  try {
    const response = await listCanonicalPatientDocuments(patientId, pageNumber, PATIENT_360_LIST_PAGE_SIZE);
    const list = unwrapDocuments(response);
    if (!list) return { state: 'unavailable', rows: [] };
    return {
      state: 'ready',
      rows: list
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map(mapGeneralDocument)
        .filter((row): row is GeneralDocumentRow => row != null),
      ...patient360PageFields(response, pageNumber),
    };
  } catch (error) {
    return { state: classifyGeneralDocumentError(error), rows: [] };
  }
}

export { downloadCanonicalPatientDocument, uploadCanonicalPatientDocument };
