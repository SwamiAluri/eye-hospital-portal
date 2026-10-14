import { describe, expect, it, vi } from 'vitest';
import {
  buildRegistrationCardPrintBodyHtml,
  buildRegistrationCardPrintDocumentHtml,
  extractRegistrationCardPrintMedia,
  openRegistrationCardPrint,
  registrationCardPrintDocumentExcludesAppShell,
  registrationCardPrintDocumentHasFidelityMarkers,
  formatRegistrationCardMrnDisplay,
  formatRegistrationCardPrintDob,
  REGISTRATION_CARD_PRINT_DOCUMENT_STYLES,
} from '@/lib/patients/registration-card-print';

const samplePatient = {
  id: 'p-1',
  firstName: 'Suresh',
  lastName: 'Babu',
  medicalRecordNumber: 'MRN-2026-10-TEST',
  dateOfBirth: '1987-08-01',
  gender: 'Male',
  contactNumber: '8919653433',
  bloodGroup: 'O+',
  photoUrl: null as string | null,
};

describe('registration-card-print fidelity', () => {
  it('builds a self-contained print document with complete card content + CSS', () => {
    const html = buildRegistrationCardPrintDocumentHtml(samplePatient, {
      qrSvgHtml: '<svg data-qr="1"></svg>',
      barcodeSvgHtml: '<svg class="barcode-svg" data-bc="1"></svg>',
    });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('HOSPITAL PORTAL');
    expect(html).toContain('Patient Registration Card');
    expect(html).toContain('Suresh Babu');
    expect(html).toContain('MRN-2026-10-TEST');
    expect(html).toContain('O+');
    expect(html).toContain(formatRegistrationCardPrintDob('1987-08-01'));
    expect(html).toContain('Male');
    expect(html).toContain('8919653433');
    expect(html).toContain('data-qr="1"');
    expect(html).toContain('data-bc="1"');
    expect(html).toContain('Keep this card safe');
    expect(html).toContain(REGISTRATION_CARD_PRINT_DOCUMENT_STYLES.slice(0, 40));
    expect(registrationCardPrintDocumentHasFidelityMarkers(html)).toBe(true);
    expect(registrationCardPrintDocumentExcludesAppShell(html)).toBe(true);
    expect(html.toLowerCase()).not.toContain('patient directory');
    expect(html.toLowerCase()).not.toContain('register new patient');
    expect(html).not.toContain('Print Registration Card');
    expect(html).not.toContain('grid-cols-3');
    expect(html).not.toContain('body *');
  });

  it('defines single-page geometry: @page 3.5in×2in margin 0 + page-break avoid', () => {
    expect(REGISTRATION_CARD_PRINT_DOCUMENT_STYLES).toContain('@page{size:3.5in 2in;margin:0;}');
    expect(REGISTRATION_CARD_PRINT_DOCUMENT_STYLES).toContain('page-break-inside:avoid');
    expect(REGISTRATION_CARD_PRINT_DOCUMENT_STYLES).toContain('break-inside:avoid');
    expect(REGISTRATION_CARD_PRINT_DOCUMENT_STYLES).toContain('width:3.5in;height:2in');
    expect(REGISTRATION_CARD_PRINT_DOCUMENT_STYLES).toContain(
      'grid-template-columns:0.95in 1fr',
    );
  });

  it('body HTML uses explicit print layout classes (not SPA Tailwind)', () => {
    const body = buildRegistrationCardPrintBodyHtml(samplePatient, {
      qrSvgHtml: '<svg id="qr"></svg>',
      barcodeSvgHtml: '<svg id="bc"></svg>',
    });
    expect(body).toContain('class="rc-card"');
    expect(body).toContain('class="rc-body"');
    expect(body).toContain('class="rc-left"');
    expect(body).toContain('class="rc-right"');
    expect(body).toContain('class="rc-fields"');
    expect(body).not.toContain('flex flex-col');
    expect(body).not.toContain('grid-cols-3');
    expect(body).not.toContain('text-[0.55rem]');
  });

  it('extracts QR/barcode SVG media from on-screen card element', () => {
    const qr = { outerHTML: '<svg data-qr="yes"><rect/></svg>', classList: { contains: () => false } };
    const barcode = {
      outerHTML: '<svg class="barcode-svg" data-bc="yes"><path/></svg>',
      classList: { contains: (c: string) => c === 'barcode-svg' },
    };
    const img = { getAttribute: (name: string) => (name === 'src' ? 'https://example.com/a.jpg' : null) };
    const card = {
      querySelector: (sel: string) => {
        if (sel === 'svg.barcode-svg') return barcode;
        if (sel === 'img') return img;
        return null;
      },
      querySelectorAll: (sel: string) => (sel === 'svg' ? [qr, barcode] : []),
    } as unknown as HTMLElement;

    const media = extractRegistrationCardPrintMedia(card);
    expect(media.qrSvgHtml).toContain('data-qr="yes"');
    expect(media.barcodeSvgHtml).toContain('data-bc="yes"');
    expect(media.photoUrl).toBe('https://example.com/a.jpg');
  });

  it('opens an isolated print window — not SPA window.print', () => {
    const write = vi.fn();
    const close = vi.fn();
    const openWindow = vi.fn(() => ({
      document: { write, close },
    }));
    const qr = { outerHTML: '<svg data-qr="1"></svg>', classList: { contains: () => false } };
    const barcode = {
      outerHTML: '<svg class="barcode-svg" data-bc="1"></svg>',
      classList: { contains: (c: string) => c === 'barcode-svg' },
    };
    const card = {
      querySelector: (sel: string) => (sel === 'svg.barcode-svg' ? barcode : null),
      querySelectorAll: (sel: string) => (sel === 'svg' ? [qr, barcode] : []),
    } as unknown as HTMLElement;

    const result = openRegistrationCardPrint(
      { patient: samplePatient, cardElement: card },
      { openWindow: openWindow as never },
    );
    expect(result.opened).toBe(true);
    expect(openWindow).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);
    const written = String(write.mock.calls[0]?.[0] ?? '');
    expect(written).toContain('Suresh Babu');
    expect(written).toContain('data-qr="1"');
    expect(written).toContain('data-bc="1"');
    expect(registrationCardPrintDocumentHasFidelityMarkers(written)).toBe(true);
    expect(registrationCardPrintDocumentExcludesAppShell(written)).toBe(true);
  });

  it('fails closed when patient is missing', () => {
    expect(openRegistrationCardPrint(null)).toEqual({ opened: false });
  });

  it('formats MRN display with Unavailable fallback', () => {
    expect(formatRegistrationCardMrnDisplay('MRN-9')).toBe('MRN-9');
    expect(formatRegistrationCardMrnDisplay('')).toBe('Unavailable');
    expect(formatRegistrationCardMrnDisplay(null)).toBe('Unavailable');
  });
});
