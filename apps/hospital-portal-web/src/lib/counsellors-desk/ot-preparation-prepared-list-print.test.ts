import { describe, expect, it, vi } from 'vitest';
import {
  buildOtPreparationPreparedListPrintHtml,
  formatOtPrepPrintSurgeryDate,
  openOtPreparationPreparedListPrint,
  sortOtPreparedForPrint,
} from './ot-preparation-prepared-list-print';
import type { FinalizeSurgeryRecord } from '@/types/counsellors-desk';

function row(partial: Partial<FinalizeSurgeryRecord> & Pick<FinalizeSurgeryRecord, 'id'>): FinalizeSurgeryRecord {
  return {
    uhid: 'UH1',
    patientName: 'Patient',
    surgeryName: 'Phaco',
    eyes: 'OD',
    patientType: 'Cash',
    paymentMode: 'Cash',
    surgeon: 'Dr. A',
    startTime: '09:00 AM',
    theaterName: 'OT-1',
    status: 'OTPrepared',
    version: 1,
    isLocked: true,
    sequenceNo: 1,
    scheduleDate: '2026-09-24',
    ...partial,
  };
}

describe('Package B — OT Preparation prepared-list print', () => {
  it('formats surgery date for print header', () => {
    expect(formatOtPrepPrintSurgeryDate('2026-09-24')).toMatch(/24/);
    expect(formatOtPrepPrintSurgeryDate('')).toBe('—');
  });

  it('sorts by SequenceNo ascending then name', () => {
    const sorted = sortOtPreparedForPrint([
      row({ id: 'b', sequenceNo: 2, patientName: 'B' }),
      row({ id: 'a', sequenceNo: 1, patientName: 'A' }),
      row({ id: 'c', sequenceNo: undefined, patientName: 'C' }),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('builds dedicated HTML with surgery date and authoritative fields', () => {
    const html = buildOtPreparationPreparedListPrintHtml({
      surgeryDate: '2026-09-24',
      records: [
        row({
          id: '1',
          sequenceNo: 1,
          patientName: 'Ravi Kumar',
          uhid: 'UHID-9',
          surgeryName: 'Phaco + IOL',
          eyes: 'OS',
          startTime: '08:30 AM',
          surgeon: 'Dr. Rao',
          theaterName: 'OT-2',
          status: 'OTPrepared',
        }),
      ],
    });
    expect(html).toContain('OT Preparation — Prepared List');
    expect(html).toContain('Surgery Date');
    expect(html).toMatch(/24/);
    expect(html).toContain('Ravi Kumar');
    expect(html).toContain('UHID-9');
    expect(html).toContain('Phaco + IOL');
    expect(html).toContain('OS');
    expect(html).toContain('08:30 AM');
    expect(html).toContain('Dr. Rao');
    expect(html).toContain('OT-2');
    expect(html).toContain('OTPrepared');
    expect(html).toContain('>1<');
  });

  it('renders truthful empty state when no prepared rows', () => {
    const html = buildOtPreparationPreparedListPrintHtml({
      surgeryDate: '2026-09-24',
      records: [],
    });
    expect(html).toContain('No prepared OT surgeries for this surgery date.');
    expect(html).not.toContain('<tbody>');
  });

  it('excludes SPA chrome / RESP2 screen controls from print HTML', () => {
    const html = buildOtPreparationPreparedListPrintHtml({
      surgeryDate: '2026-09-24',
      records: [row({ id: '1' })],
    });
    expect(html).not.toMatch(/Prepare OT/i);
    expect(html).not.toMatch(/Select all/i);
    expect(html).not.toMatch(/sidebar/i);
    expect(html).not.toMatch(/checkbox/i);
    expect(html).not.toMatch(/pagination/i);
    expect(html).not.toMatch(/finalize-ot-prep/i);
  });

  it('escapes HTML in patient-facing fields', () => {
    const html = buildOtPreparationPreparedListPrintHtml({
      surgeryDate: '2026-09-24',
      records: [row({ id: '1', patientName: '<script>x</script>' })],
    });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('openOtPreparationPreparedListPrint loads getOtList for selected date and writes dedicated HTML', async () => {
    const fetchPreparedList = vi.fn().mockResolvedValue([
      row({ id: 'p1', sequenceNo: 3, patientName: 'Prepared One', scheduleDate: '2026-09-24' }),
    ]);
    const write = vi.fn();
    const close = vi.fn();
    const openWindow = vi.fn().mockReturnValue({
      document: { write, close },
    });

    const result = await openOtPreparationPreparedListPrint('2026-09-24', {
      fetchPreparedList,
      openWindow,
    });

    expect(fetchPreparedList).toHaveBeenCalledWith('2026-09-24');
    expect(result.opened).toBe(true);
    expect(result.recordCount).toBe(1);
    expect(write).toHaveBeenCalledTimes(1);
    const html = write.mock.calls[0][0] as string;
    expect(html).toContain('OT Preparation — Prepared List');
    expect(html).toContain('Prepared One');
    expect(html).toContain('Surgery Date');
    expect(close).toHaveBeenCalled();
  });

  it('openOtPreparationPreparedListPrint still opens empty dedicated document when no prepared rows', async () => {
    const fetchPreparedList = vi.fn().mockResolvedValue([]);
    const write = vi.fn();
    const openWindow = vi.fn().mockReturnValue({
      document: { write, close: vi.fn() },
    });

    const result = await openOtPreparationPreparedListPrint('2026-09-25', {
      fetchPreparedList,
      openWindow,
    });

    expect(result.opened).toBe(true);
    expect(result.recordCount).toBe(0);
    expect(write.mock.calls[0][0]).toContain(
      'No prepared OT surgeries for this surgery date.',
    );
  });
});