import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import {
  COUNSELLING_SESSIONS_REASSIGN_PERMISSION,
  COUNSELLING_SESSIONS_UPDATE_PERMISSION,
  canShowCounsellingReassign,
  isWaitingListEligibleForReassign,
} from '@/lib/counsellors-desk/counselling-auth';

describe('Phase 3I Slice 6 — counselling reassign auth helpers', () => {
  it('uses dedicated reassign permission distinct from update', () => {
    expect(COUNSELLING_SESSIONS_REASSIGN_PERMISSION).toBe(
      'counseling_sessions.reassign',
    );
    expect(COUNSELLING_SESSIONS_REASSIGN_PERMISSION).not.toBe(
      COUNSELLING_SESSIONS_UPDATE_PERMISSION,
    );
  });

  it('shows Reassign only when reassign permission is present', () => {
    expect(
      canShowCounsellingReassign({ hasReassignPermission: true }),
    ).toBe(true);
    expect(
      canShowCounsellingReassign({ hasReassignPermission: false }),
    ).toBe(false);
  });

  it('eligibility requires owned Pending or Processed only', () => {
    expect(
      isWaitingListEligibleForReassign({
        status: 'Pending',
        counselorId: 'a',
      }),
    ).toBe(true);
    expect(
      isWaitingListEligibleForReassign({
        status: 'Processed',
        counselorId: 'a',
      }),
    ).toBe(true);
    expect(
      isWaitingListEligibleForReassign({
        status: 'Pending',
        counselorId: null,
      }),
    ).toBe(false);
    expect(
      isWaitingListEligibleForReassign({
        status: 'Done',
        counselorId: 'a',
      }),
    ).toBe(false);
    expect(
      isWaitingListEligibleForReassign({
        status: 'RepeatCounselling',
        counselorId: 'a',
      }),
    ).toBe(false);
  });

  it('WaitingListWorkRow wires reassign without role-name Supervisor checks', () => {
    const src = readFileSync(
      resolve(__dirname, '../../components/counsellors-desk/waiting-list/WaitingListWorkRow.tsx'),
      'utf8',
    );
    expect(src).toContain('waiting-list-row-reassign');
    expect(src).toContain('canReassign');
    expect(src).not.toMatch(/Supervisor/);
  });

  it('WaitingListReassignDialog posts expectedCounselorId + reason', () => {
    const src = readFileSync(
      resolve(
        __dirname,
        '../../components/counsellors-desk/waiting-list/WaitingListReassignDialog.tsx',
      ),
      'utf8',
    );
    expect(src).toContain('reassignSession');
    expect(src).toContain('expectedCounselorId');
    expect(src).toContain('reason: resolved.reason');
    expect(src).toContain('Reason is required');
    // Phase 3I Slice 7 (PD-S7-06): 409s (ownership or stale Version) go through the shared
    // concurrency helper instead of a hardcoded status check.
    expect(src).toContain('isSessionConcurrencyConflict');
    expect(src).not.toContain('reasonCode');
    expect(src).not.toContain('reasonId');
  });
});

