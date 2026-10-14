import { getDocumentsByPatient } from '@/lib/api/ccms/ccms-documents.api';
import { PATIENT_360_LIST_PAGE_SIZE, patient360PageFields } from '@/lib/patients/patient-360-list-paging';

export type DocumentReadState = 'ready' | 'unauthorized' | 'unavailable';

export interface DocumentRow {
  id: string;
  coverageCaseId: string | null;
  documentName: string | null;
  documentType: string | null;
  documentCategory: string | null;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  uploadedAt: string | null;
  mimeType: string | null;
  fileSizeBytes: string | null;
  /** Auth canonical identity when registered (Slice 3B). */
  canonicalDocumentId: string | null;
  /** Pointer docs (pacs/biometry) — no file content actions. */
  isPointer: boolean;
}

export interface DocumentListResult {
  state: DocumentReadState;
  rows: DocumentRow[];
  totalCount?: number;
  pageNumber?: number;
  pageSize?: number;
}

export function documentEmptyMessage(): string {
  return 'No CCMS documents recorded.';
}

export function documentUnavailableMessage(): string {
  return 'Document information is unavailable.';
}

export function documentUnauthorizedMessage(): string {
  return 'Document information is not available to this sign-in.';
}

export function mpiDocumentsUnavailableMessage(): string {
  return 'MPI documents are not available in Patient 360.';
}

/** @deprecated Slice 3B closes the Insurance source gap — prefer insuranceDocumentEmptyMessage. */
export function insuranceDocumentsUnavailableMessage(): string {
  return 'No insurance documents recorded.';
}

export function classifyDocumentError(error: unknown): Exclude<DocumentReadState, 'ready'> {
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

export function mapDocument(raw: Record<string, unknown>): DocumentRow | null {
  const id = text(raw.id);
  if (!id) return null;
  const type = text(raw.documentType);
  const isPointerFlag = raw.isPointer === true;
  const pointerByType =
    type === 'biometry_record' || type === 'dicom_study';
  return {
    id,
    coverageCaseId: text(raw.coverageCaseId),
    documentName: text(raw.documentName),
    documentType: type,
    documentCategory: text(raw.documentCategory),
    status: text(raw.status),
    createdAt: displayTimestamp(raw.createdAt),
    updatedAt: displayTimestamp(raw.updatedAt),
    uploadedAt: displayTimestamp(raw.uploadedAt),
    mimeType: text(raw.mimeType),
    fileSizeBytes: fileSize(raw.fileSizeBytes),
    canonicalDocumentId: text(raw.canonicalDocumentId),
    isPointer: isPointerFlag || pointerByType,
  };
}

export async function loadPatient360Documents(
  patientId: string,
  pageNumber = 1,
): Promise<DocumentListResult> {
  try {
    const response = await getDocumentsByPatient(patientId, pageNumber, PATIENT_360_LIST_PAGE_SIZE);
    const list = unwrapDocuments(response);
    if (!list) return { state: 'unavailable', rows: [] };
    return {
      state: 'ready',
      rows: list
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map(mapDocument)
        .filter((row): row is DocumentRow => row != null),
      ...patient360PageFields(response, pageNumber),
    };
  } catch (error) {
    return { state: classifyDocumentError(error), rows: [] };
  }
}
