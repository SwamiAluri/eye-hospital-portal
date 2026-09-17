import { describe, expect, it, vi, beforeEach } from 'vitest';

const getMock = vi.fn();

vi.mock('../api', () => ({
  getApi: () => ({ get: getMock }),
}));

// Import after mock so getApi is stubbed.
const { counsellorsDeskApi } = await import('./counsellors-desk.api');

describe('counsellorsDeskApi schedule surgery lookups', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('calls Counseling/theaters under counseling_sessions.read path (not otbooking)', async () => {
    getMock.mockResolvedValue({
      data: [{ id: 't1', theaterName: 'OT-1' }],
    });
    const theaters = await counsellorsDeskApi.getOtTheaters();
    expect(getMock).toHaveBeenCalledWith('/Counseling/theaters', { params: {} });
    expect(getMock.mock.calls[0][0]).not.toContain('otbooking');
    expect(theaters).toEqual([{ id: 't1', name: 'OT-1' }]);
  });

  it('forwards optional branchId as query param', async () => {
    getMock.mockResolvedValue({
      data: [{ id: 't1', theaterName: 'OT-1' }],
    });
    await counsellorsDeskApi.getOtTheaters('branch-1');
    expect(getMock).toHaveBeenCalledWith('/Counseling/theaters', {
      params: { branchId: 'branch-1' },
    });
  });

  it('calls Counseling/surgeons and never users/with-details', async () => {
    getMock.mockResolvedValue({ data: [{ id: 'd1', name: 'Dr Rao' }] });
    const surgeons = await counsellorsDeskApi.getSurgeons();
    expect(getMock).toHaveBeenCalledWith('/Counseling/surgeons');
    expect(getMock.mock.calls.every((c) => !String(c[0]).includes('users/with-details'))).toBe(
      true,
    );
    expect(surgeons).toEqual([{ id: 'd1', name: 'Dr Rao' }]);
  });

  it('filters empty theater/surgeon names from mapping', async () => {
    getMock.mockResolvedValue({
      data: [
        { id: 't1', theaterName: 'OT-1' },
        { id: '', theaterName: 'Broken' },
        { id: 't2', theaterName: '  ' },
      ],
    });
    const theaters = await counsellorsDeskApi.getOtTheaters();
    expect(theaters).toEqual([{ id: 't1', name: 'OT-1' }]);
  });
});
