import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_AUTHORIZED_BRANCH_LABEL,
  ANALYTICS_MY_WORK_LABEL,
  analyticsCounselorScopeLabel,
  resolveInitialAnalyticsCounselorId,
} from './analytics-scope';

describe('Phase 3I Slice 11 analytics scope (PD-S11-08)', () => {
  const userId = '48a94c56-ccb2-49c0-9916-bee2703b0251';

  it('normal counsellor (no reassign) defaults to My Work = current user id', () => {
    expect(
      resolveInitialAnalyticsCounselorId({
        hasReassignPermission: false,
        currentUserId: userId,
      }),
    ).toBe(userId);
  });

  it('reassign-capable user defaults to Authorized Branch (null counselorId)', () => {
    expect(
      resolveInitialAnalyticsCounselorId({
        hasReassignPermission: true,
        currentUserId: userId,
      }),
    ).toBeNull();
  });

  it('without user id and without reassign, stays null until id is known', () => {
    expect(
      resolveInitialAnalyticsCounselorId({
        hasReassignPermission: false,
        currentUserId: null,
      }),
    ).toBeNull();
  });

  it('aggregate label is Authorized Branch, not All counselors', () => {
    expect(ANALYTICS_AUTHORIZED_BRANCH_LABEL).toBe('Authorized Branch');
    expect(ANALYTICS_AUTHORIZED_BRANCH_LABEL).not.toBe('All counselors');
    expect(
      analyticsCounselorScopeLabel({
        counselorId: null,
        currentUserId: userId,
      }),
    ).toBe(ANALYTICS_AUTHORIZED_BRANCH_LABEL);
  });

  it('current user scope labels as My Work', () => {
    expect(
      analyticsCounselorScopeLabel({
        counselorId: userId,
        currentUserId: userId,
        selectedCounselorName: 'Amelia Martinez',
      }),
    ).toBe(ANALYTICS_MY_WORK_LABEL);
  });

  it('peer counselor scope uses peer display name', () => {
    expect(
      analyticsCounselorScopeLabel({
        counselorId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        currentUserId: userId,
        selectedCounselorName: 'Ravi Kumar',
      }),
    ).toBe('Ravi Kumar');
  });
});
