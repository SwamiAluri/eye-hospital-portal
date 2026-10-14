import { getCounselingDocumentsByPatient } from '@/lib/api/counseling-sessions.api';
import { PATIENT_360_LIST_PAGE_SIZE, patient360PageFields } from '@/lib/patients/patient-360-list-paging';

export type CounsellingDocumentReadState = 'ready' | 'unauthorized' | 'unavailable';

export interface CounsellingDocumentRow {
  id: string;
  sessionId: string | null;
  documentName: string | null;
  documentType: string | null;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  fileType: string | null;
  fileSizeBytes: string | null;
  /** Present when counselling upload created a canonical association. */
  canonicalDocumentId: string | null;
  createdByUserId: string | null;
}

export interface CounsellingDocumentListResult {
  state: CounsellingDocumentReadState;
  rows: CounsellingDocumentRow[];
  totalCount?: number;
  pageNumber?: number;
  pageSize?: number;
}

export function counsellingDocumentEmptyMessage(): string {
  return 'No counselling documents recorded.';
}

export function counsellingDocumentUnavailableMessage(): string {
  return 'Counselling document information is unavailable.';
}

export function counsellingDocumentUnauthorizedMessage(): string {
  return 'Counselling document information is not available to this sign-in.';
}

export function classifyCounsellingDocumentError(error: unknown): Exclude<CounsellingDocumentReadState, 'ready'> {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === 401 || status === 403) return 'unauthorized';
  return 'unavailable';
}

/** Derive preview MIME from counselling fileType when content is available. */
export function counsellingDocumentMimeType(fileType: string | null | undefined): string | null {
  const value = (fileType ?? '').trim().toLowerCase();
  if (!value) return null;
  if (value === 'pdf') return 'application/pdf';
  if (value === 'jpg' || value === 'jpeg') return 'image/jpeg';
  if (value === 'png') return 'image/png';
  return null;
}

/** Patient 360 must never surface conversation AudioRecording rows. */
export function isPatient360ExcludedCounsellingDocumentType(documentType: string | null | undefined): boolean {
  return (documentType ?? '').trim().toLowerCase() === 'audiorecording';
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

export function mapCounsellingDocument(raw: Record<string, unknown>): CounsellingDocumentRow | null {
  const id = text(raw.id);
  if (!id) return null;
  const documentType = text(raw.documentType);
  if (isPatient360ExcludedCounsellingDocumentType(documentType)) return null;
  return {
    id,
    sessionId: text(raw.sessionId),
    documentName: text(raw.documentName),
    documentType,
    status: text(raw.status),
    createdAt: displayTimestamp(raw.createdAt),
    updatedAt: displayTimestamp(raw.updatedAt),
    fileType: text(raw.fileType),
    fileSizeBytes: fileSize(raw.fileSizeBytes),
    canonicalDocumentId: text(raw.canonicalDocumentId),
    createdByUserId: text(raw.createdByUserId),
  };
}

export async function loadPatient360CounsellingDocuments(
  patientId: string,
  pageNumber = 1,
): Promise<CounsellingDocumentListResult> {
  try {
    const response = await getCounselingDocumentsByPatient(patientId, pageNumber, PATIENT_360_LIST_PAGE_SIZE);
    const list = unwrapDocuments(response);
    if (!list) return { state: 'unavailable', rows: [] };
    return {
      state: 'ready',
      rows: list
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map(mapCounsellingDocument)
        .filter((row): row is CounsellingDocumentRow => row != null),
      ...patient360PageFields(response, pageNumber),
    };
  } catch (error) {
    return { state: classifyCounsellingDocumentError(error), rows: [] };
  }
}
