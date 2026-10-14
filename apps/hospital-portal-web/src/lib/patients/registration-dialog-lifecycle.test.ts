import { describe, expect, it } from 'vitest';
import {
  applyRegistrationShellDismissAttempt,
  isDuplicateReviewActive,
  isRegistrationShellVisible,
  registrationShellOpen,
  resolveRegistrationSessionRootOpen,
  shouldIgnoreRegistrationShellDismiss,
  shouldMountRegistrationWizard,
  softDuplicateHostState,
} from '@/lib/patients/registration-dialog-lifecycle';

describe('registration-dialog-lifecycle', () => {
  it('treats soft/hard/phase as duplicate-review active', () => {
    expect(
      isDuplicateReviewActive({ softOpen: true, hardOpen: false, phase: 'registration' }),
    ).toBe(true);
    expect(
      isDuplicateReviewActive({ softOpen: false, hardOpen: true, phase: 'registration' }),
    ).toBe(true);
    expect(
      isDuplicateReviewActive({
        softOpen: false,
        hardOpen: false,
        phase: 'duplicate-review',
      }),
    ).toBe(true);
    expect(
      isDuplicateReviewActive({
        softOpen: false,
        hardOpen: false,
        phase: 'registration',
      }),
    ).toBe(false);
  });

  it('shell visibility hides chrome but must not drive Dialog Root open', () => {
    expect(
      isRegistrationShellVisible({ sessionOpen: true, softOpen: true, hardOpen: false }),
    ).toBe(false);
    expect(
      isRegistrationShellVisible({ sessionOpen: true, softOpen: false, hardOpen: false }),
    ).toBe(true);
    expect(resolveRegistrationSessionRootOpen(true)).toBe(true);
    expect(resolveRegistrationSessionRootOpen(false)).toBe(false);
    expect(shouldMountRegistrationWizard(true)).toBe(true);
    expect(shouldMountRegistrationWizard(false)).toBe(false);
    // Deprecated alias kept for call-site compatibility during migration.
    expect(
      registrationShellOpen({ sessionOpen: true, softOpen: true, hardOpen: false }),
    ).toBe(false);
  });

  it('ignores registration dismiss while soft duplicate review is active', () => {
    expect(
      shouldIgnoreRegistrationShellDismiss({
        sessionOpen: true,
        softOpen: true,
        hardOpen: false,
        phase: 'duplicate-review',
      }),
    ).toBe(true);

    expect(
      applyRegistrationShellDismissAttempt({
        sessionOpen: true,
        softOpen: true,
        hardOpen: false,
        phase: 'duplicate-review',
        nextOpen: false,
      }),
    ).toBe(true);

    expect(
      shouldIgnoreRegistrationShellDismiss({
        sessionOpen: true,
        softOpen: false,
        hardOpen: false,
        phase: 'registration',
      }),
    ).toBe(false);

    expect(
      applyRegistrationShellDismissAttempt({
        sessionOpen: true,
        softOpen: false,
        hardOpen: false,
        phase: 'registration',
        nextOpen: false,
      }),
    ).toBe(false);
  });

  it('softDuplicateHostState keeps session/root/wizard mounted while shell hides', () => {
    const state = softDuplicateHostState(true);
    expect(state.sessionOpen).toBe(true);
    expect(state.rootOpen).toBe(true);
    expect(state.wizardMounted).toBe(true);
    expect(state.softOpen).toBe(true);
    expect(state.shellVisible).toBe(false);
    expect(state.phase).toBe('duplicate-review');
  });
});
