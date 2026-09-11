import { describe, expect, it } from 'vitest';
import { resolveCounsellingPrintDisabledReason } from './counselling-print-gate';

describe('CS-03 counselling print gate', () => {
  it('allows print on Finish summary even when RepeatCounselling', () => {
    expect(
      resolveCounsellingPrintDisabledReason({
        isRepeatState: true,
        finishSummaryActive: true,
        canPrintEstimate: true,
      }),
    ).toBeNull();
  });

  it('blocks print on Repeat before Finish / after Start Session gate', () => {
    expect(
      resolveCounsellingPrintDisabledReason({
        isRepeatState: true,
        finishSummaryActive: false,
        canPrintEstimate: true,
      }),
    ).toBe('Start repeat session to continue');
  });

  it('requires estimate content when Finish is active', () => {
    expect(
      resolveCounsellingPrintDisabledReason({
        isRepeatState: true,
        finishSummaryActive: true,
        canPrintEstimate: false,
      }),
    ).toBe('Select a procedure or package to print an estimate');
  });
});
