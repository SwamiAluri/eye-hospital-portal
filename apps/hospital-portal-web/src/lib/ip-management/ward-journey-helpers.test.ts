import { describe, expect, it } from 'vitest';
import { canCancelTodaySurgery } from './ward-journey-helpers';

describe('canCancelTodaySurgery', () => {
  const base = {
    clinicalState: 'Admitted',
    otState: 'NotSent',
    isLocked: false,
    isPatientMerged: false,
  };

  it('allows Expected through SentToOT (NotSent/SentToOT ot state)', () => {
    expect(canCancelTodaySurgery({ ...base, clinicalState: 'Expected' })).toBe(true);
    expect(canCancelTodaySurgery({ ...base, clinicalState: 'SentToOT', otState: 'SentToOT' })).toBe(true);
  });

  it('blocks after OT accepted', () => {
    expect(canCancelTodaySurgery({ ...base, clinicalState: 'SentToOT', otState: 'Accepted' })).toBe(false);
  });

  it('blocks merged MR and locked journeys', () => {
    expect(canCancelTodaySurgery({ ...base, isPatientMerged: true })).toBe(false);
    expect(canCancelTodaySurgery({ ...base, isLocked: true })).toBe(false);
  });
});
