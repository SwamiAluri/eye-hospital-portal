import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapOtRecord } from '@/lib/api/counsellors-desk.api';
import { isReportingTimeValid } from '@/lib/counsellors-desk/finalize-surgery-package1';
import { formatCounsellingTimeDisplay } from '@/lib/counsellors-desk/counselling-time';

describe('Package LA — mapOtRecord Reporting Time (UAT-FS-RT-01)', () => {
  it('maps TimeSpan reportingTime to HH:mm that passes queue Confirm validation', () => {
    const rec = mapOtRecord({
      id: 'ot-1',
      status: 'NotConfirmed',
      reportingTime: '17:00:00',
      startTime: '2026-03-26T09:00:00',
      scheduleDate: '2026-03-26',
    });
    expect(rec.reportingTime).toBe('17:00');
    expect(isReportingTimeValid(rec.reportingTime)).toBe(true);
    expect(formatCounsellingTimeDisplay(rec.reportingTime)).toBe('05:00 PM');
  });

  it('maps missing reportingTime to empty and fails validation', () => {
    const rec = mapOtRecord({
      id: 'ot-2',
      status: 'NotConfirmed',
      reportingTime: null,
    });
    expect(rec.reportingTime).toBe('');
    expect(isReportingTimeValid(rec.reportingTime)).toBe(false);
  });

  it('leaves startTime on 12h display path (unchanged by LA-01)', () => {
    const api = readFileSync(
      join(process.cwd(), 'src/lib/api/counsellors-desk.api.ts'),
      'utf8',
    );
    expect(api).toContain('startTime:        fmtOtTime(r.startTime)');
    expect(api).toContain('normalizeOtReportingTimeToHhMm(r.reportingTime)');
  });
});
