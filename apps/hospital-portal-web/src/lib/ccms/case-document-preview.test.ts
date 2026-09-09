import { describe, expect, it } from 'vitest';
import {
  canPreviewDocumentInBrowser,
  getPointerDocumentNotice,
  hasJpegMagicBytes,
  hasPdfMagicBytes,
  hasPngMagicBytes,
  hasWebpMagicBytes,
  inferMimeTypeFromMagicBytes,
  isPointerDocumentUrl,
  needsAuthorizedBlobAccess,
  resolveDocumentPreviewKind,
  resolveSlotDocumentMetadata,
} from './case-document-preview';

describe('case document preview helpers', () => {
  it('detects pointer document URLs', () => {
    expect(isPointerDocumentUrl('biometry://record/abc')).toBe(true);
    expect(isPointerDocumentUrl('pacs://study/1.2.3')).toBe(true);
    expect(isPointerDocumentUrl('https://blob/a.pdf')).toBe(false);
  });

  it('returns pointer notices for biometry and pacs', () => {
    expect(getPointerDocumentNotice('biometry://record/x')).toContain('Biometry');
    expect(getPointerDocumentNotice('pacs://study/x')).toContain('PACS');
    expect(getPointerDocumentNotice('https://x')).toBeNull();
  });

  it('resolves preview kind from mimeType', () => {
    expect(resolveDocumentPreviewKind('https://x/a', 'image/jpeg', null)).toBe('image');
    expect(resolveDocumentPreviewKind('https://x/a', 'application/pdf', null)).toBe('pdf');
  });

  it('falls back to filename extension when mimeType is missing', () => {
    expect(resolveDocumentPreviewKind('https://x/a', null, 'scan.png')).toBe('image');
    expect(resolveDocumentPreviewKind('https://x/a', null, 'policy.PDF')).toBe('pdf');
  });

  it('does not treat pointer URLs as ordinary file preview', () => {
    expect(resolveDocumentPreviewKind('biometry://record/x', 'application/pdf', 'x.pdf')).toBe('pointer');
  });

  it('detects raw blob URLs that need SAS authorization', () => {
    expect(needsAuthorizedBlobAccess('http://127.0.0.1:10000/devstoreaccount1/ccms-documents/x.pdf')).toBe(true);
    expect(needsAuthorizedBlobAccess('https://blob.test/x?sv=2024&sig=abc')).toBe(false);
    expect(needsAuthorizedBlobAccess('biometry://record/x')).toBe(false);
  });

  it('resolves preview kind for blob object URLs using mimeType', () => {
    expect(resolveDocumentPreviewKind('blob:http://localhost/abc', 'application/pdf', null)).toBe('pdf');
    expect(resolveDocumentPreviewKind('blob:http://localhost/abc', 'image/png', null)).toBe('image');
  });

  it('resolves preview kind for blob object URLs using filename when mime missing', () => {
    expect(resolveDocumentPreviewKind('blob:http://localhost/abc', null, 'policy.pdf')).toBe('pdf');
  });

  it('detects PDF magic bytes', () => {
    expect(hasPdfMagicBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe(true);
    expect(hasPdfMagicBytes(new Uint8Array([0x09, 0x08, 0x07, 0x06]))).toBe(false);
  });

  it('resolves slot metadata from backing document row', () => {
    const meta = resolveSlotDocumentMetadata(
      { docId: 'd1', fileName: '', mimeType: null },
      [{ id: 'd1', fileName: 'card.png', mimeType: 'image/png' }],
    );
    expect(meta.fileName).toBe('card.png');
    expect(meta.mimeType).toBe('image/png');
  });

  it('detects browser-previewable mime types', () => {
    expect(canPreviewDocumentInBrowser('application/pdf', null)).toBe(true);
    expect(canPreviewDocumentInBrowser('image/webp', null)).toBe(true);
    expect(canPreviewDocumentInBrowser('application/zip', 'archive.zip')).toBe(false);
  });

  it('detects JPEG/PNG/WEBP magic bytes', () => {
    expect(hasJpegMagicBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(hasPngMagicBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(true);
    expect(
      hasWebpMagicBytes(new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50,
      ])),
    ).toBe(true);
    expect(inferMimeTypeFromMagicBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
  });
});
