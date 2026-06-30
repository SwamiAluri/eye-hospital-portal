import { describe, expect, it } from 'vitest';
import {
  deriveSectionDisplayStatus,
  isSectionLockedAtExpected,
} from './section-display-status';

describe('deriveSectionDisplayStatus', () => {
  it('locks Evaluation and Anaesthesia at Expected', () => {
    expect(isSectionLockedAtExpected('Expected', 'Evaluation')).toBe(true);
    expect(isSectionLockedAtExpected('Expected', 'Anaesthesia')).toBe(true);
    expect(isSectionLockedAtExpected('Expected', 'Consent')).toBe(false);
    expect(isSectionLockedAtExpected('Admitted', 'Evaluation')).toBe(false);

    expect(
      deriveSectionDisplayStatus({
        clinicalState: 'Expected',
        category: 'Evaluation',
        items: [],
      }),
    ).toBe('Locked');
  });

  it('maps backend coordination statuses', () => {
    expect(
      deriveSectionDisplayStatus({
        clinicalState: 'Admitted',
        category: 'Consent',
        sectionClearance: { status: 'Requested' } as never,
        items: [],
      }),
    ).toBe('AwaitingDepartment');

    expect(
      deriveSectionDisplayStatus({
        clinicalState: 'Admitted',
        category: 'Consent',
        sectionClearance: { status: 'RespondedClear' } as never,
        items: [],
      }),
    ).toBe('ReadyToConfirm');

    expect(
      deriveSectionDisplayStatus({
        clinicalState: 'Admitted',
        category: 'Consent',
        sectionClearance: { status: 'WardConfirmed' } as never,
        items: [],
      }),
    ).toBe('Complete');
  });

  it('derives item progress when section not requested', () => {
    const items = [
      { isBlocking: true, isCompleted: true, isBypassed: false },
      { isBlocking: true, isCompleted: false, isBypassed: false },
    ] as never[];

    expect(
      deriveSectionDisplayStatus({
        clinicalState: 'Expected',
        category: 'Consent',
        items,
      }),
    ).toBe('PartiallyComplete');
  });
});
