import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
const get = vi.fn();

vi.mock('@/lib/api', () => ({
  getApi: () => ({ post, get }),
}));

import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';

describe('counsellorsDeskApi.assignSession (Phase 3I Slice 3 / Slice 7)', () => {
  beforeEach(() => {
    post.mockReset();
    get.mockReset();
  });

  it('POSTs dedicated assign endpoint with counselorId + version and skips forbidden redirect', async () => {
    post.mockResolvedValue({
      data: {
        success: true,
        message: 'Session assigned successfully',
        sessionId: 'sess-1',
        counselorId: 'user-ravi',
        counselorName: 'Ravi Kumar',
        version: 4,
      },
    });

    const result = await counsellorsDeskApi.assignSession('sess-1', 'user-ravi', 3);

    expect(post).toHaveBeenCalledWith(
      '/Counseling/sessions/sess-1/assign',
      { counselorId: 'user-ravi', version: 3 },
      { skipForbiddenRedirect: true },
    );
    expect(result.counselorId).toBe('user-ravi');
    expect(result.counselorName).toBe('Ravi Kumar');
    expect(result.version).toBe(4);
  });

  it('assignSession sends version: undefined when no expected Version is supplied (waiting-list projection gap)', async () => {
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
      { counselorId: 'user-ravi', version: undefined },
      { skipForbiddenRedirect: true },
    );
    expect(result.version).toBeUndefined();
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

  it('POSTs claim-for-lifecycle with expectedCounselorId + intent + version and skips forbidden redirect', async () => {
    post.mockResolvedValue({
      data: {
        success: true,
        message: 'Session claimed for lifecycle work',
        sessionId: 'sess-1',
        counselorId: 'user-amelia',
        counselorName: 'Amelia Martinez',
        version: 6,
      },
    });

    const result = await counsellorsDeskApi.claimSessionForLifecycle('sess-1', {
      expectedCounselorId: 'user-ravi',
      intent: 'ReEvaluate',
      version: 5,
    });

    expect(post).toHaveBeenCalledWith(
      '/Counseling/sessions/sess-1/claim-for-lifecycle',
      { expectedCounselorId: 'user-ravi', intent: 'ReEvaluate', version: 5 },
      { skipForbiddenRedirect: true },
    );
    expect(result.counselorId).toBe('user-amelia');
    expect(result.version).toBe(6);
  });

  it('POSTs claim-for-lifecycle with null expectedCounselorId for unassigned Done/Repeat', async () => {
    post.mockResolvedValue({
      data: {
        success: true,
        message: 'Session claimed for lifecycle work',
        sessionId: 'sess-2',
        counselorId: 'user-amelia',
        counselorName: 'Amelia Martinez',
        version: 2,
      },
    });

    await counsellorsDeskApi.claimSessionForLifecycle('sess-2', {
      expectedCounselorId: null,
      intent: 'StartRepeat',
      version: 1,
    });

    expect(post).toHaveBeenCalledWith(
      '/Counseling/sessions/sess-2/claim-for-lifecycle',
      { expectedCounselorId: null, intent: 'StartRepeat', version: 1 },
      { skipForbiddenRedirect: true },
    );
  });

  it('POSTs reassign with counselorId, expectedCounselorId, reason, version', async () => {
    post.mockResolvedValue({
      data: {
        success: true,
        message: 'Session reassigned successfully',
        sessionId: 'sess-1',
        counselorId: 'user-ravi',
        counselorName: 'Ravi Kumar',
        version: 8,
      },
    });

    const result = await counsellorsDeskApi.reassignSession('sess-1', {
      counselorId: 'user-ravi',
      expectedCounselorId: 'user-amelia',
      reason: 'Coverage for leave',
      version: 7,
    });

    expect(post).toHaveBeenCalledWith(
      '/Counseling/sessions/sess-1/reassign',
      {
        counselorId: 'user-ravi',
        expectedCounselorId: 'user-amelia',
        reason: 'Coverage for leave',
        version: 7,
      },
      { skipForbiddenRedirect: true },
    );
    expect(result.counselorId).toBe('user-ravi');
    expect(result.version).toBe(8);
  });
});
