import { describe, expect, it, vi } from 'vitest';
import {
  buildPatient360DocumentPrintHtml,
  openPatient360DocumentPrint,
  patient360DocumentPrintExcludesAppShell,
  waitForPatient360PrintImages,
} from '@/lib/patients/patient-360-document-print';

function createFrameDocument() {
  const images: Array<{ complete: boolean; onload: null | (() => void); onerror: null | (() => void) }> = [];
  const frameDoc = {
    images,
    open: vi.fn(),
    write: vi.fn((html: string) => {
      frameDoc.lastHtml = html;
      if (html.includes('p360-doc-print-image')) {
        images.push({ complete: false, onload: null, onerror: null });
      }
    }),
    close: vi.fn(),
    lastHtml: '',
  };
  return frameDoc;
}

describe('patient 360 document print', () => {
  it('builds an isolated image print document without Patient 360 chrome or window.open', () => {
    const html = buildPatient360DocumentPrintHtml({
      fileName: 'scan.png',
      mimeType: 'image/png',
      objectUrl: 'blob:https://example.local/doc-1',
    });
    expect(html).toContain('data-patient-360-document-print="1"');
    expect(html).toContain('p360-doc-print-image');
    expect(html).toContain('object-fit:contain');
    expect(html).not.toContain('window.open');
    expect(html).not.toContain('window.print()');
    expect(patient360DocumentPrintExcludesAppShell(html)).toBe(true);
  });

  it('waits for image onload before resolving readiness', async () => {
    let resolveLoad: (() => void) | undefined;
    const img = {
      complete: false,
      onload: null as null | (() => void),
      onerror: null as null | (() => void),
    };
    Object.defineProperty(img, 'onload', {
      set(fn: () => void) {
        resolveLoad = fn;
      },
      get() {
        return resolveLoad ?? null;
      },
    });
    const pending = waitForPatient360PrintImages({ images: [img] } as unknown as Document);
    expect(resolveLoad).toBeTypeOf('function');
    resolveLoad?.();
    await pending;
  });

  it('prints through a same-page hidden iframe and cleans it up', async () => {
    const frameDoc = createFrameDocument();
    const print = vi.fn();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const remove = vi.fn();
    const iframe = {
      style: { cssText: '' },
      setAttribute: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      remove,
      contentDocument: frameDoc,
      contentWindow: { focus: vi.fn(), print, addEventListener, removeEventListener },
      src: '',
    };
    const appendChild = vi.fn(() => iframe);
    const ownerDocument = {
      body: { appendChild },
      createElement: vi.fn(() => iframe),
    } as unknown as Document;

    const createObjectURL = vi.fn(() => 'blob:https://example.local/created');
    const revokeObjectURL = vi.fn();
    const waitForImages = vi.fn(async () => undefined);
    const scheduleCleanup = vi.fn((fn: () => void) => fn());

    const result = openPatient360DocumentPrint(
      { fileName: 'scan.png', mimeType: 'image/png', blob: new Blob(['png'], { type: 'image/png' }) },
      {
        ownerDocument,
        createObjectURL,
        revokeObjectURL,
        waitForImages,
        scheduleCleanup,
      },
    );

    expect(result.opened).toBe(true);
    expect(appendChild).toHaveBeenCalledTimes(1);
    expect(iframe.setAttribute).toHaveBeenCalledWith('data-patient-360-document-print-frame', '1');
    expect(frameDoc.write).toHaveBeenCalledTimes(1);
    const written = String(frameDoc.write.mock.calls[0]?.[0] ?? '');
    expect(written).toContain('scan.png');
    expect(patient360DocumentPrintExcludesAppShell(written)).toBe(true);

    await vi.waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    expect(remove).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:https://example.local/created');
  });
});
