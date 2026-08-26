import { describe, expect, it } from 'vitest';
import { isOtMutationConflict, requireOtJourneyMutationResult } from './ot-mutation-result';

describe('requireOtJourneyMutationResult', () => {
  it('returns a successful journey mutation', () => {
    const data = { id: 'j1', clinicalState: 'InOT', otState: 'InProgress' };
    expect(requireOtJourneyMutationResult(data, 'failed')).toEqual(data);
  });

  it('does not treat an error envelope as success', () => {
    expect(() => requireOtJourneyMutationResult(
      { error: 'Billing clearance is required before accepting the patient in OT.' },
      'failed',
    )).toThrow('Billing clearance is required before accepting the patient in OT.');
  });

  it('marks concurrency conflict envelopes', () => {
    try {
      requireOtJourneyMutationResult(
        { error: 'This journey was updated by another user. Reload and try again.' },
        'failed',
      );
      throw new Error('expected throw');
    } catch (e) {
      expect(isOtMutationConflict(e)).toBe(true);
    }
  });

  it('rejects empty or non-journey bodies', () => {
    expect(() => requireOtJourneyMutationResult(null, 'Clinical transition failed.')).toThrow(
      'Clinical transition failed.',
    );
    expect(() => requireOtJourneyMutationResult({}, 'Clinical transition failed.')).toThrow(
      'Clinical transition failed.',
    );
  });
});
