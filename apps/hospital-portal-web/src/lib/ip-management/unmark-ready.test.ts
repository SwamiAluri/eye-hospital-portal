import { describe, expect, it } from 'vitest';
import { canUnmarkReady } from './unmark-ready';
import { resolveIpRoleActions } from './ip-role-actions';

describe('canUnmarkReady', () => {
  const ready = {
    clinicalState: 'ReadyForSurgery',
    otState: 'NotSent',
    isLocked: false,
  };

  it('allows ReadyForSurgery while not sent when the permission is present', () => {
    const actions = resolveIpRoleActions(['ip.ot.unmark_ready']);
    expect(canUnmarkReady(ready, actions)).toBe(true);
  });

  it('rejects without permission, after send, or when locked', () => {
    const withPerm = resolveIpRoleActions(['ip.ot.unmark_ready']);
    const wardOnly = resolveIpRoleActions(['ward.checklist.edit']);
    expect(canUnmarkReady(ready, wardOnly)).toBe(false);
    expect(canUnmarkReady({ ...ready, otState: 'SentToOT' }, withPerm)).toBe(false);
    expect(canUnmarkReady({ ...ready, isLocked: true }, withPerm)).toBe(false);
    expect(canUnmarkReady({ ...ready, clinicalState: 'Admitted' }, withPerm)).toBe(false);
  });
});
