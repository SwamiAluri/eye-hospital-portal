/**
 * Add Patient dialog lifecycle helpers.
 *
 * SESSION open (PatientHubPage addPatientOpen) owns wizard mount lifetime.
 * SHELL visibility may hide registration chrome during soft/hard review.
 * They must never be conflated: hiding the shell must not close the session
 * or remount AddPatientWizard (which resets to empty PERSONAL).
 */

export type RegistrationDialogPhase = 'registration' | 'duplicate-review';

/** True while soft/hard duplicate UI owns the transaction. */
export function isDuplicateReviewActive(args: {
  softOpen: boolean;
  hardOpen: boolean;
  phase: RegistrationDialogPhase;
}): boolean {
  return args.softOpen || args.hardOpen || args.phase === 'duplicate-review';
}

/**
 * Dialog Root `open` must track the parent registration SESSION only.
 * Never pass shell visibility here — that tears down DialogPortal and remounts the wizard.
 */
export function resolveRegistrationSessionRootOpen(sessionOpen: boolean): boolean {
  return sessionOpen;
}

/** Wizard mount gate — session open only (never shell visibility). */
export function shouldMountRegistrationWizard(sessionOpen: boolean): boolean {
  return sessionOpen;
}

/**
 * Whether Radix registration Dialog onOpenChange(false) must be ignored.
 * Session stays open for the whole soft/hard review transaction.
 */
export function shouldIgnoreRegistrationShellDismiss(args: {
  sessionOpen: boolean;
  softOpen: boolean;
  hardOpen: boolean;
  phase: RegistrationDialogPhase;
}): boolean {
  if (!args.sessionOpen) return false;
  return isDuplicateReviewActive({
    softOpen: args.softOpen,
    hardOpen: args.hardOpen,
    phase: args.phase,
  });
}

/**
 * Apply a Radix registration-shell dismiss attempt.
 * Returns the next session-open value (unchanged while duplicate review is active).
 */
export function applyRegistrationShellDismissAttempt(args: {
  sessionOpen: boolean;
  softOpen: boolean;
  hardOpen: boolean;
  phase: RegistrationDialogPhase;
  nextOpen: boolean;
}): boolean {
  if (
    !args.nextOpen &&
    shouldIgnoreRegistrationShellDismiss({
      sessionOpen: args.sessionOpen,
      softOpen: args.softOpen,
      hardOpen: args.hardOpen,
      phase: args.phase,
    })
  ) {
    return args.sessionOpen;
  }
  return args.nextOpen;
}

/**
 * Whether the registration chrome should be visually interactive/visible.
 * This is NOT the Dialog Root `open` prop — Root must stay bound to session open.
 */
export function isRegistrationShellVisible(args: {
  sessionOpen: boolean;
  softOpen: boolean;
  hardOpen: boolean;
}): boolean {
  return args.sessionOpen && !args.softOpen && !args.hardOpen;
}

/** @deprecated Use isRegistrationShellVisible — shell must not drive Dialog Root open. */
export function registrationShellOpen(args: {
  sessionOpen: boolean;
  softOpen: boolean;
  hardOpen: boolean;
}): boolean {
  return isRegistrationShellVisible(args);
}

/**
 * Canonical post–Confirm & Create soft-duplicate host state.
 * Session stays open; shell hides; wizard remains mounted.
 */
export function softDuplicateHostState(sessionOpen = true): {
  sessionOpen: boolean;
  softOpen: boolean;
  hardOpen: boolean;
  phase: RegistrationDialogPhase;
  shellVisible: boolean;
  wizardMounted: boolean;
  rootOpen: boolean;
} {
  const softOpen = true;
  const hardOpen = false;
  const phase: RegistrationDialogPhase = 'duplicate-review';
  return {
    sessionOpen,
    softOpen,
    hardOpen,
    phase,
    shellVisible: isRegistrationShellVisible({ sessionOpen, softOpen, hardOpen }),
    wizardMounted: shouldMountRegistrationWizard(sessionOpen),
    rootOpen: resolveRegistrationSessionRootOpen(sessionOpen),
  };
}
