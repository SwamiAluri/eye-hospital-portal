import { describe, expect, it } from 'vitest';
import { mapRepeatCounsellingFollowUp } from './waiting-list-follow-up';

describe('mapRepeatCounsellingFollowUp', () => {
  it('maps DecisionDate + ReasonsForDelay only for RepeatCounselling', () => {
    expect(
      mapRepeatCounsellingFollowUp({
        status: 'RepeatCounselling',
        decisionDate: '2026-08-20T10:00:00Z',
        reasonsForDelay: 'Needs time to decide',
      }),
    ).toEqual({
      followUpDate: '2026-08-20',
      followUpReason: 'Needs time to decide',
    });
  });

  it('returns empty follow-up for non-repeat statuses', () => {
    expect(
      mapRepeatCounsellingFollowUp({
        status: 'Done',
        decisionDate: '2026-08-20T10:00:00Z',
        reasonsForDelay: 'n/a',
      }),
    ).toEqual({ followUpDate: undefined, followUpReason: undefined });
  });

  it('omits blank reason / missing date', () => {
    expect(
      mapRepeatCounsellingFollowUp({
        status: 'RepeatCounselling',
        decisionDate: null,
        reasonsForDelay: '  ',
      }),
    ).toEqual({ followUpDate: undefined, followUpReason: undefined });
  });
});
