import { describe, expect, it } from 'vitest';
import {
  formatCounsellingTimeDisplay,
  normalizeOtReportingTimeToHhMm,
  parseCounsellingTimeParts,
  partsToHhMm,
  type CounsellingTimeParts,
} from './counselling-time';
import { isReportingTimeValid } from './finalize-surgery-package1';

describe('counselling-time', () => {
  it('formats HH:mm to 12-hour display', () => {
    expect(formatCounsellingTimeDisplay('07:14')).toBe('07:14 AM');
    expect(formatCounsellingTimeDisplay('19:14')).toBe('07:14 PM');
    expect(formatCounsellingTimeDisplay('00:00')).toBe('12:00 AM');
    expect(formatCounsellingTimeDisplay('12:30')).toBe('12:30 PM');
  });

  it('returns empty placeholder for missing values', () => {
    expect(formatCounsellingTimeDisplay('')).toBe('');
    expect(formatCounsellingTimeDisplay(undefined)).toBe('');
  });

  it('parses HH:mm into hour/minute/period parts', () => {
    expect(parseCounsellingTimeParts('19:14')).toEqual({
      hour12: 7,
      minute: 14,
      period: 'PM',
    } satisfies CounsellingTimeParts);
    expect(parseCounsellingTimeParts('00:05')).toEqual({
      hour12: 12,
      minute: 5,
      period: 'AM',
    });
  });

  it('converts parts back to HH:mm for API payload', () => {
    expect(partsToHhMm({ hour12: 7, minute: 14, period: 'PM' })).toBe('19:14');
    expect(partsToHhMm({ hour12: 12, minute: 0, period: 'AM' })).toBe('00:00');
    expect(partsToHhMm({ hour12: 12, minute: 30, period: 'PM' })).toBe('12:30');
  });
});

/** Package LA / UAT-FS-RT-01 — list validation must use machine-readable HH:mm. */
describe('normalizeOtReportingTimeToHhMm (LA-01)', () => {
  it('maps TimeSpan HH:mm:ss to HH:mm', () => {
    expect(normalizeOtReportingTimeToHhMm('17:00:00')).toBe('17:00');
    expect(normalizeOtReportingTimeToHhMm('05:00:00')).toBe('05:00');
  });

  it('keeps already-normalized HH:mm', () => {
    expect(normalizeOtReportingTimeToHhMm('17:00')).toBe('17:00');
  });

  it('maps ISO datetime to local HH:mm', () => {
    const iso = '2026-03-26T17:00:00';
    const expected = `${String(new Date(iso).getHours()).padStart(2, '0')}:${String(new Date(iso).getMinutes()).padStart(2, '0')}`;
    expect(normalizeOtReportingTimeToHhMm(iso)).toBe(expected);
  });

  it('returns empty for missing values', () => {
    expect(normalizeOtReportingTimeToHhMm('')).toBe('');
    expect(normalizeOtReportingTimeToHhMm(null)).toBe('');
    expect(normalizeOtReportingTimeToHhMm(undefined)).toBe('');
  });

  it('does not invent HH:mm from display-only 12h strings', () => {
    expect(normalizeOtReportingTimeToHhMm('05:00 PM')).toBe('');
  });

  it('normalized TimeSpan passes queue Confirm validation and 12h display remains available', () => {
    const machine = normalizeOtReportingTimeToHhMm('17:00:00');
    expect(isReportingTimeValid(machine)).toBe(true);
    expect(formatCounsellingTimeDisplay(machine)).toBe('05:00 PM');
  });

  it('missing reporting time fails queue validation', () => {
    expect(isReportingTimeValid(normalizeOtReportingTimeToHhMm(null))).toBe(false);
  });
});
