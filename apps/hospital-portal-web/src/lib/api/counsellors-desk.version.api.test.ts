import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
const put = vi.fn();
const get = vi.fn();

vi.mock('@/lib/api', () => ({
  getApi: () => ({ post, put, get }),
}));

import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';

/**
 * Phase 3I Slice 7 (PD-S7-01/02) — every CounselingSession mutation covered by this slice must
 * send the expected `version` in its request body and surface the server's bumped `version` (or
 * `sessionVersion` for comm logs) from the response.
 */
describe('counsellorsDeskApi — Version concurrency (Phase 3I Slice 7)', () => {
  beforeEach(() => {
    post.mockReset();
    put.mockReset();
    get.mockReset();
  });

  it('startSession sends version + optional sessionType and returns the bumped version from session', async () => {
    post.mockResolvedValue({
      data: { success: true, message: 'ok', session: { version: 4 } },
    });

    const result = await counsellorsDeskApi.startSession('sess-1', 'FOLLOW_UP', 3);

    expect(post).toHaveBeenCalledWith('/Counseling/sessions/sess-1/start', {
      version: 3,
      sessionType: 'Followup',
    });
    expect(result.version).toBe(4);
  });

  it('startSession omits sessionType but still sends version when no sessionType is given', async () => {
    post.mockResolvedValue({
      data: { success: true, message: 'ok', session: { version: 2 } },
    });

    const result = await counsellorsDeskApi.startSession('sess-1', undefined, 1);

    expect(post).toHaveBeenCalledWith('/Counseling/sessions/sess-1/start', { version: 1 });
    expect(result.version).toBe(2);
  });

  it('completeSession sends version and returns the bumped version from session', async () => {
    post.mockResolvedValue({
      data: { success: true, message: 'ok', session: { version: 9 } },
    });

    const result = await counsellorsDeskApi.completeSession('sess-1', 8);

    expect(post).toHaveBeenCalledWith('/Counseling/sessions/sess-1/complete', { version: 8 });
    expect(result.version).toBe(9);
  });

  it('refreshSessionFromOpd sends version and returns the bumped version', async () => {
    post.mockResolvedValue({
      data: { procedureName: 'Phaco', biometryMissing: false, version: 12 },
    });

    const result = await counsellorsDeskApi.refreshSessionFromOpd('sess-1', 11);

    expect(post).toHaveBeenCalledWith('/Counseling/sessions/sess-1/refresh-from-opd', {
      version: 11,
    });
    expect(result.version).toBe(12);
  });

  it('logCommunication sends version and returns sessionVersion from the response', async () => {
    post.mockResolvedValue({
      data: {
        id: 'log-1',
        channel: 'Phone',
        direction: 'Outbound',
        outcome: 'Answered',
        communicationAt: '2026-09-18T10:00:00Z',
        messageBody: null,
        nextAction: null,
        nextActionDate: null,
        callDurationMinutes: null,
        sessionVersion: 5,
      },
    });

    const result = await counsellorsDeskApi.logCommunication('sess-1', {
      version: 4,
      channel: 'Phone',
      outcome: 'Answered',
    });

    expect(post).toHaveBeenCalledWith('/Counseling/sessions/sess-1/communication-logs', {
      version: 4,
      channel: 'Phone',
      outcome: 'Answered',
      direction: 'Outbound',
    });
    expect(result.sessionVersion).toBe(5);
  });

  it('saveSession includes version in the PUT body and returns the bumped version', async () => {
    put.mockResolvedValue({ data: { session: { version: 3 } } });

    const result = await counsellorsDeskApi.saveSession('sess-1', {
      version: 2,
      counsellorNotes: 'note',
    } as never);

    expect(put).toHaveBeenCalledWith(
      '/Counseling/sessions/sess-1',
      expect.objectContaining({ version: 2 }),
      { skipForbiddenRedirect: true },
    );
    expect(result.version).toBe(3);
  });

  it('saveSession skips forbidden redirect so in-session ownership 403 stays local (not Access Denied)', async () => {
    put.mockResolvedValue({ data: { session: { version: 1 } } });

    await counsellorsDeskApi.saveSession('sess-1', { version: 1 } as never);

    expect(put).toHaveBeenCalledWith(
      '/Counseling/sessions/sess-1',
      expect.anything(),
      { skipForbiddenRedirect: true },
    );
  });
});
