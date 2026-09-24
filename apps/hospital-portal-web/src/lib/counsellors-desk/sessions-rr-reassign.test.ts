import { describe, expect, it } from 'vitest';
import { canShowSessionsRrReassign } from './sessions-rr-reassign';
import { isWaitingListEligibleForReassign } from './counselling-auth';

describe('Phase 3I Slice 13 Package B — Sessions RR Reassign gating', () => {
  it('shows Reassign only when RR filter is on, permission granted, and owner present', () => {
    expect(
      canShowSessionsRrReassign({
        reassignmentRequiredFilter: true,
        hasReassignPermission: true,
        counselorId: 'owner-1',
      }),
    ).toBe(true);
  });

  it('hides Reassign when RR filter is off (no frontend-only RR predicate)', () => {
    expect(
      canShowSessionsRrReassign({
        reassignmentRequiredFilter: false,
        hasReassignPermission: true,
        counselorId: 'owner-1',
      }),
    ).toBe(false);
  });

  it('hides Reassign without counseling_sessions.reassign permission', () => {
    expect(
      canShowSessionsRrReassign({
        reassignmentRequiredFilter: true,
        hasReassignPermission: false,
        counselorId: 'owner-1',
      }),
    ).toBe(false);
  });

  it('hides Reassign when CounselorId is missing', () => {
    expect(
      canShowSessionsRrReassign({
        reassignmentRequiredFilter: true,
        hasReassignPermission: true,
        counselorId: null,
      }),
    ).toBe(false);
  });

  it('does not broaden Waiting List Reassign eligibility (PD-S13-D = C)', () => {
    expect(
      isWaitingListEligibleForReassign({
        status: 'Pending',
        counselorId: 'owner-1',
      }),
    ).toBe(true);
    expect(
      isWaitingListEligibleForReassign({
        status: 'Processed',
        counselorId: 'owner-1',
      }),
    ).toBe(true);
    expect(
      isWaitingListEligibleForReassign({
        status: 'Done',
        counselorId: 'owner-1',
      }),
    ).toBe(false);
    expect(
      isWaitingListEligibleForReassign({
        status: 'RepeatCounselling',
        counselorId: 'owner-1',
      }),
    ).toBe(false);
  });
});
