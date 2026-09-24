import { describe, expect, it } from 'vitest';
import {
  buildLifecycleOwnershipConfirmCopy,
  formatCounsellorDisplayName,
  shouldOpenProcessingAfterAssign,
} from './lifecycle-ownership-confirm';

describe('lifecycle ownership confirm helpers', () => {
  it('formats counsellor display name', () => {
    expect(
      formatCounsellorDisplayName({ firstName: 'Olivia', lastName: 'Robinson' }),
    ).toBe('Olivia Robinson');
    expect(formatCounsellorDisplayName({ fallback: 'Counsellor' })).toBe('Counsellor');
  });

  it('builds Continue as me copy for Done/Repeat claim', () => {
    expect(
      buildLifecycleOwnershipConfirmCopy({
        kind: 're-evaluate',
        currentOwnerName: 'Amelia Martinez',
        continueAsName: 'Olivia Robinson',
      }),
    ).toEqual({
      title: 'Re-evaluate Session',
      currentOwnerLabel: 'Amelia Martinez',
      continueAsLabel: 'Olivia Robinson',
      confirmText: 'Continue as me',
    });

    expect(
      buildLifecycleOwnershipConfirmCopy({
        kind: 'start-repeat',
        currentOwnerName: null,
        continueAsName: 'Olivia Robinson',
      }),
    ).toMatchObject({
      title: 'Start Repeat Session',
      currentOwnerLabel: 'Unassigned',
      confirmText: 'Continue as me',
    });
  });

  it('opens Processing workflow only after self-assign', () => {
    expect(
      shouldOpenProcessingAfterAssign({
        sessionStatus: 'Processed',
        assignedCounselorId: 'me',
        currentUserId: 'me',
      }),
    ).toBe(true);
    expect(
      shouldOpenProcessingAfterAssign({
        sessionStatus: 'Processed',
        assignedCounselorId: 'peer',
        currentUserId: 'me',
      }),
    ).toBe(false);
    expect(
      shouldOpenProcessingAfterAssign({
        sessionStatus: 'Pending',
        assignedCounselorId: 'me',
        currentUserId: 'me',
      }),
    ).toBe(false);
  });
});
