/**
 * Isolated Patient 360 document print — same-page hidden iframe.
 * Never call SPA window.print() against Patient Directory / Patient 360 chrome.
 * Never open a popup / blank tab for printing.
 */

export type Patient360DocumentPrintInput = {
  fileName: string;
  mimeType?: string | null;
  /** Authenticated blob already loaded via the existing content endpoint. */
  blob: Blob;
};

export type OpenPatient360DocumentPrintDeps = {
  ownerDocument?: Document;
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
  scheduleCleanup?: (fn: () => void, ms: number) => void;
  waitForImages?: (doc: Document) => Promise<void>;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizePatient360DocumentMime(mimeType?: string | null): string {
  return (mimeType ?? '').split(';', 1)[0]?.trim().toLowerCase() ?? '';
}

export function isPatient360PrintableImageMime(mimeType?: string | null): boolean {
  const mime = normalizePatient360DocumentMime(mimeType);
  return mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/png';
}

export function isPatient360PrintablePdfMime(mimeType?: string | null): boolean {
  return normalizePatient360DocumentMime(mimeType) === 'application/pdf';
}

export function buildPatient360DocumentPrintHtml(input: {
  fileName: string;
  mimeType?: string | null;
  objectUrl: string;
}): string {
  const title = escapeHtml(input.fileName.trim() || 'Document');
  const objectUrl = escapeHtml(input.objectUrl);
  const isImage = isPatient360PrintableImageMime(input.mimeType);
  const isPdf = isPatient360PrintablePdfMime(input.mimeType);

  const body = isImage
    ? `<img class="p360-doc-print-image" src="${objectUrl}" alt="${title}" />`
    : isPdf
      ? `<embed class="p360-doc-print-pdf" type="application/pdf" src="${objectUrl}" />`
      : `<p>This document cannot be printed from Patient 360. Use Download instead.</p>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title><style>
@page{margin:0.5in;}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;background:#fff;color:#111827;font-family:Arial,Helvetica,sans-serif;}
body{min-height:100vh;}
.p360-doc-print-image{display:block;max-width:100%;height:auto;width:auto;margin:0 auto;object-fit:contain;}
.p360-doc-print-pdf{display:block;width:100%;height:100vh;border:0;}
</style></head><body data-patient-360-document-print="1">
${body}
</body></html>`;
}

export function patient360DocumentPrintExcludesAppShell(html: string): boolean {
  return (
    html.includes('data-patient-360-document-print="1"') &&
    !html.includes('patient-360-panel-documents') &&
    !html.includes('Document sources') &&
    !html.includes('Sidebar')
  );
}

export function waitForPatient360PrintImages(doc: Document): Promise<void> {
  const images = Array.from(doc.images ?? []);
  if (!images.length) return Promise.resolve();
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  ).then(() => undefined);
}

function attachPrintFrame(doc: Document): HTMLIFrameElement {
  const iframe = doc.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('title', 'Document print');
  iframe.setAttribute('data-patient-360-document-print-frame', '1');
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';
  doc.body.appendChild(iframe);
  return iframe;
}

/**
 * Print ONLY the selected document via a same-page hidden iframe.
 * Caller must supply a blob already fetched through the authenticated content API.
 */
export function openPatient360DocumentPrint(
  input: Patient360DocumentPrintInput,
  deps: OpenPatient360DocumentPrintDeps = {},
): { opened: boolean; reason?: string } {
  const ownerDocument = deps.ownerDocument ?? (typeof document !== 'undefined' ? document : undefined);
  if (!ownerDocument?.body) {
    return { opened: false, reason: 'no_document' };
  }

  const createObjectURL = deps.createObjectURL ?? ((blob) => URL.createObjectURL(blob));
  const revokeObjectURL = deps.revokeObjectURL ?? ((url) => URL.revokeObjectURL(url));
  const scheduleCleanup =
    deps.scheduleCleanup ??
    ((fn, ms) => {
      globalThis.setTimeout(fn, ms);
    });
  const waitForImages = deps.waitForImages ?? waitForPatient360PrintImages;

  const mimeType = input.mimeType ?? input.blob.type;
  const objectUrl = createObjectURL(input.blob);
  const iframe = attachPrintFrame(ownerDocument);

  let cleaned = false;
  let printed = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try {
      iframe.contentWindow?.removeEventListener('afterprint', cleanup);
    } catch {
      /* ignore */
    }
    try {
      iframe.remove();
    } catch {
      /* ignore */
    }
    try {
      revokeObjectURL(objectUrl);
    } catch {
      /* ignore */
    }
  };

  const invokePrint = () => {
    if (printed || cleaned) return;
    printed = true;
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      iframe.contentWindow?.addEventListener('afterprint', cleanup);
      scheduleCleanup(cleanup, 60_000);
    } catch {
      cleanup();
    }
  };

  if (isPatient360PrintablePdfMime(mimeType)) {
    // Browser-native PDF document in the hidden frame.
    iframe.addEventListener('load', () => {
      invokePrint();
    });
    iframe.src = objectUrl;
    scheduleCleanup(cleanup, 60_000);
    return { opened: true };
  }

  const html = buildPatient360DocumentPrintHtml({
    fileName: input.fileName,
    mimeType,
    objectUrl,
  });

  const frameDoc = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDoc || !frameWindow) {
    cleanup();
    return { opened: false, reason: 'frame_unavailable' };
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  // Wait for image.onload (or complete) before printing — no fixed delay.
  void waitForImages(frameDoc).then(invokePrint);

  return { opened: true };
}

export async function printPatient360DocumentFromLoader(
  input: {
    fileName: string;
    mimeType?: string | null;
    loadContent: () => Promise<Blob>;
  },
  deps: OpenPatient360DocumentPrintDeps = {},
): Promise<{ opened: boolean; reason?: string }> {
  try {
    const blob = await input.loadContent();
    return openPatient360DocumentPrint(
      {
        fileName: input.fileName,
        mimeType: input.mimeType ?? blob.type,
        blob,
      },
      deps,
    );
  } catch {
    return { opened: false, reason: 'load_failed' };
  }
}
