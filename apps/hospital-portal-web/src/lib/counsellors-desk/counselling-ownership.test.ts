import { describe, expect, it } from 'vitest';
import {
  COUNSELLING_CONTENT_READ_ONLY_REASON,
  isCounsellingSessionOwner,
  isOwnershipReadOnly,
  isPendingLifecycleReadOnly,
  resolveCompleteSessionDisabledReason,
  resolveLifecycleOwnershipDecision,
  resolveOwnershipRelation,
  resolveSaveDraftDisabledReason,
} from './counselling-ownership';

describe('counselling-ownership', () => {
  it('resolves unassigned / current / other', () => {
    expect(resolveOwnershipRelation(null, 'u1')).toBe('unassigned');
    expect(resolveOwnershipRelation('u1', 'u1')).toBe('current');
    expect(resolveOwnershipRelation('U1', 'u1')).toBe('current');
    expect(resolveOwnershipRelation('u2', 'u1')).toBe('other');
  });

  it('lifecycle ownership: current continues; NULL/other claim; no peer target', () => {
    expect(
      resolveLifecycleOwnershipDecision({
        counselorId: 'amelia',
        currentUserId: 'amelia',
        canAssignToMe: true,
      }),
    ).toEqual({ path: 'continue' });
    expect(
      resolveLifecycleOwnershipDecision({
        counselorId: null,
        currentUserId: 'amelia',
        canAssignToMe: true,
      }),
    ).toEqual({ path: 'claim', expectedCounselorId: null });
    expect(
      resolveLifecycleOwnershipDecision({
        counselorId: 'emma',
        currentUserId: 'amelia',
        canAssignToMe: true,
      }),
    ).toEqual({ path: 'claim', expectedCounselorId: 'emma' });
    expect(
      resolveLifecycleOwnershipDecision({
        counselorId: 'emma',
        currentUserId: 'amelia',
        canAssignToMe: false,
      }),
    ).toEqual({ path: 'blocked', reason: 'not-counsellor' });
  });

  it('isCounsellingSessionOwner requires both ids', () => {
    expect(isCounsellingSessionOwner(null, 'u1')).toBe(false);
    expect(isCounsellingSessionOwner('u1', null)).toBe(false);
    expect(isCounsellingSessionOwner('u1', 'u1')).toBe(true);
  });

  it('ownership read-only for other owner and unassigned Pending/Processed', () => {
    expect(
      isOwnershipReadOnly({
        counselorId: 'emma',
        currentUserId: 'amelia',
        queueStatus: 'Processed',
      }),
    ).toBe(true);
    expect(
      isOwnershipReadOnly({
        counselorId: null,
        currentUserId: 'amelia',
        queueStatus: 'Processed',
      }),
    ).toBe(true);
    expect(
      isOwnershipReadOnly({
        counselorId: null,
        currentUserId: 'amelia',
        queueStatus: 'Pending',
      }),
    ).toBe(true);
    expect(
      isOwnershipReadOnly({
        counselorId: 'amelia',
        currentUserId: 'amelia',
        queueStatus: 'Processed',
      }),
    ).toBe(false);
    expect(
      isOwnershipReadOnly({
        counselorId: null,
        currentUserId: 'amelia',
        queueStatus: 'Done',
      }),
    ).toBe(false);
  });

  it('PD-PENDING-READONLY-01: Pending seals content edits; Processing does not', () => {
    expect(isPendingLifecycleReadOnly('Pending')).toBe(true);
    expect(isPendingLifecycleReadOnly('Processed')).toBe(false);
    expect(isPendingLifecycleReadOnly('Done')).toBe(false);
    expect(isPendingLifecycleReadOnly(null)).toBe(false);
    // Ownership alone must not leave current-owner Pending editable.
    expect(
      isOwnershipReadOnly({
        counselorId: 'amelia',
        currentUserId: 'amelia',
        queueStatus: 'Pending',
      }),
    ).toBe(false);
    expect(
      isPendingLifecycleReadOnly('Pending') ||
        isOwnershipReadOnly({
          counselorId: 'amelia',
          currentUserId: 'amelia',
          queueStatus: 'Pending',
        }),
    ).toBe(true);
  });

  describe('Save Draft / Complete Session mutation gates (UAT non-owner viewer)', () => {
    const idle = {
      isSurgeryDoneState: false,
      pendingLocksMutations: false,
      ownershipLocksMutations: false,
      isSaving: false,
      isSavingDraft: false,
      isRepeatState: false,
    };

    it('current owner + Processing: Save Draft remains usable', () => {
      const ownershipLocksMutations = isOwnershipReadOnly({
        counselorId: 'amelia',
        currentUserId: 'amelia',
        queueStatus: 'Processed',
      });
      expect(ownershipLocksMutations).toBe(false);
      expect(
        resolveSaveDraftDisabledReason({ ...idle, ownershipLocksMutations }),
      ).toBeNull();
    });

    it('non-owner viewer + Processing: Save Draft not usable', () => {
      const ownershipLocksMutations = isOwnershipReadOnly({
        counselorId: 'amelia',
        currentUserId: 'admin',
        queueStatus: 'Processed',
      });
      expect(ownershipLocksMutations).toBe(true);
      expect(
        resolveSaveDraftDisabledReason({ ...idle, ownershipLocksMutations }),
      ).toBe(COUNSELLING_CONTENT_READ_ONLY_REASON);
    });

    it('Admin/non-owner viewer: Save Draft and Complete Session not usable', () => {
      const ownershipLocksMutations = isOwnershipReadOnly({
        counselorId: 'amelia',
        currentUserId: 'admin',
        queueStatus: 'Processed',
      });
      expect(
        resolveSaveDraftDisabledReason({ ...idle, ownershipLocksMutations }),
      ).toBe(COUNSELLING_CONTENT_READ_ONLY_REASON);
      expect(
        resolveCompleteSessionDisabledReason({
          isSurgeryDoneState: false,
          pendingLocksMutations: false,
          ownershipLocksMutations,
          isSaving: false,
          isSavingDraft: false,
          decisionValidationError: null,
        }),
      ).toBe(COUNSELLING_CONTENT_READ_ONLY_REASON);
    });

    it('Pending: existing read-only Save Draft reason remains unchanged', () => {
      expect(
        resolveSaveDraftDisabledReason({
          ...idle,
          pendingLocksMutations: true,
          ownershipLocksMutations: false,
        }),
      ).toBe('Start counselling to continue');
    });
  });
});
