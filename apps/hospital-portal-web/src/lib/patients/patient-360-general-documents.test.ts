import { beforeEach, describe, expect, it, vi } from 'vitest';

const listCanonicalPatientDocuments = vi.fn();

vi.mock('@/lib/api/patient-canonical-documents.api', () => ({
  listCanonicalPatientDocuments: (...args: unknown[]) => listCanonicalPatientDocuments(...args),
  uploadCanonicalPatientDocument: vi.fn(),
  downloadCanonicalPatientDocument: vi.fn(),
}));

import {
  classifyGeneralDocumentError,
  generalDocumentEmptyMessage,
  loadPatient360GeneralDocuments,
  mapGeneralDocument,
} from '@/lib/patients/patient-360-general-documents';

const patientId = '741a1b98-874b-45d5-a3f6-d2d7a4ef9899';

describe('patient 360 general documents', () => {
  beforeEach(() => {
    listCanonicalPatientDocuments.mockReset();
  });

  it('maps metadata and drops storage fields', () => {
    const row = mapGeneralDocument({
      id: 'd1',
      fileName: 'letter.pdf',
      classification: 'general',
      status: 'active',
      createdAt: '2026-10-06T10:00:00Z',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      createdByUserId: 'user-1',
      storageObjectKey: 'secret-key',
      storageContainer: 'patient-documents',
    });
    expect(row).toEqual({
      id: 'd1',
      fileName: 'letter.pdf',
      classification: 'general',
      status: 'active',
      createdAt: '2026-10-06T10:00:00Z',
      mimeType: 'application/pdf',
      fileSizeBytes: '2048 bytes',
      createdByUserId: 'user-1',
    });
    expect(row).not.toHaveProperty('storageObjectKey');
  });

  it('loads one patient page', async () => {
    listCanonicalPatientDocuments.mockResolvedValue({
      documents: [{ id: 'd1', fileName: 'letter.pdf', status: 'active', createdAt: '2026-10-06' }],
      totalCount: 1,
      pageNumber: 1,
      pageSize: 20,
    });
    const result = await loadPatient360GeneralDocuments(patientId);
    expect(listCanonicalPatientDocuments).toHaveBeenCalledWith(patientId, 1, 20);
    expect(result.state).toBe('ready');
    expect(result.rows[0]?.fileName).toBe('letter.pdf');
    expect(generalDocumentEmptyMessage()).toBe('No general patient documents recorded.');
  });

  it('classifies 403 as unauthorized', () => {
    expect(classifyGeneralDocumentError({ response: { status: 403 } })).toBe('unauthorized');
    expect(classifyGeneralDocumentError({ response: { status: 500 } })).toBe('unavailable');
  });
});
