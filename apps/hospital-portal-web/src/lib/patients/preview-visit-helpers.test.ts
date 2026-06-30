import { describe, expect, it } from 'vitest';

import { inferVisitLaterality } from '@/lib/patients/preview-visit-helpers';

describe('preview-visit-helpers', () => {
  it('infers OD from reason text', () => {
    expect(inferVisitLaterality('Cataract OD review', null)).toBe('OD');
  });

  it('infers OS from procedure name', () => {
    expect(inferVisitLaterality(null, 'Phaco OS')).toBe('OS');
  });

  it('prefers OU when both eyes mentioned', () => {
    expect(inferVisitLaterality('Bilateral OU screening', null)).toBe('OU');
  });

  it('returns null when no laterality cue', () => {
    expect(inferVisitLaterality('Routine follow-up', null)).toBeNull();
  });
});
