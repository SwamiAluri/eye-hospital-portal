import { describe, expect, it } from 'vitest';
import {
  CaseDocumentActionError,
  isPdfDocument,
  sanitizeDownloadFileName,
  validatePdfBlobIfNeeded,
  validateRetrievedDocumentBlob,
} from './case-document-actions';
import { INVALID_STORED_PDF_MESSAGE } from './case-document-preview';

describe('case document actions', () => {
  it('detects PDF documents from mime or filename', () => {
    expect(isPdfDocument('application/pdf', null)).toBe(true);
    expect(isPdfDocument(null, 'policy.PDF')).toBe(true);
    expect(isPdfDocument('image/png', 'scan.png')).toBe(false);
    expect(isPdfDocument('image/jpeg', 'photo.jpeg')).toBe(false);
  });

  it('sanitizes download filenames', () => {
    expect(sanitizeDownloadFileName('  insurance/card:front.pdf  ')).toBe('insurance_card_front.pdf');
    expect(sanitizeDownloadFileName('   ')).toBe('document');
  });

  it('rejects empty and JSON error blobs via validateRetrievedDocumentBlob', async () => {
    await expect(
      validateRetrievedDocumentBlob(new Blob([], { type: 'application/pdf' })),
    ).rejects.toThrow(CaseDocumentActionError);

    const jsonError = new Blob(['{"error":"Blob not found"}'], { type: 'application/json' });
    await expect(validateRetrievedDocumentBlob(jsonError)).rejects.toThrow('Blob not found');
  });

  it('accepts JPEG bytes even when axios mislabels the blob as application/json', async () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const blob = new Blob([jpegBytes], { type: 'application/json' });
    await expect(
      validateRetrievedDocumentBlob(blob, { mimeType: 'image/jpeg', fileName: 'photo.jpeg' }),
    ).resolves.toBeUndefined();
  });

  it('validates PDF magic bytes', async () => {
    const valid = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], { type: 'application/pdf' });
    await expect(validatePdfBlobIfNeeded(valid, 'application/pdf', 'x.pdf')).resolves.toBeUndefined();

    const invalid = new Blob([new Uint8Array([0x09, 0x08, 0x07, 0x06])], { type: 'application/pdf' });
    await expect(validatePdfBlobIfNeeded(invalid, 'application/pdf', 'x.pdf'))
      .rejects.toThrow(INVALID_STORED_PDF_MESSAGE);
  });
});
