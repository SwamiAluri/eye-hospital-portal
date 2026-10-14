import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/ccms/ccms-documents.api', () => ({
  getDocumentsByPatient: vi.fn(),
  ensureCcmsDocumentCanonical: vi.fn(),
  fetchCaseDocumentBlob: vi.fn(),
}));

import {
  ensureCcmsDocumentCanonical,
  fetchCaseDocumentBlob,
  getDocumentsByPatient,
} from '@/lib/api/ccms/ccms-documents.api';
import {
  downloadPatient360CcmsDocument,
  insuranceDocumentEmptyMessage,
  isPatient360InsuranceDocument,
  loadPatient360InsuranceDocuments,
} from '@/lib/patients/patient-360-insurance-documents';

describe('patient-360-insurance-documents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('classifies insurance intake types and excludes pointers', () => {
    expect(
      isPatient360InsuranceDocument({
        documentType: 'policy_document',
        status: 'active',
        isPointer: false,
      }),
    ).toBe(true);
    expect(
      isPatient360InsuranceDocument({
        documentType: 'PolicyDocument',
        status: 'active',
        isPointer: false,
      }),
    ).toBe(false);
    expect(
      isPatient360InsuranceDocument({
        documentType: 'policy_document',
        status: 'active',
        isPointer: true,
      }),
    ).toBe(false);
    expect(
      isPatient360InsuranceDocument({
        documentType: 'biometry_record',
        status: 'active',
        isPointer: false,
      }),
    ).toBe(false);
  });

  it('loads insurance-only CCMS rows and lazy-ensures missing canonical ids', async () => {
    vi.mocked(getDocumentsByPatient).mockResolvedValue({
      documents: [
        {
          id: 'doc-1',
          coverageCaseId: 'case-1',
          documentName: 'Policy.pdf',
          documentType: 'policy_document',
          documentCategory: 'preauth',
          status: 'active',
          createdAt: '2026-10-01T00:00:00Z',
          updatedAt: '2026-10-01T00:00:00Z',
          uploadedAt: '2026-10-01T00:00:00Z',
          mimeType: 'application/pdf',
          fileSizeBytes: 100,
          canonicalDocumentId: null,
          isPointer: false,
        },
      ],
      totalCount: 1,
      pageNumber: 1,
      pageSize: 20,
    });
    vi.mocked(ensureCcmsDocumentCanonical).mockResolvedValue({
      ccmsDocumentId: 'doc-1',
      canonicalDocumentId: 'can-1',
      registered: true,
    });

    const result = await loadPatient360InsuranceDocuments('patient-1');

    expect(getDocumentsByPatient).toHaveBeenCalledWith('patient-1', 1, expect.any(Number), {
      insuranceOnly: true,
    });
    expect(ensureCcmsDocumentCanonical).toHaveBeenCalledWith('doc-1');
    expect(result.state).toBe('ready');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.canonicalDocumentId).toBe('can-1');
    expect(insuranceDocumentEmptyMessage()).toBe('No insurance documents recorded.');
  });

  it('downloads via CCMS content path', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' });
    vi.mocked(fetchCaseDocumentBlob).mockResolvedValue(blob);
    await expect(
      downloadPatient360CcmsDocument('case-1', 'doc-1', { mimeType: 'application/pdf' }),
    ).resolves.toBe(blob);
    expect(fetchCaseDocumentBlob).toHaveBeenCalledWith('case-1', 'doc-1', {
      mimeType: 'application/pdf',
    });
  });
});
