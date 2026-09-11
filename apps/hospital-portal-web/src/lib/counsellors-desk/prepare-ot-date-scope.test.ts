import { describe, expect, it } from 'vitest';
import type { FinalizeSurgeryRecord } from '@/types/counsellors-desk';
import {
  isValidPrepareOtSurgeryDate,
  selectFinalisedForPrepareDate,
} from './prepare-ot-date-scope';

function rec(
  overrides: Partial<FinalizeSurgeryRecord> & Pick<FinalizeSurgeryRecord, 'id' | 'status'>,
): FinalizeSurgeryRecord {
  return {
    uhid: 'U1',
    patientName: 'P',
    surgeryName: 'Phaco',
    eyes: 'RE',
    patientType: 'Cash',
    paymentMode: 'Cash',
    surgeon: 'Dr',
    startTime: '09:00',
    theaterName: 'OT-1',
    version: 1,
    isLocked: false,
    scheduleDate: '2026-09-10',
    ...overrides,
  } as FinalizeSurgeryRecord;
}

describe('FS-02 prepare OT date scope (frontend)', () => {
  it('rejects empty / invalid surgery dates', () => {
    expect(isValidPrepareOtSurgeryDate('')).toBe(false);
    expect(isValidPrepareOtSurgeryDate(null)).toBe(false);
    expect(isValidPrepareOtSurgeryDate(undefined)).toBe(false);
    expect(isValidPrepareOtSurgeryDate('not-a-date')).toBe(false);
    expect(isValidPrepareOtSurgeryDate('2026-09-10')).toBe(true);
  });

  it('selects only Finalised rows for the selected date', () => {
    const records = [
      rec({ id: 'a', status: 'Finalised', scheduleDate: '2026-09-10' }),
      rec({ id: 'b', status: 'Finalised', scheduleDate: '2026-09-11' }),
      rec({ id: 'c', status: 'Confirmed', scheduleDate: '2026-09-10' }),
      rec({ id: 'd', status: 'OTPrepared', scheduleDate: '2026-09-10' }),
    ];

    const scoped = selectFinalisedForPrepareDate(records, '2026-09-10');
    expect(scoped.map((r) => r.id)).toEqual(['a']);
  });

  it('returns empty when date missing — never all Finalised', () => {
    const records = [
      rec({ id: 'a', status: 'Finalised', scheduleDate: '2026-09-10' }),
      rec({ id: 'b', status: 'Finalised', scheduleDate: '2026-09-11' }),
    ];
    expect(selectFinalisedForPrepareDate(records, '')).toEqual([]);
    expect(selectFinalisedForPrepareDate(records, null)).toEqual([]);
  });
});
