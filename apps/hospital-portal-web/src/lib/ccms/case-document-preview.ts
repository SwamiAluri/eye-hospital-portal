/**
 * Shared preview helpers for CCMS case documents (counsellor + CCMS workspace).
 */

export type DocumentPreviewKind = 'image' | 'pdf' | 'iframe' | 'unsupported' | 'pointer';

export function isPointerDocumentUrl(url?: string | null): boolean {
  if (!url) return false;
  const u = url.trim().toLowerCase();
  return u.startsWith('biometry://') || u.startsWith('pacs://');
}

export function isHttpDocumentUrl(url?: string | null): boolean {
  if (!url) return false;
  return /^https?:\/\//i.test(url.trim());
}

export function isBlobObjectUrl(url?: string | null): boolean {
  if (!url) return false;
  return url.trim().toLowerCase().startsWith('blob:');
}

export function isPreviewableDocumentUrl(url?: string | null): boolean {
  return isHttpDocumentUrl(url) || isBlobObjectUrl(url);
}

export function getPointerDocumentNotice(url: string): string | null {
  const u = url.trim().toLowerCase();
  if (u.startsWith('biometry://')) {
    return 'This is the OPD biometry record on file. Open Diagnostics → Biometry to view measurements. Auth remains the source of truth; this case only stores a pointer.';
  }
  if (u.startsWith('pacs://')) {
    return 'This is a PACS imaging study pointer. Open Diagnostics → Imaging to view the study.';
  }
  return null;
}

function isImageFileName(fileName?: string | null): boolean {
  if (!fileName) return false;
  return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(fileName);
}

function isPdfFileName(fileName?: string | null): boolean {
  if (!fileName) return false;
  return /\.pdf$/i.test(fileName);
}

/** Prefer mimeType; fall back to filename extension. */
export function resolveDocumentPreviewKind(
  url: string | null | undefined,
  mimeType?: string | null,
  fileName?: string | null,
): DocumentPreviewKind {
  if (!url?.trim()) return 'unsupported';
  if (isPointerDocumentUrl(url)) return 'pointer';
  if (!isPreviewableDocumentUrl(url)) return 'unsupported';

  const mime = (mimeType ?? '').trim().toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (isImageFileName(fileName)) return 'image';
  if (isPdfFileName(fileName)) return 'pdf';
  return 'iframe';
}

export const PREVIEW_LOAD_FAILED_MESSAGE =
  'Preview could not be loaded in the browser. The file may be blocked by storage permissions, CORS, or X-Frame-Options. Use Open or Download to view the document.';

export const DOCUMENT_ACCESS_DENIED_MESSAGE =
  'Document access could not be authorized. The storage link may be expired or misconfigured. Try again, or use Open/Download after refreshing.';

export const INVALID_STORED_PDF_MESSAGE =
  'The stored file is not a readable PDF. Please re-upload the document.';

/** True when bytes begin with the PDF magic header (%PDF). */
export function hasPdfMagicBytes(bytes: ArrayBuffer | Uint8Array): boolean {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return view.length >= 4
    && view[0] === 0x25
    && view[1] === 0x50
    && view[2] === 0x44
    && view[3] === 0x46;
}

/** True when bytes begin with a JPEG SOI marker (FF D8 FF). */
export function hasJpegMagicBytes(bytes: ArrayBuffer | Uint8Array): boolean {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return view.length >= 3
    && view[0] === 0xff
    && view[1] === 0xd8
    && view[2] === 0xff;
}

/** True when bytes begin with the PNG signature. */
export function hasPngMagicBytes(bytes: ArrayBuffer | Uint8Array): boolean {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return view.length >= 4
    && view[0] === 0x89
    && view[1] === 0x50
    && view[2] === 0x4e
    && view[3] === 0x47;
}

/** True when bytes begin with a RIFF….WEBP container. */
export function hasWebpMagicBytes(bytes: ArrayBuffer | Uint8Array): boolean {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return view.length >= 12
    && view[0] === 0x52
    && view[1] === 0x49
    && view[2] === 0x46
    && view[3] === 0x46
    && view[8] === 0x57
    && view[9] === 0x45
    && view[10] === 0x42
    && view[11] === 0x50;
}

export function hasRecognizedDocumentMagicBytes(bytes: ArrayBuffer | Uint8Array): boolean {
  return hasPdfMagicBytes(bytes)
    || hasJpegMagicBytes(bytes)
    || hasPngMagicBytes(bytes)
    || hasWebpMagicBytes(bytes);
}

/** Infer a MIME type from file header bytes when metadata is missing or wrong. */
export function inferMimeTypeFromMagicBytes(bytes: ArrayBuffer | Uint8Array): string | undefined {
  if (hasPdfMagicBytes(bytes)) return 'application/pdf';
  if (hasJpegMagicBytes(bytes)) return 'image/jpeg';
  if (hasPngMagicBytes(bytes)) return 'image/png';
  if (hasWebpMagicBytes(bytes)) return 'image/webp';
  return undefined;
}

/** Merge slot metadata with the backing case document row (e.g. after cache refetch). */
export function resolveSlotDocumentMetadata(
  slot: { docId?: string; fileName?: string | null; mimeType?: string | null },
  documents: Array<{ id: string; fileName?: string; mimeType?: string }>,
): { fileName?: string; mimeType?: string } {
  const fromDoc = slot.docId ? documents.find((d) => d.id === slot.docId) : undefined;
  const fileName = slot.fileName?.trim() || fromDoc?.fileName?.trim() || undefined;
  const mimeType = slot.mimeType?.trim() || fromDoc?.mimeType?.trim() || undefined;
  return { fileName, mimeType };
}

/** Whether the browser can render this document inline (PDF or common images). */
export function canPreviewDocumentInBrowser(
  mimeType?: string | null,
  fileName?: string | null,
): boolean {
  const kind = resolveDocumentPreviewKind('blob:local', mimeType, fileName);
  return kind === 'image' || kind === 'pdf';
}

/** Raw blob URLs without a SAS signature need a CCMS access-url call first. */
export function needsAuthorizedBlobAccess(url?: string | null): boolean {
  if (!url?.trim()) return false;
  if (isPointerDocumentUrl(url)) return false;
  if (!isHttpDocumentUrl(url)) return false;
  try {
    const parsed = new URL(url.trim());
    return !parsed.searchParams.has('sig');
  } catch {
    return true;
  }
}
