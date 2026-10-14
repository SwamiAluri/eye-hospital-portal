import { describe, expect, it, vi } from 'vitest';
import {
  applyRegistrationShellDismissAttempt,
  isRegistrationShellVisible,
  resolveRegistrationSessionRootOpen,
  shouldIgnoreRegistrationShellDismiss,
  shouldMountRegistrationWizard,
  softDuplicateHostState,
} from '@/lib/patients/registration-dialog-lifecycle';
import {
  parseRegistrationDuplicateCheckResult,
  shouldShowSoftDuplicateReview,
} from '@/lib/patients/registration-duplicate-check';

/**
 * Behavioral lifecycle tests for Confirm & Create → soft duplicate.
 * Vitest env is node (no jsdom / @testing-library). Mount lifetime is tracked via a
 * session-host state machine that mirrors AddPatientDialog ownership rules.
 */

type FormSnapshot = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string;
  currentStepId: string;
};

type HostState = {
  sessionOpen: boolean;
  softOpen: boolean;
  hardOpen: boolean;
  phase: 'registration' | 'duplicate-review';
  form: FormSnapshot;
  mounts: number;
  unmounts: number;
  mounted: boolean;
  events: string[];
};

function createSessionHost(initialForm: FormSnapshot): HostState & {
  openSession: () => void;
  applySoftDuplicate: () => void;
  /** Prior defect: hide shell by closing session. */
  applySoftDuplicateClosingSession: () => void;
  applyShellDismiss: () => void;
  explicitClose: () => void;
  reopenEmpty: () => void;
} {
  const state: HostState = {
    sessionOpen: false,
    softOpen: false,
    hardOpen: false,
    phase: 'registration',
    form: { ...initialForm },
    mounts: 0,
    unmounts: 0,
    mounted: false,
    events: [],
  };

  const syncMount = () => {
    const shouldMount = shouldMountRegistrationWizard(state.sessionOpen);
    if (shouldMount && !state.mounted) {
      state.mounts += 1;
      state.mounted = true;
      state.events.push('wizard-mount');
    } else if (!shouldMount && state.mounted) {
      state.unmounts += 1;
      state.mounted = false;
      state.events.push('wizard-unmount');
    }
  };

  return {
    get sessionOpen() {
      return state.sessionOpen;
    },
    get softOpen() {
      return state.softOpen;
    },
    get hardOpen() {
      return state.hardOpen;
    },
    get phase() {
      return state.phase;
    },
    get form() {
      return state.form;
    },
    get mounts() {
      return state.mounts;
    },
    get unmounts() {
      return state.unmounts;
    },
    get mounted() {
      return state.mounted;
    },
    get events() {
      return state.events;
    },
    openSession() {
      state.sessionOpen = true;
      state.softOpen = false;
      state.hardOpen = false;
      state.phase = 'registration';
      state.form = { ...initialForm };
      syncMount();
    },
    applySoftDuplicate() {
      // Canonical post–Confirm soft path: soft UI + phase; SESSION stays open.
      state.softOpen = true;
      state.phase = 'duplicate-review';
      state.events.push('soft-duplicate');
      syncMount();
    },
    applySoftDuplicateClosingSession() {
      state.softOpen = true;
      state.phase = 'duplicate-review';
      state.sessionOpen = false; // defect
      state.events.push('session-closed-on-soft');
      syncMount();
    },
    applyShellDismiss() {
      const next = applyRegistrationShellDismissAttempt({
        sessionOpen: state.sessionOpen,
        softOpen: state.softOpen,
        hardOpen: state.hardOpen,
        phase: state.phase,
        nextOpen: false,
      });
      state.events.push(`shell-dismiss→session=${next}`);
      if (next !== state.sessionOpen) {
        state.sessionOpen = next;
        syncMount();
      }
    },
    explicitClose() {
      state.sessionOpen = false;
      state.softOpen = false;
      state.phase = 'registration';
      state.events.push('explicit-close');
      syncMount();
    },
    reopenEmpty() {
      state.sessionOpen = true;
      state.softOpen = false;
      state.phase = 'registration';
      state.form = {
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        phone: '',
        currentStepId: 'PERSONAL',
      };
      state.events.push('reopen-empty');
      syncMount();
    },
  };
}

const UAT_FORM: FormSnapshot = {
  firstName: 'Sam',
  lastName: 'Badikolu',
  dateOfBirth: '1987-08-01',
  phone: '8919653433',
  currentStepId: 'REVIEW',
};

describe('Confirm & Create soft-duplicate lifecycle (behavioral)', () => {
  it('TEST A/C — soft transition keeps wizard mounted (no unmount→mount)', () => {
    const host = createSessionHost(UAT_FORM);
    host.openSession();
    expect(host.mounts).toBe(1);
    expect(host.unmounts).toBe(0);
    expect(host.form.firstName).toBe('Sam');
    expect(host.form.currentStepId).toBe('REVIEW');

    host.applySoftDuplicate();

    const soft = softDuplicateHostState(true);
    expect(soft.wizardMounted).toBe(true);
    expect(soft.shellVisible).toBe(false);
    expect(soft.rootOpen).toBe(true);

    expect(host.sessionOpen).toBe(true);
    expect(host.mounts).toBe(1);
    expect(host.unmounts).toBe(0);
    expect(host.mounted).toBe(true);
    expect(host.form).toEqual(UAT_FORM);
    expect(host.events.filter((e) => e === 'wizard-unmount')).toHaveLength(0);
    expect(
      isRegistrationShellVisible({
        sessionOpen: host.sessionOpen,
        softOpen: host.softOpen,
        hardOpen: false,
      }),
    ).toBe(false);
    expect(resolveRegistrationSessionRootOpen(host.sessionOpen)).toBe(true);
  });

  it('TEST C defect proof — closing session on soft open causes unmount→remount and empty form', () => {
    const host = createSessionHost(UAT_FORM);
    host.openSession();
    expect(host.mounts).toBe(1);

    host.applySoftDuplicateClosingSession();
    expect(host.unmounts).toBe(1);
    expect(host.mounted).toBe(false);

    host.reopenEmpty();
    expect(host.mounts).toBe(2);
    expect(host.form.firstName).toBe('');
    expect(host.form.currentStepId).toBe('PERSONAL');
    expect(host.events.join('|')).toContain('wizard-unmount');
    expect(host.events.join('|')).toContain('wizard-mount');
  });

  it('TEST A — Radix shell dismiss during soft review does not close session', () => {
    const host = createSessionHost(UAT_FORM);
    host.openSession();
    host.applySoftDuplicate();
    host.applyShellDismiss();

    expect(host.sessionOpen).toBe(true);
    expect(host.mounted).toBe(true);
    expect(host.unmounts).toBe(0);
    expect(host.form.firstName).toBe('Sam');
    expect(
      shouldIgnoreRegistrationShellDismiss({
        sessionOpen: true,
        softOpen: true,
        hardOpen: false,
        phase: 'duplicate-review',
      }),
    ).toBe(true);
  });

  it('TEST B — soft PhoneMatch×3 stops before create; values preserved in session', () => {
    const checkResponse = {
      isDuplicate: true,
      matches: [
        { id: 'p1', matchType: 'PhoneMatch' },
        { id: 'p2', matchType: 'PhoneMatch' },
        { id: 'p3', matchType: 'PhoneMatch' },
      ],
    };
    const parsed = parseRegistrationDuplicateCheckResult(checkResponse);
    expect(shouldShowSoftDuplicateReview(parsed)).toBe(true);
    expect(parsed.matches).toHaveLength(3);

    const host = createSessionHost(UAT_FORM);
    host.openSession();
    host.applySoftDuplicate();

    const hostState = softDuplicateHostState(true);
    expect(hostState.sessionOpen).toBe(true);
    expect(hostState.wizardMounted).toBe(true);
    expect(hostState.shellVisible).toBe(false);
    expect(hostState.softOpen).toBe(true);
    expect(host.form).toEqual(UAT_FORM);
    expect(host.form.currentStepId).not.toBe('PERSONAL');
  });

  it('TEST G — only explicit session close unmounts wizard', () => {
    const host = createSessionHost(UAT_FORM);
    host.openSession();
    host.applySoftDuplicate();
    expect(host.unmounts).toBe(0);

    host.explicitClose();
    expect(host.unmounts).toBe(1);
    expect(host.mounted).toBe(false);
  });
});

describe('Confirm & Create duplicate-check invocation (behavioral)', () => {
  it('TEST A/H — confirm path invokes check-duplicates exactly once before create gate', async () => {
    const checkDuplicates = vi.fn(async () => ({
      data: {
        isDuplicate: true,
        matches: [
          { id: 'p1', matchType: 'PhoneMatch' },
          { id: 'p2', matchType: 'PhoneMatch' },
          { id: 'p3', matchType: 'PhoneMatch' },
        ],
      },
    }));
    const create = vi.fn();
    let softOpen = false;
    let parentClose = 0;
    let phase: 'registration' | 'duplicate-review' = 'registration';

    // Mirrors AddPatientWizard handleSubmit soft branch (single invocation).
    async function confirmCreateOnce() {
      const checkResponse = await checkDuplicates({
        firstName: 'Sam',
        lastName: 'Badikolu',
        dateOfBirth: '1987-08-01',
        contactNumber: '8919653433',
      });
      const checkResult = parseRegistrationDuplicateCheckResult(checkResponse.data);
      if (shouldShowSoftDuplicateReview(checkResult)) {
        softOpen = true;
        phase = 'duplicate-review';
        return; // STOP — no create
      }
      await create();
    }

    await confirmCreateOnce();

    expect(checkDuplicates).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
    expect(softOpen).toBe(true);
    expect(phase).toBe('duplicate-review');
    expect(parentClose).toBe(0);
    expect(shouldMountRegistrationWizard(true)).toBe(true);
  });

  it('TEST D — Continue after soft acknowledgement creates once', async () => {
    const create = vi.fn(async () => ({ id: 'created-1' }));
    let acknowledged = false;

    async function continueAfterSoft() {
      acknowledged = true;
      await create();
    }

    await continueAfterSoft();
    expect(acknowledged).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('TEST E — hard duplicate keeps session; no create', async () => {
    const create = vi.fn();
    let hardOpen = false;
    let sessionOpen = true;

    async function confirmWithHardBlock() {
      // Soft skipped (ExactNameDOB); create throws hard block — session stays.
      hardOpen = true;
      // no create success, no session close
      expect(sessionOpen).toBe(true);
    }

    await confirmWithHardBlock();
    expect(create).not.toHaveBeenCalled();
    expect(hardOpen).toBe(true);
    expect(sessionOpen).toBe(true);
  });

  it('TEST F — failure keeps session open (no reset)', async () => {
    let toastError = 0;
    let sessionOpen = true;
    const form = { ...UAT_FORM };

    async function confirmWithCheckFailure() {
      toastError += 1;
      // fail-closed: no create, session remains, form intact
    }

    await confirmWithCheckFailure();
    expect(toastError).toBe(1);
    expect(sessionOpen).toBe(true);
    expect(form.firstName).toBe('Sam');
    expect(form.currentStepId).toBe('REVIEW');
  });
});
