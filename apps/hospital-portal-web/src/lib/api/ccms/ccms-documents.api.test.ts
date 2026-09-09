import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';

const getMock = vi.fn();
const postMock = vi.fn().mockResolvedValue({ data: { id: 'doc-1', url: 'https://example/blob' } });

vi.mock('./ccms-base', () => ({
  getCcmsApi: () => ({
    post: postMock,
    get: getMock,
  }),
}));

describe('isCompleteCaseDocument', () => {
  it('rejects metadata-only upload responses', async () => {
    const { isCompleteCaseDocument } = await import('./ccms-documents.api');
    expect(isCompleteCaseDocument({
      id: 'e4cb5051-7bd9-4332-9562-d0babdf28a10',
      caseId: 'efd29668-5976-46d6-908f-c670c17e4e3d',
      documentType: 'insurance_card_front',
      fileName: 'insurance card front',
      url: '',
      accessUrl: '',
      mimeType: undefined,
      sizeBytes: 0,
      uploadedAt: '2026-08-31T05:33:28.4169843Z',
      isActive: true,
    })).toBe(false);
  });

  it('accepts complete upload responses', async () => {
    const { isCompleteCaseDocument } = await import('./ccms-documents.api');
    expect(isCompleteCaseDocument({
      id: 'doc-1',
      caseId: 'case-1',
      documentType: 'id_proof',
      fileName: 'id.pdf',
      url: 'http://127.0.0.1:10000/devstoreaccount1/ccms-documents/x.pdf',
      accessUrl: 'http://127.0.0.1:10000/devstoreaccount1/ccms-documents/x.pdf?sig=abc',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      uploadedAt: '2026-08-31T05:33:28Z',
      isActive: true,
    })).toBe(true);
  });

  it('accepts persisted blob rows missing mime after refresh', async () => {
    const { isCompleteCaseDocument, isDisplayableCaseDocument, mapCaseDocumentFromApi } =
      await import('./ccms-documents.api');
    const doc = mapCaseDocumentFromApi({
      id: 'doc-refresh-1',
      caseId: 'case-1',
      documentType: 'doctor_referral',
      fileName: 'rx.png',
      url: 'http://127.0.0.1:10000/devstoreaccount1/ccms-documents/rx.png',
      accessUrl: 'http://127.0.0.1:10000/devstoreaccount1/ccms-documents/rx.png?sig=1',
      uploadedAt: '2026-09-04T10:00:00Z',
      isActive: true,
    });
    expect(doc).not.toBeNull();
    expect(isDisplayableCaseDocument(doc)).toBe(true);
    expect(isCompleteCaseDocument(doc)).toBe(true);
  });
});

describe('uploadCaseDocument', () => {
  beforeEach(() => {
    postMock.mockClear();
    getMock.mockClear();
  });

  it('rejects incomplete 201 responses from the API', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        id: 'bad',
        caseId: 'case-1',
        documentType: 'id_proof',
        fileName: 'id proof',
        url: '',
        accessUrl: '',
        mimeType: null,
        sizeBytes: 0,
        uploadedAt: '2026-08-31T05:33:28Z',
        isActive: true,
      },
    });
    const { uploadCaseDocument } = await import('./ccms-documents.api');
    const file = new File(['%PDF-1.4'], 'id.pdf', { type: 'application/pdf' });
    await expect(uploadCaseDocument('case-1', file, 'id_proof')).rejects.toThrow(
      'Upload did not persist the file',
    );
  });

  it('does not override multipart Content-Type (axios must set boundary)', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        id: 'doc-1',
        caseId: 'case-1',
        documentType: 'id_proof',
        fileName: 'id.pdf',
        url: 'http://127.0.0.1:10000/devstoreaccount1/x.pdf',
        accessUrl: 'http://127.0.0.1:10000/devstoreaccount1/x.pdf?sig=abc',
        mimeType: 'application/pdf',
        sizeBytes: 4,
        uploadedAt: '2026-08-31T05:33:28Z',
        isActive: true,
      },
    });
    const { uploadCaseDocument } = await import('./ccms-documents.api');
    const file = new File(['pdf'], 'id.pdf', { type: 'application/pdf' });
    await uploadCaseDocument('case-1', file, 'id_proof');

    expect(postMock).toHaveBeenCalledOnce();
    const [, body] = postMock.mock.calls[0] as [string, FormData];
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('documentType')).toBe('id_proof');
    expect(body.get('stage')).toBe('preauth');
  });
});

describe('getCaseDocumentAccessUrl', () => {
  beforeEach(() => {
    getMock.mockClear();
  });

  it('calls the JWT-protected access-url endpoint', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        url: 'https://blob.test/ccms-documents/x?sig=abc',
        expiresAt: '2026-08-31T12:00:00Z',
        isPointer: false,
      },
    });
    const { getCaseDocumentAccessUrl } = await import('./ccms-documents.api');
    const result = await getCaseDocumentAccessUrl('case-1', 'doc-1');
    expect(getMock).toHaveBeenCalledWith(
      '/ccms/documents/doc-1/access-url',
      { params: { coverageCaseId: 'case-1' } },
    );
    expect(result.url).toContain('sig=');
    expect(result.isPointer).toBe(false);
  });
});

describe('fetchCaseDocumentBlob', () => {
  beforeEach(() => {
    getMock.mockClear();
  });

  it('returns a typed blob and validates JPEG magic bytes', async () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    getMock.mockResolvedValueOnce({
      data: new Blob([jpegBytes], { type: 'application/json' }),
      headers: { 'content-type': 'image/jpeg' },
    });
    const { fetchCaseDocumentBlob } = await import('./ccms-documents.api');
    const blob = await fetchCaseDocumentBlob('case-1', 'doc-1', {
      mimeType: 'image/jpeg',
      fileName: 'photo.jpeg',
    });
    expect(blob.type).toBe('image/jpeg');
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe('formatCcmsDocumentError', () => {
  it('surfaces backend error and detail from failed upload', async () => {
    const { formatCcmsDocumentError } = await import('./ccms-documents.api');
    const err = new AxiosError('fail', '500', undefined, undefined, {
      status: 500,
      statusText: 'Error',
      data: { error: 'Save failed', detail: 'duplicate key' },
      headers: {},
      config: {} as never,
    });
    expect(formatCcmsDocumentError(err, 'fallback')).toBe('Save failed (duplicate key)');
  });

  it('uses Error message for generic errors', async () => {
    const { formatCcmsDocumentError } = await import('./ccms-documents.api');
    expect(formatCcmsDocumentError(new Error('x'), 'Could not upload document.')).toBe('x');
  });

  it('uses fallback for non-error values', async () => {
    const { formatCcmsDocumentError } = await import('./ccms-documents.api');
    expect(formatCcmsDocumentError('unknown', 'Could not upload document.')).toBe(
      'Could not upload document.',
    );
  });
});

describe('mapCaseDocumentFromApi', () => {
  it('maps GET /documents DTO shape', async () => {
    const { mapCaseDocumentFromApi } = await import('./ccms-documents.api');
    const doc = mapCaseDocumentFromApi({
      id: 'doc-1',
      caseId: 'case-1',
      documentType: 'id_proof',
      fileName: 'aadhaar.pdf',
      url: 'http://127.0.0.1:10000/devstoreaccount1/ccms-documents/x.pdf',
      accessUrl: 'http://127.0.0.1:10000/devstoreaccount1/ccms-documents/x.pdf?sig=abc',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      uploadedAt: '2026-08-31T05:33:28Z',
      isActive: true,
    });
    expect(doc?.id).toBe('doc-1');
    expect(doc?.url).toContain('x.pdf');
    expect(doc?.fileName).toBe('aadhaar.pdf');
  });

  it('maps workspace entity shape (blobUrl/documentName/fileSizeBytes)', async () => {
    const { mapCaseDocumentFromApi } = await import('./ccms-documents.api');
    const doc = mapCaseDocumentFromApi({
      id: 'doc-ws-1',
      coverageCase_Id: 'case-uuid',
      documentType: 'insurance_card_front',
      documentName: 'card-front.jpg',
      blobUrl: 'http://127.0.0.1:10000/devstoreaccount1/ccms-documents/card.jpg',
      mimeType: 'image/jpeg',
      fileSizeBytes: 2048,
      uploadedAt: '2026-08-31T05:33:28Z',
      status: 'active',
    });
    expect(doc).toMatchObject({
      id: 'doc-ws-1',
      caseId: 'case-uuid',
      documentType: 'insurance_card_front',
      fileName: 'card-front.jpg',
      url: expect.stringContaining('card.jpg'),
      sizeBytes: 2048,
      isActive: true,
    });
  });

  it('rejects metadata-only workspace rows', async () => {
    const { mapCaseDocumentFromApi } = await import('./ccms-documents.api');
    expect(
      mapCaseDocumentFromApi({
        id: 'meta-1',
        coverageCase_Id: 'case-1',
        documentType: 'id_proof',
        documentName: 'id proof',
        blobUrl: '',
        fileSizeBytes: 0,
        uploadedAt: '2026-08-31T05:33:28Z',
      }),
    ).toBeNull();
  });
});

describe('fetchCaseDocumentsFromApi', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('normalizes mixed API rows and drops incomplete documents', async () => {
    getMock.mockResolvedValueOnce({
      data: [
        {
          id: 'good',
          caseId: 'case-1',
          documentType: 'id_proof',
          fileName: 'id.pdf',
          url: 'http://127.0.0.1:10000/devstoreaccount1/x.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 100,
          uploadedAt: '2026-08-31T05:33:28Z',
          isActive: true,
        },
        {
          id: 'bad',
          caseId: 'case-1',
          documentType: 'policy_document',
          fileName: 'policy',
          url: '',
          sizeBytes: 0,
          uploadedAt: '2026-08-31T05:33:28Z',
          isActive: true,
        },
      ],
    });
    const { fetchCaseDocumentsFromApi } = await import('./ccms-documents.api');
    const docs = await fetchCaseDocumentsFromApi('case-1');
    expect(docs).toHaveLength(1);
    expect(docs[0]?.id).toBe('good');
  });
});
