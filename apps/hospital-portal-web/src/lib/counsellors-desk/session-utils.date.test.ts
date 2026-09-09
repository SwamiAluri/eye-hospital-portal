import { describe, expect, it } from 'vitest';
import {
  formatCounsellingDateLabel,
  toCounsellingDateOnly,
} from './session-utils';

describe('toCounsellingDateOnly', () => {
  it('keeps already-normalized yyyy-MM-dd', () => {
    expect(toCounsellingDateOnly('2026-09-07')).toBe('2026-09-07');
  });

  it('strips ISO datetime / Z / space-separated forms to date-only', () => {
    expect(toCounsellingDateOnly('2026-09-07T00:00:00')).toBe('2026-09-07');
    expect(toCounsellingDateOnly('2026-09-07T08:14:00.000Z')).toBe('2026-09-07');
    expect(toCounsellingDateOnly('2026-09-07 00:00:00')).toBe('2026-09-07');
  });

  it('returns empty for blank or unusable values', () => {
    expect(toCounsellingDateOnly('')).toBe('');
    expect(toCounsellingDateOnly(null)).toBe('');
    expect(toCounsellingDateOnly(undefined)).toBe('');
    expect(toCounsellingDateOnly('not-a-date')).toBe('');
    expect(toCounsellingDateOnly('Invalid Date')).toBe('');
  });
});

describe('formatCounsellingDateLabel', () => {
  it('formats a valid date without throwing', () => {
    expect(formatCounsellingDateLabel('2026-09-07', 'yyyy-MM-dd')).toBe('2026-09-07');
  });

  it('formats ISO datetime inputs safely', () => {
    expect(formatCounsellingDateLabel('2026-09-07T08:14:00', 'yyyy-MM-dd')).toBe('2026-09-07');
  });

  it('returns null for invalid dates instead of throwing', () => {
    expect(() => formatCounsellingDateLabel('not-a-date')).not.toThrow();
    expect(formatCounsellingDateLabel('')).toBeNull();
    expect(formatCounsellingDateLabel('Invalid Date')).toBeNull();
  });
});
