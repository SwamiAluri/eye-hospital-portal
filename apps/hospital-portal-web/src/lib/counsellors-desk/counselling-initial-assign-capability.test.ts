import { describe, expect, it } from 'vitest';
import {
  canShowCounsellingAssignToMe,
  canShowCounsellingInitialAssign,
  isAdminInitialAssignActor,
  isCounsellorIdentity,
  isWaitingListEligibleForInitialAssign,
  COUNSELLING_SESSIONS_UPDATE_PERMISSION,
} from './counselling-auth';

describe('PD-ASSIGN-01 / UAT — initial Assign UI capability', () => {
  it('exports counseling_sessions.update as mutate permission', () => {
    expect(COUNSELLING_SESSIONS_UPDATE_PERMISSION).toBe('counseling_sessions.update');
  });

  it('authorized counsellor sees Assign', () => {
    expect(
      canShowCounsellingInitialAssign({
        hasUpdatePermission: true,
        roles: ['Counsellor'],
        userType: 'Staff',
      }),
    ).toBe(true);
    expect(
      canShowCounsellingAssignToMe({ roles: ['Counsellor'], userType: 'Staff' }),
    ).toBe(true);
  });

  it('System Administrator with update sees Assign but not Assign to me', () => {
    expect(isAdminInitialAssignActor({ roles: ['System Administrator'], userType: 'Admin' })).toBe(
      true,
    );
    expect(isCounsellorIdentity({ roles: ['System Administrator'], userType: 'Admin' })).toBe(
      false,
    );
    expect(
      canShowCounsellingInitialAssign({
        hasUpdatePermission: true,
        roles: ['System Administrator'],
        userType: 'Admin',
      }),
    ).toBe(true);
    expect(
      canShowCounsellingAssignToMe({
        roles: ['System Administrator'],
        userType: 'Admin',
      }),
    ).toBe(false);
  });

  it('counsellor who also holds Admin sees Assign to me', () => {
    expect(
      canShowCounsellingAssignToMe({
        roles: ['Counsellor', 'Admin'],
        userType: 'Admin',
      }),
    ).toBe(true);
  });

  it('user without update permission does not see Assign', () => {
    expect(
      canShowCounsellingInitialAssign({
        hasUpdatePermission: false,
        roles: ['Counsellor'],
        userType: 'Counsellor',
      }),
    ).toBe(false);
  });

  it('eligibility is Pending + Unassigned only', () => {
    expect(
      isWaitingListEligibleForInitialAssign({ status: 'Pending', counselorId: null }),
    ).toBe(true);
    expect(
      isWaitingListEligibleForInitialAssign({ status: 'Done', counselorId: null }),
    ).toBe(false);
    expect(
      isWaitingListEligibleForInitialAssign({ status: 'RepeatCounselling', counselorId: null }),
    ).toBe(false);
    expect(
      isWaitingListEligibleForInitialAssign({ status: 'Pending', counselorId: 'c1' }),
    ).toBe(false);
    expect(
      isWaitingListEligibleForInitialAssign({ status: 'Processed', counselorId: null }),
    ).toBe(false);
    expect(
      isWaitingListEligibleForInitialAssign({ status: 'SurgeryDone', counselorId: null }),
    ).toBe(false);
  });
});
