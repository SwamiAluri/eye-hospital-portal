import { getApi } from '@/lib/api';

export interface CanonicalDocumentMetadata {
  id: string;
  patientId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  classification: string;
  status: string;
  createdAt: string;
  createdByUserId: string;
  supersededByDocumentId?: string | null;
}

export interface CanonicalDocumentListResponse {
  documents: CanonicalDocumentMetadata[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

export interface CanonicalDocumentDuplicateCandidate {
  id: string;
  fileName: string;
  classification: string;
  status: string;
  createdAt: string;
  contentHashMatch: boolean;
}

export interface CanonicalDocumentUploadOptions {
  classification?: string;
  duplicateResolution?: 'keepBoth' | 'replace';
  replaceDocumentId?: string;
}

export class CanonicalDocumentDuplicateError extends Error {
  candidate: CanonicalDocumentDuplicateCandidate;

  constructor(candidate: CanonicalDocumentDuplicateCandidate, message: string) {
    super(message);
    this.name = 'CanonicalDocumentDuplicateError';
    this.candidate = candidate;
  }
}

function duplicateFromError(error: unknown): CanonicalDocumentDuplicateError | null {
  const payload = (error as { response?: { status?: number; data?: Record<string, unknown> } } | null)?.response;
  if (payload?.status !== 409 || payload.data?.code !== 'duplicate_document') return null;
  const candidate = payload.data.candidate;
  if (!candidate || typeof candidate !== 'object') return null;
  const row = candidate as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : null;
  if (!id) return null;
  return new CanonicalDocumentDuplicateError(
    {
      id,
      fileName: typeof row.fileName === 'string' ? row.fileName : 'document',
      classification: typeof row.classification === 'string' ? row.classification : 'general',
      status: typeof row.status === 'string' ? row.status : 'active',
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : '',
      contentHashMatch: row.contentHashMatch === true,
    },
    typeof payload.data.message === 'string'
      ? payload.data.message
      : 'A document with the same patient context and document type is already available.',
  );
}

export async function listCanonicalPatientDocuments(
  patientId: string,
  pageNumber = 1,
  pageSize = 20,
): Promise<CanonicalDocumentListResponse> {
  const { data } = await getApi().get<CanonicalDocumentListResponse>(
    `/patients/${patientId}/documents`,
    { params: { pageNumber, pageSize } },
  );
  return data;
}

export async function uploadCanonicalPatientDocument(
  patientId: string,
  file: File,
  options?: CanonicalDocumentUploadOptions,
): Promise<CanonicalDocumentMetadata> {
  const form = new FormData();
  form.append('file', file);
  if (options?.classification) form.append('classification', options.classification);
  if (options?.duplicateResolution) form.append('duplicateResolution', options.duplicateResolution);
  if (options?.replaceDocumentId) form.append('replaceDocumentId', options.replaceDocumentId);
  try {
    const { data } = await getApi().post<CanonicalDocumentMetadata>(
      `/patients/${patientId}/documents`,
      form,
    );
    return data;
  } catch (error) {
    const duplicate = duplicateFromError(error);
    if (duplicate) throw duplicate;
    throw error;
  }
}

export async function downloadCanonicalPatientDocument(
  patientId: string,
  documentId: string,
): Promise<Blob> {
  const { data } = await getApi().get<Blob>(`/patients/${patientId}/documents/${documentId}/content`, {
    responseType: 'blob',
  });
  return data;
}

export async function deleteCanonicalPatientDocument(
  patientId: string,
  documentId: string,
): Promise<void> {
  await getApi().delete(`/patients/${patientId}/documents/${documentId}`);
}
