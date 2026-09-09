/**
 * Authenticated CCMS document open/download helpers.
 * Uses JWT-protected /content blobs — not cross-origin SAS URLs.
 */

import {
  INVALID_STORED_PDF_MESSAGE,
  hasPdfMagicBytes,
  hasRecognizedDocumentMagicBytes,
  inferMimeTypeFromMagicBytes,
} from './case-document-preview';

export class CaseDocumentActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CaseDocumentActionError';
  }
}

export function isPdfDocument(mimeType?: string | null, fileName?: string | null): boolean {
  const mime = (mimeType ?? '').trim().toLowerCase();
  if (mime === 'application/pdf' || mime === 'application/x-pdf') return true;
  return /\.pdf$/i.test(fileName ?? '');
}

export function sanitizeDownloadFileName(fileName: string): string {
  const trimmed = fileName.trim() || 'document';
  const base = trimmed.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ');
  return base.length > 0 ? base : 'document';
}

function headerLooksLikeText(bytes: ArrayBuffer): boolean {
  const view = new Uint8Array(bytes);
  if (view.length === 0) return false;
  const first = view[0];
  return first === 0x7b /* { */ || first === 0x5b /* [ */ || first === 0x3c /* < */;
}

function tryParseApiErrorMessage(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = JSON.parse(trimmed) as { error?: string; message?: string };
    const msg = (parsed.error ?? parsed.message ?? '').trim();
    return msg || undefined;
  } catch {
    if (trimmed.length > 0 && trimmed.length < 500) return trimmed;
    return undefined;
  }
}

export interface ValidateRetrievedDocumentBlobOptions {
  mimeType?: string | null;
  fileName?: string | null;
}

/**
 * Validates a /content response blob using magic bytes first, then Content-Type.
 * Avoids rejecting real PDF/JPEG/PNG/WEBP payloads when axios mislabels the Blob type.
 */
export async function validateRetrievedDocumentBlob(
  blob: Blob,
  options?: ValidateRetrievedDocumentBlobOptions,
): Promise<void> {
  if (!blob || blob.size <= 0) {
    throw new CaseDocumentActionError('Document is empty or could not be retrieved.');
  }

  const header = await blob.slice(0, 16).arrayBuffer();

  if (hasRecognizedDocumentMagicBytes(header)) {
    if (isPdfDocument(options?.mimeType, options?.fileName) || hasPdfMagicBytes(header)) {
      await validatePdfBlobIfNeeded(blob, options?.mimeType ?? 'application/pdf', options?.fileName);
    }
    return;
  }

  const type = (blob.type ?? '').trim().toLowerCase();
  const looksLikeApiError =
    type.includes('json')
    || type.includes('text/html')
    || type === 'text/plain'
    || headerLooksLikeText(header);

  if (looksLikeApiError) {
    const text = await blob.text();
    const apiMessage = tryParseApiErrorMessage(text);
    throw new CaseDocumentActionError(
      apiMessage ?? 'Document could not be retrieved. Please try again.',
    );
  }
}

/** @deprecated Use validateRetrievedDocumentBlob — kept for call sites migrating to async validation. */
export function assertRetrievedDocumentBlob(blob: Blob): void {
  if (!blob || blob.size <= 0) {
    throw new CaseDocumentActionError('Document is empty or could not be retrieved.');
  }
  const type = (blob.type ?? '').trim().toLowerCase();
  if (type.includes('json') || type.includes('text/html') || type === 'text/plain') {
    throw new CaseDocumentActionError('Document could not be retrieved. Please try again.');
  }
}

export async function validatePdfBlobIfNeeded(
  blob: Blob,
  mimeType?: string | null,
  fileName?: string | null,
): Promise<void> {
  if (!isPdfDocument(mimeType, fileName) && !hasPdfMagicBytes(await blob.slice(0, 4).arrayBuffer())) {
    return;
  }
  const header = await blob.slice(0, 4).arrayBuffer();
  if (!hasPdfMagicBytes(header)) {
    throw new CaseDocumentActionError(INVALID_STORED_PDF_MESSAGE);
  }
}

export function toTypedBlob(blob: Blob, mimeType?: string | null): Blob {
  const type = (mimeType ?? blob.type ?? 'application/octet-stream').trim();
  if (!type || blob.type === type) return blob;
  return new Blob([blob], { type });
}

/** Normalize blob MIME using metadata, response header, then magic bytes. */
export async function resolveBlobMimeType(
  blob: Blob,
  preferred?: string | null,
): Promise<string | undefined> {
  const fromPreferred = preferred?.split(';')[0]?.trim();
  if (fromPreferred) return fromPreferred;
  const fromBlob = blob.type?.split(';')[0]?.trim();
  if (fromBlob && fromBlob !== 'application/octet-stream') return fromBlob;
  const header = await blob.slice(0, 16).arrayBuffer();
  return inferMimeTypeFromMagicBytes(header);
}

/** Trigger a same-origin download with the original filename. */
export function downloadBlob(blob: Blob, fileName: string, mimeType?: string | null): void {
  const typed = toTypedBlob(blob, mimeType);
  const url = URL.createObjectURL(typed);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = sanitizeDownloadFileName(fileName);
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Open document in a new tab; revoke object URL after the tab has loaded. */
export function openBlobInNewTab(blob: Blob, mimeType?: string | null): void {
  const typed = toTypedBlob(blob, mimeType);
  const url = URL.createObjectURL(typed);
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    URL.revokeObjectURL(url);
    throw new CaseDocumentActionError(
      'Could not open a new tab. Allow pop-ups for this site and try again.',
    );
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
