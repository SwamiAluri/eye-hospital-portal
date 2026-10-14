import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCounselingDocumentsByPatient = vi.fn();

vi.mock('@/lib/api/counseling-sessions.api', () => ({
  getCounselingDocumentsByPatient: (...args: unknown[]) => getCounselingDocumentsByPatient(...args),
}));

import {
  classifyCounsellingDocumentError,
  counsellingDocumentEmptyMessage,
  counsellingDocumentUnauthorizedMessage,
  counsellingDocumentUnavailableMessage,
  loadPatient360CounsellingDocuments,
  mapCounsellingDocument,
} from '@/lib/patients/patient-360-counselling-documents';

const patientId = '741a1b98-874b-45d5-a3f6-d2d7a4ef9899';

describe('patient 360 counselling document read', () => {
  beforeEach(() => {
    getCounselingDocumentsByPatient.mockReset();
  });

  it('maps stored metadata and drops the file path', () => {
    const row = mapCounsellingDocument({
      id: 'd1',
      sessionId: 'session-1',
      documentName: 'referral.pdf',
      documentType: 'ReferralLetter',
      status: 'active',
      createdAt: '2026-09-03T10:00:00Z',
      updatedAt: '2026-09-04T10:00:00Z',
      fileType: 'pdf',
      fileSizeBytes: 1024,
      canonicalDocumentId: 'c1',
      createdByUserId: 'user-1',
      filePath: 'https://files.example/referral.pdf',
    });
    expect(row).toEqual({
      id: 'd1',
      sessionId: 'session-1',
      documentName: 'referral.pdf',
      documentType: 'ReferralLetter',
      status: 'active',
      createdAt: '2026-09-03T10:00:00Z',
      updatedAt: '2026-09-04T10:00:00Z',
      fileType: 'pdf',
      fileSizeBytes: '1024 bytes',
      canonicalDocumentId: 'c1',
      createdByUserId: 'user-1',
    });
    expect(row).not.toHaveProperty('filePath');
  });

  it('maps canonicalDocumentId when present and leaves it null when absent', () => {
    expect(
      mapCounsellingDocument({
        id: 'd1',
        documentName: 'a.pdf',
        status: 'active',
        canonicalDocumentId: 'can-1',
      })?.canonicalDocumentId,
    ).toBe('can-1');
    expect(
      mapCounsellingDocument({
        id: 'd2',
        documentName: 'b.pdf',
        status: 'active',
      })?.canonicalDocumentId,
    ).toBeNull();
  });

  it('excludes AudioRecording from Patient 360 mapping', () => {
    expect(
      mapCounsellingDocument({
        id: 'audio-1',
        documentName: 'recording.webm',
        documentType: 'AudioRecording',
        status: 'active',
      }),
    ).toBeNull();
    expect(
      mapCounsellingDocument({
        id: 'd1',
        documentName: 'referral.pdf',
        documentType: 'ReferralLetter',
        status: 'active',
      }),
    ).not.toBeNull();
  });

  it('maps patient-level counselling rows with null sessionId', () => {
    const row = mapCounsellingDocument({
      id: 'canonical-1',
      sessionId: null,
      documentName: 'id-proof.pdf',
      documentType: 'IDProof',
      status: 'active',
      canonicalDocumentId: 'canonical-1',
    });
    expect(row?.sessionId).toBeNull();
    expect(row?.canonicalDocumentId).toBe('canonical-1');
  });

  it('keeps multiple documents in the returned order', () => {
    const rows = [
      mapCounsellingDocument({ id: 'd2', documentName: 'second.pdf', status: 'active' }),
      mapCounsellingDocument({ id: 'd1', documentName: 'first.pdf', status: 'active' }),
    ];
    expect(rows.map((row) => row?.documentName)).toEqual(['second.pdf', 'first.pdf']);
  });

  it('loads one patient read and treats an empty array as no counselling documents', async () => {
    getCounselingDocumentsByPatient.mockResolvedValue({ documents: [], totalCount: 0, pageNumber: 1, pageSize: 20 });
    const result = await loadPatient360CounsellingDocuments(patientId);
    expect(getCounselingDocumentsByPatient).toHaveBeenCalledTimes(1);
    expect(getCounselingDocumentsByPatient).toHaveBeenCalledWith(patientId, 1, 20);
    expect(result).toEqual({ state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: 20 });
    expect(counsellingDocumentEmptyMessage()).toBe('No counselling documents recorded.');
  });

  it('requests the next counselling document page and keeps metadata only', async () => {
    getCounselingDocumentsByPatient.mockResolvedValue({
      documents: [{ id: 'd2', documentName: 'second.pdf', status: 'active', fileSizeBytes: 10 }],
      totalCount: 21,
      pageNumber: 2,
      pageSize: 20,
    });
    const result = await loadPatient360CounsellingDocuments(patientId, 2);
    expect(getCounselingDocumentsByPatient).toHaveBeenCalledWith(patientId, 2, 20);
    expect(result.rows.map((row) => row.documentName)).toEqual(['second.pdf']);
    expect(result.totalCount).toBe(21);
    expect(result.pageNumber).toBe(2);
    expect(result.rows[0]).not.toHaveProperty('filePath');
  });

  it('does not treat a missing list or an HTTP failure as empty history', async () => {
    getCounselingDocumentsByPatient.mockResolvedValueOnce({ totalCount: 0 });
    await expect(loadPatient360CounsellingDocuments(patientId)).resolves.toEqual({
      state: 'unavailable',
      rows: [],
    });
    expect(classifyCounsellingDocumentError({ response: { status: 401 } })).toBe('unauthorized');
    expect(classifyCounsellingDocumentError({ response: { status: 403 } })).toBe('unauthorized');
    expect(classifyCounsellingDocumentError({ response: { status: 500 } })).toBe('unavailable');
    expect(counsellingDocumentUnauthorizedMessage()).not.toMatch(/No counselling documents/i);
    expect(counsellingDocumentUnavailableMessage()).toBe('Counselling document information is unavailable.');
  });
});
