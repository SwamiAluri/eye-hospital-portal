import { describe, expect, it, vi } from 'vitest';
import type { LmsSpecimenLabelPayloadDto } from '@/lib/lms/lms-specimens.api';
import {
  SPECIMEN_LABEL_POPUP_BLOCKED_MESSAGE,
  SPECIMEN_LABEL_PRINT_WINDOW_FEATURES,
  abandonSpecimenLabelPrintWindow,
  buildSpecimenLabelHtml,
  openSpecimenLabelPrintWindow,
  writeSpecimenLabelPrint,
} from '@/lib/lms/specimen-label-print';

const sampleLabel: LmsSpecimenLabelPayloadDto = {
  barcodeId: 'b1',
  barcodeValue: 'SPC-20261011-000001',
  symbology: 'CODE128',
  specimenId: 's1',
  specimenRowVersion: 4,
  printEventId: 'p1',
  printType: 'Print',
  printedAtUtc: '2026-10-11T12:00:00Z',
  patientMrn: 'MRN000001',
  patientName: 'Revathi Sundar',
  orderNumber: 'LAB-20261009-000006',
  collectedAtUtc: '2026-10-10T17:11:16.000Z',
  accession: 'ACC-20261011-000001',
  specimenType: 'Blood',
  branchName: 'Main',
};

function mockPrintWindow() {
  const write = vi.fn();
  const open = vi.fn();
  const closeDoc = vi.fn();
  const closeWin = vi.fn();
  const win = {
    document: { open, write, close: closeDoc },
    close: closeWin,
  } as unknown as Window;
  return { win, write, open, closeDoc, closeWin };
}

describe('specimen-label-print', () => {
  it('opens an isolated blank window synchronously without noopener', () => {
    const { win } = mockPrintWindow();
    const openWindow = vi.fn().mockReturnValue(win);

    const opened = openSpecimenLabelPrintWindow({ openWindow });

    expect(opened).toBe(win);
    expect(openWindow).toHaveBeenCalledWith('', '_blank', SPECIMEN_LABEL_PRINT_WINDOW_FEATURES);
    expect(SPECIMEN_LABEL_PRINT_WINDOW_FEATURES).not.toMatch(/noopener|noreferrer/);
  });

  it('reports popup failure when window.open returns null', () => {
    const openWindow = vi.fn().mockReturnValue(null);
    expect(openSpecimenLabelPrintWindow({ openWindow })).toBeNull();
    expect(SPECIMEN_LABEL_POPUP_BLOCKED_MESSAGE).toMatch(/Pop-up blocked/i);
  });

  it('writes approved label HTML with CODE128 svg into a pre-opened window', () => {
    const { win, write, open, closeDoc } = mockPrintWindow();
    const svg = '<svg data-testid="code128"></svg>';

    writeSpecimenLabelPrint(win, sampleLabel, svg);

    expect(open).toHaveBeenCalled();
    expect(write).toHaveBeenCalledTimes(1);
    const html = write.mock.calls[0][0] as string;
    expect(html).toContain('MRN000001');
    expect(html).toContain('Revathi Sundar');
    expect(html).toContain('LAB-20261009-000006');
    expect(html).toContain('ACC-20261011-000001');
    expect(html).toContain('SPC-20261011-000001');
    expect(html).toContain(svg);
    expect(html).toContain('window.print()');
    expect(html).not.toMatch(/DOB|dateOfBirth/i);
    expect(closeDoc).toHaveBeenCalled();
  });

  it('buildSpecimenLabelHtml omits DOB and internal GUID fields', () => {
    const html = buildSpecimenLabelHtml(sampleLabel, '<svg></svg>');
    expect(html).toContain('MRN');
    expect(html).toContain('Patient');
    expect(html).toContain('Order');
    expect(html).toContain('Collected');
    expect(html).toContain('Accession');
    expect(html).not.toMatch(/\bDOB\b|dateOfBirth|collector|GUID|receivedBy/i);
  });

  it('abandons a pre-opened window without throwing', () => {
    const { win, closeWin } = mockPrintWindow();
    abandonSpecimenLabelPrintWindow(win);
    expect(closeWin).toHaveBeenCalled();
    expect(() => abandonSpecimenLabelPrintWindow(null)).not.toThrow();
  });
});
