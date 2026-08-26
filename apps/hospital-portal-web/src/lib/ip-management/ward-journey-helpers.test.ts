import { describe, expect, it } from 'vitest';
import { canCancelAdmission, canCancelTodaySurgery } from './ward-journey-helpers';

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

describe('canCancelAdmission', () => {
  const base = {
    clinicalState: 'Expected',
    isLocked: false,
    isPatientMerged: false,
  };

  it('allows Expected only', () => {
    expect(canCancelAdmission(base)).toBe(true);
    expect(canCancelAdmission({ ...base, clinicalState: 'Admitted' })).toBe(false);
  });

  it('blocks locked or merged journeys', () => {
    expect(canCancelAdmission({ ...base, isLocked: true })).toBe(false);
    expect(canCancelAdmission({ ...base, isPatientMerged: true })).toBe(false);
  });
});
