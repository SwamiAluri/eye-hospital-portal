import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Patient360RecordTable, formatPatient360Date, formatPatient360DateTime } from '@/components/patients/record/Patient360RecordTable';

describe('Patient360RecordTable rendering contract', () => {
  it('keeps column headers and one status row when there are no records', () => {
    const html = renderToStaticMarkup(
      <Patient360RecordTable
        caption="OPD vitals"
        columns={[{ header: 'Date' }, { header: 'BP' }, { header: 'Source' }]}
        rows={[]}
        emptyState="No OPD vitals recorded."
      />,
    );
    expect(html).toContain('<table');
    expect(html).toContain('>Date<');
    expect(html).toContain('>BP<');
    expect(html).toContain('>Source<');
    expect(html).toContain('colSpan="3"');
    expect(html).toContain('No OPD vitals recorded.');
    expect(html).toContain('role="status"');
  });
});

describe('formatPatient360Date', () => {
  it('omits a midnight time component on date-only values', () => {
    expect(formatPatient360Date('2026-02-05 00:00')).toBe('05 Feb 2026');
    expect(formatPatient360Date('2026-02-04T00:00:00')).toBe('04 Feb 2026');
    expect(formatPatient360Date('2026-02-05')).toBe('05 Feb 2026');
  });

  it('keeps a meaningful clock time', () => {
    expect(formatPatient360Date('2026-09-02 09:00')).toBe('02 Sep 2026 09:00');
  });
});

describe('formatPatient360DateTime', () => {
  it('renders canonical createdAt as date and time without using the filename', () => {
    expect(formatPatient360DateTime('2026-10-06T14:31:00')).toBe('06 Oct 2026 · 02:31 PM');
    expect(formatPatient360DateTime('2026-10-06T10:00:00Z')).toBe('06 Oct 2026 · 10:00 AM');
    expect(formatPatient360DateTime('id-scan.pdf')).toBe('id-scan.pdf');
    expect(formatPatient360DateTime('2026-10-06')).toBe('06 Oct 2026');
  });
});
