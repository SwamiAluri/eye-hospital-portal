import { describe, expect, it, vi } from 'vitest';
import {
  buildOtSlipSectionHtml,
  buildOtSlipsPrintDocumentHtml,
  openOtSlipsPrint,
  selectedOtPreparedRecordsInOrder,
} from './ot-slip-print';
import type { FinalizeSurgeryRecord } from '@/types/counsellors-desk';

function row(
  partial: Partial<FinalizeSurgeryRecord> & Pick<FinalizeSurgeryRecord, 'id' | 'patientName'>,
): FinalizeSurgeryRecord {
  return {
    uhid: 'UH1',
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
    scheduleDate: '2026-09-24',
    reportingTime: '08:00',
    anesthesiaType: 'LA',
    packageName: 'Std',
    packageRate: 15000,
    ...partial,
  };
}

describe('OT Slip print — single + bulk (OT Prepared)', () => {
  it('builds one OT Slip section with existing authoritative fields', () => {
    const html = buildOtSlipSectionHtml(
      row({
        id: 'a',
        patientName: 'Ravi Kumar',
        uhid: 'UHID-9',
        surgeryName: 'Phaco + IOL',
        eyes: 'OS',
        surgeon: 'Dr. Rao',
        theaterName: 'OT-2',
        startTime: '08:30 AM',
        reportingTime: '07:30',
        anesthesiaType: 'GA',
        packageName: 'Premium',
        packageRate: 25000,
        patientType: 'Insurance',
        paymentMode: 'TPA',
        status: 'OTPrepared',
        scheduleDate: '2026-09-24',
      }),
    );
    expect(html).toContain('OT Slip');
    expect(html).toContain('Ravi Kumar');
    expect(html).toContain('UHID-9');
    expect(html).toContain('Phaco + IOL');
    expect(html).toContain('OS');
    expect(html).toContain('Dr. Rao');
    expect(html).toContain('OT-2');
    expect(html).toContain('08:30 AM');
    expect(html).toMatch(/Reporting Time/i);
    expect(html).toContain('GA');
    expect(html).toContain('Premium');
    expect(html).toContain('Insurance');
    expect(html).toContain('TPA');
    expect(html).toContain('OTPrepared');
  });

  it('bulk document prints only provided records and page-breaks between slips', () => {
    const html = buildOtSlipsPrintDocumentHtml([
      row({ id: 'a', patientName: 'Patient A' }),
      row({ id: 'b', patientName: 'Patient B' }),
      row({ id: 'c', patientName: 'Patient C' }),
    ]);
    expect(html).toContain('Patient A');
    expect(html).toContain('Patient B');
    expect(html).toContain('Patient C');
    expect(html).not.toContain('Patient D');
    // one patient = one printed page
    expect(html).toMatch(/page-break-after:\s*always|break-after:\s*page/i);
    const slipCount = (html.match(/class="ot-slip"/g) ?? []).length;
    expect(slipCount).toBe(3);
  });

  it('excludes SPA chrome and worklist controls from print HTML', () => {
    const html = buildOtSlipsPrintDocumentHtml([row({ id: 'a', patientName: 'A' })]);
    expect(html).not.toMatch(/sidebar/i);
    expect(html).not.toMatch(/Reopen/i);
    expect(html).not.toMatch(/Select all/i);
    expect(html).not.toMatch(/Print OT Slips/i);
    expect(html).not.toMatch(/checkbox/i);
    expect(html).not.toMatch(/pagination/i);
    expect(html).not.toMatch(/finalize-ot-prep-print-prepared/);
    expect(html).not.toContain('OT Preparation — Prepared List');
  });

  it('empty selection builds truthful empty document (no fabricated slips)', () => {
    const html = buildOtSlipsPrintDocumentHtml([]);
    expect(html).toContain('No OT Prepared surgeries selected for print.');
    expect(html).not.toMatch(/class="ot-slip"/);
  });

  it('selectedOtPreparedRecordsInOrder returns only selected ids in worklist order', () => {
    const list = [
      row({ id: '1', patientName: 'A' }),
      row({ id: '2', patientName: 'B' }),
      row({ id: '3', patientName: 'C' }),
    ];
    const selected = selectedOtPreparedRecordsInOrder(list, new Set(['3', '1']));
    expect(selected.map((r) => r.id)).toEqual(['1', '3']);
    expect(selected.map((r) => r.patientName)).toEqual(['A', 'C']);
  });

  it('openOtSlipsPrint writes dedicated document for selected records', async () => {
    const write = vi.fn();
    const openWindow = vi.fn().mockReturnValue({
      document: { write, close: vi.fn() },
    });
    const result = openOtSlipsPrint([row({ id: 'a', patientName: 'Only Selected' })], {
      openWindow,
    });
    expect(result.opened).toBe(true);
    expect(result.slipCount).toBe(1);
    expect(write.mock.calls[0][0]).toContain('Only Selected');
    expect(write.mock.calls[0][0]).toContain('OT Slip');
  });

  it('escapes HTML in patient-facing fields', () => {
    const html = buildOtSlipSectionHtml(
      row({ id: 'x', patientName: '<script>x</script>' }),
    );
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
