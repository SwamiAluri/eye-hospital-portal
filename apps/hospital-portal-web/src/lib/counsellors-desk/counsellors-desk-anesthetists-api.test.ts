/**
 * Finalize OT modal loads anaesthetists via Counseling lookup (counseling_sessions.read),
 * not broad /users/anesthetists (user.view) — same least-privilege pattern as surgeons.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('counsellorsDeskApi.getAnesthetists authorization contract', () => {
  it('calls /Counseling/anesthetists not /users/anesthetists', () => {
    const src = readFileSync(
      resolve(__dirname, '../api/counsellors-desk.api.ts'),
      'utf8',
    );
    const start = src.indexOf('async getAnesthetists');
    const end = src.indexOf('async getOtTheaters', start);
    const fn = src.slice(start, end);
    expect(fn).toContain("/Counseling/anesthetists");
    expect(fn).not.toMatch(/get\(['"`]\/users\/anesthetists/);
  });

  it('FinalizeOtModal loads anesthetists via counsellorsDeskApi (not users path)', () => {
    const src = readFileSync(
      resolve(__dirname, '../../components/counsellors-desk/FinalizeOtModal.tsx'),
      'utf8',
    );
    expect(src).toContain('counsellorsDeskApi.getAnesthetists');
    expect(src).not.toContain('/users/anesthetists');
  });
});

const getMock = vi.fn();

vi.mock('../api', () => ({
  getApi: () => ({ get: getMock }),
}));

const { counsellorsDeskApi } = await import('../api/counsellors-desk.api');

describe('counsellorsDeskApi.getAnesthetists runtime path', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('calls Counseling/anesthetists under counseling_sessions.read path', async () => {
    getMock.mockResolvedValue({
      data: [{ id: 'a1', name: 'Dr Ana' }],
    });
    const list = await counsellorsDeskApi.getAnesthetists();
    expect(getMock).toHaveBeenCalledWith('/Counseling/anesthetists');
    expect(getMock.mock.calls.every((c) => !String(c[0]).includes('/users/anesthetists'))).toBe(
      true,
    );
    expect(list).toEqual([{ id: 'a1', name: 'Dr Ana' }]);
  });

  it('filters empty id/name options', async () => {
    getMock.mockResolvedValue({
      data: [
        { id: 'a1', name: 'Dr Ana' },
        { id: '', name: 'Broken' },
        { id: 'a2', name: '  ' },
      ],
    });
    const list = await counsellorsDeskApi.getAnesthetists();
    expect(list).toEqual([{ id: 'a1', name: 'Dr Ana' }]);
  });
});
