import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDocumentsByPatient = vi.fn();

vi.mock('@/lib/api/ccms/ccms-documents.api', () => ({
  getDocumentsByPatient: (...args: unknown[]) => getDocumentsByPatient(...args),
}));

import { PATIENT_360_SECTIONS } from '@/lib/patients/patient-360-sections';
import {
  classifyDocumentError,
  documentEmptyMessage,
  documentUnauthorizedMessage,
  documentUnavailableMessage,
  loadPatient360Documents,
  mapDocument,
} from '@/lib/patients/patient-360-documents';

const patientId = '741a1b98-874b-45d5-a3f6-d2d7a4ef9899';

describe('patient 360 documents read', () => {
  beforeEach(() => {
    getDocumentsByPatient.mockReset();
  });

  it('maps stored document metadata and drops storage fields', () => {
    const row = mapDocument({
      id: 'd1',
      coverageCaseId: 'case-1',
      documentName: 'letter.pdf',
      documentType: 'clinical_note',
      documentCategory: 'preauth',
      status: 'active',
      createdAt: '2026-09-01T10:00:00Z',
      updatedAt: '2026-09-02T10:00:00Z',
      uploadedAt: '2026-09-01T10:00:00Z',
      mimeType: 'application/pdf',
      fileSizeBytes: 2048,
      blobUrl: 'https://blob.example/letter.pdf',
      accessUrl: 'https://blob.example/sas',
      url: 'https://blob.example/letter.pdf',
    });
    expect(row).toEqual({
      id: 'd1',
      coverageCaseId: 'case-1',
      documentName: 'letter.pdf',
      documentType: 'clinical_note',
      documentCategory: 'preauth',
      status: 'active',
      createdAt: '2026-09-01T10:00:00Z',
      updatedAt: '2026-09-02T10:00:00Z',
      uploadedAt: '2026-09-01T10:00:00Z',
      mimeType: 'application/pdf',
      fileSizeBytes: '2048 bytes',
      canonicalDocumentId: null,
      isPointer: false,
    });
    expect(row).not.toHaveProperty('blobUrl');
    expect(row).not.toHaveProperty('accessUrl');
  });

  it('keeps multiple documents in the returned order', () => {
    const rows = [
      mapDocument({ id: 'd2', documentName: 'second.pdf', status: 'active' }),
      mapDocument({ id: 'd1', documentName: 'first.pdf', status: 'active' }),
    ];
    expect(rows.map((row) => row?.documentName)).toEqual(['second.pdf', 'first.pdf']);
  });

  it('loads one patient read and treats an empty array as no CCMS documents', async () => {
    getDocumentsByPatient.mockResolvedValue({ documents: [], totalCount: 0, pageNumber: 1, pageSize: 20 });
    const result = await loadPatient360Documents(patientId);
    expect(getDocumentsByPatient).toHaveBeenCalledTimes(1);
    expect(getDocumentsByPatient).toHaveBeenCalledWith(patientId, 1, 20);
    expect(result).toEqual({ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 });
    expect(documentEmptyMessage()).toBe('No CCMS documents recorded.');
  });

  it('requests the next CCMS document page and keeps metadata only', async () => {
    getDocumentsByPatient.mockResolvedValue({
      documents: [{ id: 'd2', documentName: 'second.pdf', status: 'active', fileSizeBytes: 10 }],
      totalCount: 21,
      pageNumber: 2,
      pageSize: 20,
    });
    const result = await loadPatient360Documents(patientId, 2);
    expect(getDocumentsByPatient).toHaveBeenCalledWith(patientId, 2, 20);
    expect(result.rows.map((row) => row.documentName)).toEqual(['second.pdf']);
    expect(result.totalCount).toBe(21);
    expect(result.pageNumber).toBe(2);
    expect(result.rows[0]).not.toHaveProperty('blobUrl');
  });

  it('does not treat a missing list or an HTTP failure as empty history', async () => {
    getDocumentsByPatient.mockResolvedValueOnce({ totalCount: 0 });
    await expect(loadPatient360Documents(patientId)).resolves.toEqual({ state: 'unavailable', rows: [] });

    expect(classifyDocumentError({ response: { status: 401 } })).toBe('unauthorized');
    expect(classifyDocumentError({ response: { status: 403 } })).toBe('unauthorized');
    expect(classifyDocumentError({ response: { status: 404 } })).toBe('unavailable');
    expect(classifyDocumentError({ response: { status: 500 } })).toBe('unavailable');
    expect(documentUnauthorizedMessage()).not.toMatch(/No CCMS documents/i);
    expect(documentUnavailableMessage()).toBe('Document information is unavailable.');
    expect(documentUnavailableMessage()).not.toMatch(/No CCMS documents/i);
  });
});

describe('patient 360 documents source boundary', () => {
  it('uses the patient document read and leaves the section catalog unchanged', () => {
    const root = resolve(__dirname, '../..');
    const reads = readFileSync(resolve(root, 'lib/patients/patient-360-documents.ts'), 'utf8');
    expect(reads).toContain('getDocumentsByPatient');
    expect(reads).not.toMatch(/workspace|access-url|OpenBlob|uploadDocument|deleteDocument/i);
    expect(PATIENT_360_SECTIONS.find((section) => section.key === 'documents')?.label).toBe('Documents');
  });
});
