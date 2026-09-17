/**
 * Counsellor desk API uses Counseling surgeons lookup (counseling_sessions.read),
 * not broad /users/surgeons (user.view).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('counsellorsDeskApi.getSurgeons authorization contract', () => {
  it('calls /Counseling/surgeons not /users/surgeons', () => {
    const src = readFileSync(
      resolve(__dirname, '../api/counsellors-desk.api.ts'),
      'utf8',
    );
    const fn = src.slice(src.indexOf('async getSurgeons'), src.indexOf('async getAnesthetists'));
    expect(fn).toContain("/Counseling/surgeons");
    expect(fn).not.toContain("/users/surgeons");
  });
});
