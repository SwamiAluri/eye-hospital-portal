import { describe, expect, it, vi, beforeEach } from 'vitest';

const getMock = vi.fn();

vi.mock('@/lib/api', () => ({
  getApi: () => ({ get: getMock }),
}));

import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';

describe('WL-01 waiting list branchId', () => {
  beforeEach(() => {
    getMock.mockReset();
    getMock.mockResolvedValue({ data: [] });
  });

  it('sends selected branchId on getWaitingList', async () => {
    await counsellorsDeskApi.getWaitingList({
      fromDate: '',
      toDate: '',
      patientName: '',
      mrd: '',
      type: 'All',
      status: '',
      branchId: 'branch-abc',
    });

    expect(getMock).toHaveBeenCalledWith('/Counseling/waiting-list', {
      params: { branchId: 'branch-abc' },
    });
  });

  it('omits branchId when empty (existing optional BE contract)', async () => {
    await counsellorsDeskApi.getWaitingList({
      fromDate: '',
      toDate: '',
      patientName: '',
      mrd: '',
      type: 'All',
      status: '',
      branchId: '  ',
    });

    expect(getMock).toHaveBeenCalledWith('/Counseling/waiting-list', {
      params: {},
    });
  });

  it('includes search filters with branchId', async () => {
    await counsellorsDeskApi.getWaitingList({
      fromDate: '2026-09-01',
      toDate: '2026-09-10',
      patientName: 'Rao',
      mrd: 'UH1',
      type: 'All',
      status: '',
      branchId: 'b1',
    });

    expect(getMock).toHaveBeenCalledWith('/Counseling/waiting-list', {
      params: {
        fromDate: '2026-09-01',
        toDate: '2026-09-10',
        patientName: 'Rao',
        mrd: 'UH1',
        branchId: 'b1',
      },
    });
  });
});
