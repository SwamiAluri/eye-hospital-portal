import { describe, expect, it } from 'vitest';
import {
  computeFastingStatus,
  formatFastingDuration,
  hoursSinceNpo,
  normalizeIntakeType,
} from './preop-fasting';

describe('preop-fasting', () => {
  const now = new Date('2026-06-30T12:00:00');

  it('normalizes intake type aliases', () => {
    expect(normalizeIntakeType('clear')).toBe('clear');
    expect(normalizeIntakeType('solid')).toBe('solid');
    expect(normalizeIntakeType(null)).toBe('light');
    expect(normalizeIntakeType('')).toBe('light');
  });

  it('confirms solid intake at 8h threshold', () => {
    const npo = new Date(now.getTime() - 8 * 3_600_000).toISOString();
    const status = computeFastingStatus({ npoValue: npo, intakeType: 'solid', now });
    expect(status.confirmed).toBe(true);
    expect(status.status).toBe('confirmed');
  });

  it('flags inadequate fasting below threshold', () => {
    const npo = new Date(now.getTime() - 3 * 3_600_000).toISOString();
    const status = computeFastingStatus({ npoValue: npo, intakeType: 'solid', now });
    expect(status.inadequate).toBe(true);
    expect(status.confirmed).toBe(false);
    expect(status.status).toBe('inadequate');
  });

  it('treats >24h as stale — never confirmed', () => {
    const npo = new Date(now.getTime() - 25 * 3_600_000).toISOString();
    const status = computeFastingStatus({ npoValue: npo, intakeType: 'light', now });
    expect(status.stale).toBe(true);
    expect(status.confirmed).toBe(false);
    expect(status.status).toBe('stale');
  });

  it('uses clear-fluid 2h threshold', () => {
    const npo = new Date(now.getTime() - 2.5 * 3_600_000).toISOString();
    const status = computeFastingStatus({ npoValue: npo, intakeType: 'clear', now });
    expect(status.confirmed).toBe(true);
    expect(status.threshold).toBe(2);
  });

  it('formats duration for display', () => {
    expect(formatFastingDuration(8.25)).toBe('8h 15m');
    expect(hoursSinceNpo('', now)).toBeNull();
  });
});
