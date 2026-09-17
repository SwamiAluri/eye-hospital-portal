import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
const get = vi.fn();

vi.mock('@/lib/api', () => ({
  getApi: () => ({ post, get }),
}));

import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';

describe('counsellorsDeskApi.assignSession (Phase 3I Slice 3)', () => {
  beforeEach(() => {
    post.mockReset();
    get.mockReset();
  });

  it('POSTs dedicated assign endpoint with counselorId only and skips forbidden redirect', async () => {
    post.mockResolvedValue({
      data: {
        success: true,
        message: 'Session assigned successfully',
        sessionId: 'sess-1',
        counselorId: 'user-ravi',
        counselorName: 'Ravi Kumar',
      },
    });

    const result = await counsellorsDeskApi.assignSession('sess-1', 'user-ravi');

    expect(post).toHaveBeenCalledWith(
      '/Counseling/sessions/sess-1/assign',
      { counselorId: 'user-ravi' },
      { skipForbiddenRedirect: true },
    );
    expect(result.counselorId).toBe('user-ravi');
    expect(result.counselorName).toBe('Ravi Kumar');
  });

  it('getCounselors uses existing Counseling counselors lookup with optional branchId', async () => {
    get.mockResolvedValue({
      data: [
        {
          id: 'u1',
          firstName: 'Amelia',
          lastName: 'Martinez',
          name: 'Amelia Martinez',
          email: 'a@test',
        },
      ],
    });
    const list = await counsellorsDeskApi.getCounselors('branch-a');
    expect(get).toHaveBeenCalledWith('/Counseling/counselors', {
      params: { branchId: 'branch-a' },
    });
    expect(list[0].name).toBe('Amelia Martinez');
  });

  it('POSTs claim-for-lifecycle with expectedCounselorId + intent and skips forbidden redirect', async () => {
    post.mockResolvedValue({
      data: {
        success: true,
        message: 'Session claimed for lifecycle work',
        sessionId: 'sess-1',
        counselorId: 'user-amelia',
        counselorName: 'Amelia Martinez',
      },
    });

    const result = await counsellorsDeskApi.claimSessionForLifecycle('sess-1', {
      expectedCounselorId: 'user-ravi',
      intent: 'ReEvaluate',
    });

    expect(post).toHaveBeenCalledWith(
      '/Counseling/sessions/sess-1/claim-for-lifecycle',
      { expectedCounselorId: 'user-ravi', intent: 'ReEvaluate' },
      { skipForbiddenRedirect: true },
    );
    expect(result.counselorId).toBe('user-amelia');
  });

  it('POSTs claim-for-lifecycle with null expectedCounselorId for unassigned Done/Repeat', async () => {
    post.mockResolvedValue({
      data: {
        success: true,
        message: 'Session claimed for lifecycle work',
        sessionId: 'sess-2',
        counselorId: 'user-amelia',
        counselorName: 'Amelia Martinez',
      },
    });

    await counsellorsDeskApi.claimSessionForLifecycle('sess-2', {
      expectedCounselorId: null,
      intent: 'StartRepeat',
    });

    expect(post).toHaveBeenCalledWith(
      '/Counseling/sessions/sess-2/claim-for-lifecycle',
      { expectedCounselorId: null, intent: 'StartRepeat' },
      { skipForbiddenRedirect: true },
    );
  });

  it('POSTs reassign with counselorId, expectedCounselorId, reason', async () => {
    post.mockResolvedValue({
      data: {
        success: true,
        message: 'Session reassigned successfully',
        sessionId: 'sess-1',
        counselorId: 'user-ravi',
        counselorName: 'Ravi Kumar',
      },
    });

    const result = await counsellorsDeskApi.reassignSession('sess-1', {
      counselorId: 'user-ravi',
      expectedCounselorId: 'user-amelia',
      reason: 'Coverage for leave',
    });

    expect(post).toHaveBeenCalledWith(
      '/Counseling/sessions/sess-1/reassign',
      {
        counselorId: 'user-ravi',
        expectedCounselorId: 'user-amelia',
        reason: 'Coverage for leave',
      },
      { skipForbiddenRedirect: true },
    );
    expect(result.counselorId).toBe('user-ravi');
  });
});
