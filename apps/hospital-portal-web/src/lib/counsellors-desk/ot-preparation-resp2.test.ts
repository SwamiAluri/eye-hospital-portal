import { describe, expect, it } from 'vitest';
import type { FinalizeSurgeryRecord } from '@/types/counsellors-desk';
import {
  buildContinuedPrepareItems,
  collectDistinctScheduleDates,
  filterFinalisedForOtPrepWorklist,
  highestOtPreparedSequenceForDate,
  reconcileSelectionToVisible,
  resolveSinglePrepareScheduleDate,
  selectAllVisibleIds,
  selectedRecordsInWorklistOrder,
} from './ot-preparation-resp2';

function rec(
  overrides: Partial<FinalizeSurgeryRecord> & Pick<FinalizeSurgeryRecord, 'id' | 'status'>,
): FinalizeSurgeryRecord {
  return {
    uhid: 'U1',
    patientName: 'Patient',
    surgeryName: 'Phaco',
    eyes: 'RE',
    patientType: 'Cash',
    paymentMode: 'Cash',
    surgeon: 'Dr',
    startTime: '09:00',
    theaterName: 'OT-1',
    version: 1,
    isLocked: false,
    scheduleDate: '2026-09-25',
    ...overrides,
  } as FinalizeSurgeryRecord;
}

describe('RESP2 Finalised worklist filter', () => {
  const rows = [
    rec({ id: 'a', status: 'Finalised', scheduleDate: '2026-09-25', uhid: 'UH-1', patientName: 'Ada' }),
    rec({ id: 'b', status: 'Finalised', scheduleDate: '2026-09-26', uhid: 'UH-2', patientName: 'Bob' }),
    rec({ id: 'c', status: 'OTPrepared', scheduleDate: '2026-09-25', uhid: 'UH-3', patientName: 'Cara' }),
    rec({ id: 'd', status: 'Confirmed', scheduleDate: '2026-09-25', uhid: 'UH-4', patientName: 'Dan' }),
  ];

  it('includes only Finalised rows', () => {
    expect(filterFinalisedForOtPrepWorklist(rows, {}).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('applies date / uhid / name filters', () => {
    expect(filterFinalisedForOtPrepWorklist(rows, { date: '2026-09-25' }).map((r) => r.id)).toEqual([
      'a',
    ]);
    expect(filterFinalisedForOtPrepWorklist(rows, { uhid: 'uh-2' }).map((r) => r.id)).toEqual(['b']);
    expect(filterFinalisedForOtPrepWorklist(rows, { name: 'ada' }).map((r) => r.id)).toEqual(['a']);
  });
});

describe('RESP2 same-ScheduleDate constraint', () => {
  const rows = [
    rec({ id: 'a', status: 'Finalised', scheduleDate: '2026-09-25' }),
    rec({ id: 'b', status: 'Finalised', scheduleDate: '2026-09-26' }),
    rec({ id: 'c', status: 'Finalised', scheduleDate: '2026-09-25' }),
  ];

  it('accepts single-date selection', () => {
    expect(resolveSinglePrepareScheduleDate(rows, new Set(['a', 'c']))).toEqual({
      ok: true,
      date: '2026-09-25',
    });
  });

  it('blocks mixed-date selection', () => {
    expect(resolveSinglePrepareScheduleDate(rows, new Set(['a', 'b']))).toEqual({
      ok: false,
      reason: 'mixed',
    });
    expect(collectDistinctScheduleDates(rows, ['a', 'b'])).toEqual(['2026-09-25', '2026-09-26']);
  });

  it('rejects empty selection', () => {
    expect(resolveSinglePrepareScheduleDate(rows, new Set())).toEqual({
      ok: false,
      reason: 'empty',
    });
  });
});

describe('RESP2 Select all visible (current page)', () => {
  it('selects only visible eligible Finalised ids', () => {
    const visible = [
      rec({ id: 'a', status: 'Finalised' }),
      rec({ id: 'b', status: 'Finalised' }),
      rec({ id: 'c', status: 'OTPrepared' }),
    ];
    expect([...selectAllVisibleIds(visible)].sort()).toEqual(['a', 'b']);
  });

  it('reconciles selection to current page visible ids', () => {
    const selected = new Set(['a', 'b', 'z']);
    expect([...reconcileSelectionToVisible(selected, ['b', 'c'])].sort()).toEqual(['b']);
  });
});

describe('RESP2 SequenceNo continuation', () => {
  const records = [
    rec({ id: 'p1', status: 'OTPrepared', scheduleDate: '2026-09-25', sequenceNo: 1 }),
    rec({ id: 'p2', status: 'OTPrepared', scheduleDate: '2026-09-25', sequenceNo: 2 }),
    rec({ id: 'p3', status: 'OTPrepared', scheduleDate: '2026-09-26', sequenceNo: 9 }),
    rec({ id: 'f1', status: 'Finalised', scheduleDate: '2026-09-25' }),
    rec({ id: 'f2', status: 'Finalised', scheduleDate: '2026-09-25' }),
  ];

  it('returns highest SequenceNo for the ScheduleDate only', () => {
    expect(highestOtPreparedSequenceForDate(records, '2026-09-25')).toBe(2);
    expect(highestOtPreparedSequenceForDate(records, '2026-09-26')).toBe(9);
    expect(highestOtPreparedSequenceForDate(records, '2026-09-27')).toBe(0);
  });

  it('treats null SequenceNo as 0 and continues from max', () => {
    const withNull = [
      rec({ id: 'p0', status: 'OTPrepared', scheduleDate: '2026-09-25', sequenceNo: undefined }),
      rec({ id: 'p1', status: 'OTPrepared', scheduleDate: '2026-09-25', sequenceNo: 3 }),
    ];
    expect(highestOtPreparedSequenceForDate(withNull, '2026-09-25')).toBe(3);
  });

  it('assigns continued sequences in worklist order, not selection-set iteration order', () => {
    const worklist = [
      rec({ id: 'f2', status: 'Finalised', scheduleDate: '2026-09-25', patientName: 'Second' }),
      rec({ id: 'f1', status: 'Finalised', scheduleDate: '2026-09-25', patientName: 'First' }),
    ];
    // Selection set insertion order reversed — worklist order must win.
    const selected = new Set(['f1', 'f2']);
    const ordered = selectedRecordsInWorklistOrder(worklist, selected);
    expect(ordered.map((r) => r.id)).toEqual(['f2', 'f1']);
    const items = buildContinuedPrepareItems(ordered, 2);
    expect(items).toEqual([
      { scheduleId: 'f2', sequence: 3 },
      { scheduleId: 'f1', sequence: 4 },
    ]);
  });

  it('does not use checkbox click order when building items', () => {
    const worklist = [
      rec({ id: 'a', status: 'Finalised', scheduleDate: '2026-09-25' }),
      rec({ id: 'b', status: 'Finalised', scheduleDate: '2026-09-25' }),
      rec({ id: 'c', status: 'Finalised', scheduleDate: '2026-09-25' }),
    ];
    // Click order would be c then a; worklist order is a, c
    const clickOrder = ['c', 'a'];
    const selected = new Set(clickOrder);
    const ordered = selectedRecordsInWorklistOrder(worklist, selected);
    expect(ordered.map((r) => r.id)).toEqual(['a', 'c']);
    expect(buildContinuedPrepareItems(ordered, 0).map((i) => i.scheduleId)).toEqual(['a', 'c']);
  });
});
