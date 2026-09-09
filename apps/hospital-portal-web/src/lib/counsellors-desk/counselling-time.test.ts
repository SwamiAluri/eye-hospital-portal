import { describe, expect, it } from 'vitest';
import {
  formatCounsellingTimeDisplay,
  parseCounsellingTimeParts,
  partsToHhMm,
  type CounsellingTimeParts,
} from './counselling-time';

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
