// CCMS – Case Documents API client (upload/list/delete files linked to a coverage case)
import { isAxiosError } from 'axios';
import { resolveBlobMimeType, toTypedBlob, validateRetrievedDocumentBlob } from '@/lib/ccms/case-document-actions';
import { getCcmsApi } from './ccms-base';

export interface CaseDocument {
  id: string;
  caseId: string;
  documentType: string;
  fileName: string;
  url: string;
  /** JWT-backed short-lived SAS for preview/open/download. */
  accessUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedBy?: string;
  uploadedAt: string;
  isActive: boolean;
}

export interface CaseDocumentAccessUrl {
  url: string;
  expiresAt?: string | null;
  isPointer: boolean;
}

/** Raw row from GET /documents or workspace hydration (entity or DTO shape). */
export type RawCaseDocument = Record<string, unknown>;

function readString(raw: RawCaseDocument, ...keys: string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    // System.Text.Json may emit Guid as string; tolerate non-string ids.
    if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  }
  return '';
}

function readId(raw: RawCaseDocument): string {
  for (const key of ['id', 'Id']) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value != null && (typeof value === 'number' || typeof value === 'bigint')) {
      return String(value);
    }
    if (value != null && typeof value === 'object' && 'toString' in value) {
      const s = String(value).trim();
      if (s && s !== '[object Object]') return s;
    }
  }
  return '';
}

function readNumber(raw: RawCaseDocument, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

/**
 * True when a row is worth showing in the checklist after refresh.
 * Less strict than upload validation — missing mime/size must not wipe the list.
 */
export function isDisplayableCaseDocument(doc: CaseDocument | null | undefined): boolean {
  if (!doc?.id?.trim() || !doc.documentType?.trim()) return false;
  if (doc.isActive === false) return false;
  const url = doc.url?.trim() ?? '';
  const access = doc.accessUrl?.trim() ?? '';
  if (!url && !access) return false;
  if (url.startsWith('biometry://') || url.startsWith('pacs://')) return true;
  return url.startsWith('http') || access.startsWith('http');
}

/** Normalize API/workspace document payloads to canonical CaseDocument. */
export function mapCaseDocumentFromApi(raw: RawCaseDocument): CaseDocument | null {
  const id = readId(raw);
  const documentType = readString(raw, 'documentType', 'DocumentType');
  if (!id || !documentType) return null;

  const caseId = readString(raw, 'caseId', 'coverageCase_Id', 'coverageCaseId');
  const url = readString(raw, 'url', 'blobUrl', 'BlobUrl');
  const accessUrl = readString(raw, 'accessUrl', 'AccessUrl') || undefined;
  const fileName = readString(raw, 'fileName', 'documentName', 'DocumentName');
  const mimeType = readString(raw, 'mimeType', 'MimeType') || undefined;
  const sizeBytes = readNumber(raw, 'sizeBytes', 'fileSizeBytes', 'FileSizeBytes');
  const uploadedAt =
    readString(raw, 'uploadedAt', 'UploadedAt') || new Date(0).toISOString();

  const deletedAt = raw.deletedAt ?? raw.DeletedAt;
  const status = typeof raw.status === 'string'
    ? raw.status
    : typeof raw.Status === 'string'
      ? raw.Status
      : undefined;
  const isActive =
    raw.isActive !== undefined
      ? Boolean(raw.isActive)
      : raw.IsActive !== undefined
        ? Boolean(raw.IsActive)
        : deletedAt == null && status !== 'deleted';

  const doc: CaseDocument = {
    id,
    caseId,
    documentType,
    fileName,
    url,
    accessUrl,
    mimeType,
    sizeBytes,
    uploadedAt,
    isActive,
  };

  // List hydration: keep displayable rows. Upload POST still uses isCompleteCaseDocument.
  return isDisplayableCaseDocument(doc) ? doc : null;
}

export function mapCaseDocumentsFromApi(rows: unknown[]): CaseDocument[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => mapCaseDocumentFromApi((row ?? {}) as RawCaseDocument))
    .filter((doc): doc is CaseDocument => doc != null);
}

export function formatCcmsDocumentError(
  error: unknown,
  fallback: string,
): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { error?: string; detail?: string } | undefined;
    if (typeof data?.error === 'string' && data.error.trim()) {
      const detail = typeof data.detail === 'string' ? data.detail.trim() : '';
      return detail ? `${data.error} (${detail})` : data.error;
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export type CounsellorDocumentType =
  | 'id_proof'
  | 'insurance_card_front'
  | 'insurance_card_back'
  | 'policy_document'
  | 'doctor_referral'
  | 'preauth_form'
  | 'previous_claims'
  | 'other_1'
  | 'other_2';

/** True when the API returned a real uploaded file — not a metadata-only stub row. */
export function isCompleteCaseDocument(doc: CaseDocument | null | undefined): boolean {
  if (!isDisplayableCaseDocument(doc)) return false;
  // Prefer size/mime when present; do not reject list rows solely for missing mime after refresh.
  if (doc!.sizeBytes !== undefined && doc!.sizeBytes <= 0) {
    const url = doc!.url?.trim() ?? '';
    // Pointer docs may omit size; file blobs with explicit zero size are stubs.
    if (!url.startsWith('biometry://') && !url.startsWith('pacs://')) return false;
  }
  return true;
}

export async function fetchCaseDocumentsFromApi(caseId: string): Promise<CaseDocument[]> {
  const { data } = await getCcmsApi().get(`/ccms/coverage-cases/${caseId}/documents`);
  return mapCaseDocumentsFromApi(Array.isArray(data) ? data : []);
}

/** Lists displayable documents — excludes metadata-only stub rows. */
export async function listCaseDocuments(caseId: string): Promise<CaseDocument[]> {
  const list = await fetchCaseDocumentsFromApi(caseId);
  return list.filter(isCompleteCaseDocument);
}

export async function uploadCaseDocument(
  caseId: string,
  file: File,
  documentType: CounsellorDocumentType | string
): Promise<CaseDocument> {
  if (!file || file.size <= 0) {
    throw new Error('Selected file is empty.');
  }
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('documentType', documentType);
  formData.append('stage', 'preauth');
  const { data } = await getCcmsApi().post<CaseDocument>(
    `/ccms/coverage-cases/${caseId}/documents`,
    formData,
  );
  if (!isCompleteCaseDocument(data)) {
    throw new Error('Upload did not persist the file. Please try again.');
  }
  return data;
}

export async function deleteCaseDocument(_caseId: string, docId: string): Promise<void> {
  await getCcmsApi().delete(`/ccms/documents/${docId}`);
}

/** JWT-authenticated short-lived SAS (or pointer URL) for preview/open/download. */
export async function getCaseDocumentAccessUrl(
  caseId: string,
  docId: string,
): Promise<CaseDocumentAccessUrl> {
  const { data } = await getCcmsApi().get<CaseDocumentAccessUrl>(
    `/ccms/documents/${docId}/access-url`,
    { params: { coverageCaseId: caseId } },
  );
  return data;
}

/** JWT-authenticated blob stream for in-app preview (avoids Azurite cross-origin embed issues). */
export async function fetchCaseDocumentBlob(
  caseId: string,
  docId: string,
  hint?: { mimeType?: string | null; fileName?: string | null },
): Promise<Blob> {
  const response = await getCcmsApi().get<Blob>(
    `/ccms/documents/${docId}/content`,
    { params: { coverageCaseId: caseId }, responseType: 'blob' },
  );
  const headerType = typeof response.headers['content-type'] === 'string'
    ? response.headers['content-type']
    : undefined;
  const preferredMime = hint?.mimeType ?? headerType;
  await validateRetrievedDocumentBlob(response.data, {
    mimeType: preferredMime,
    fileName: hint?.fileName,
  });
  const resolvedMime = await resolveBlobMimeType(response.data, preferredMime);
  return toTypedBlob(response.data, resolvedMime);
}

export interface AttachBiometryRecordBody {
  biometryRecordId: string;
  eye?: string | null;
  examinationDate?: string | null;
  calculatedIol?: number | null;
  device?: string | null;
}

export async function attachBiometryRecord(
  caseId: string,
  body: AttachBiometryRecordBody,
): Promise<CaseDocument> {
  const { data } = await getCcmsApi().post(
    `/ccms/coverage-cases/${caseId}/documents/biometry`,
    body,
  );
  return data;
}
