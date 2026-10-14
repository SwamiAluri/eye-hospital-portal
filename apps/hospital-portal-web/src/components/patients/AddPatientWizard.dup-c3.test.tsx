import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const checkDuplicatesForRegistration = vi.fn();
const create = vi.fn();

vi.mock('@/lib/api/patients.api', () => ({
  patientApi: {
    checkDuplicatesForRegistration: (...args: unknown[]) =>
      checkDuplicatesForRegistration(...args),
    create: (...args: unknown[]) => create(...args),
    uploadPhoto: vi.fn(),
  },
}));

vi.mock('@/hooks/use-master-values', () => ({
  useMasterValues: () => ({ options: [], loading: false }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('AddPatientWizard DUP-C.3 wiring', () => {
  const wizardPath = join(process.cwd(), 'src/components/patients/AddPatientWizard.tsx');
  const dialogPath = join(process.cwd(), 'src/components/patients/AddPatientDialog.tsx');

  beforeEach(() => {
    checkDuplicatesForRegistration.mockReset();
    create.mockReset();
  });

  it('final registration invokes registration/check-duplicates before create', () => {
    const wizard = readFileSync(wizardPath, 'utf8');
    const dialog = readFileSync(dialogPath, 'utf8');
    expect(wizard).toContain('checkDuplicatesForRegistration');
    expect(wizard).toContain('shouldShowSoftDuplicateReview');
    expect(wizard).toContain('continueRegistrationAfterSoftMatch');
    expect(wizard).toContain('softMatchAcknowledgedKey');
    expect(wizard).toContain('Unable to verify possible duplicate patients');
    expect(wizard).toContain('parseDuplicateHardBlockError');
    expect(wizard).not.toContain('onEditRegistration');
    expect(wizard).not.toContain('Edit Registration');
    expect(wizard).toContain("setCurrentStepId('REVIEW')");
    expect(wizard).toContain('onDuplicatePhaseChange');
    expect(wizard).toContain('hostDuplicateDialogsExternally');
    expect(dialog).toContain('resolveRegistrationSessionRootOpen');
    expect(dialog).toContain('applyRegistrationShellDismissAttempt');
    expect(dialog).toContain('<DuplicatePatientSoftMatchDialog');
  });

  it('soft duplicate path does not call create or close (lifecycle contract)', () => {
    const wizard = readFileSync(wizardPath, 'utf8');
    const dialog = readFileSync(dialogPath, 'utf8');
    // Soft result opens hosted soft UI and returns before create.
    expect(wizard).toContain('shouldShowSoftDuplicateReview');
    expect(wizard).toContain("onDuplicatePhaseChange?.('duplicate-review')");
    expect(wizard).toContain('onHostedSoftMatchUiChange?.({');
    expect(wizard).toMatch(/shouldShowSoftDuplicateReview\(checkResult\)[\s\S]*?return;/);
    // Soft branch must not invoke create before return.
    const softIdx = wizard.indexOf('shouldShowSoftDuplicateReview(checkResult)');
    const softReturnIdx = wizard.indexOf('return;', softIdx);
    const createIdx = wizard.indexOf('await createPatientFromWizard()', softIdx);
    expect(softIdx).toBeGreaterThan(-1);
    expect(softReturnIdx).toBeGreaterThan(softIdx);
    expect(createIdx).toBeGreaterThan(softReturnIdx);
    // ExactNameDOB opens hard from registration-check evidence (attributes preserved) — no create.
    expect(wizard).toContain('hasExactNameDobMatch(checkResult)');
    expect(wizard).toContain('HARD_DUPLICATE_PRECHECK_BRANCH');
    expect(wizard).toContain('setDuplicateHardBlockOpen(true)');
    // Session Root stays open; shell hide must not remount wizard.
    expect(dialog).toContain('open={sessionRootOpen}');
    expect(dialog).toContain('{wizardMounted ? (');
    expect(dialog).toContain('applyRegistrationShellDismissAttempt');
    expect(dialog).toContain('modal={sessionRootOpen}');
    expect(dialog).not.toContain('forceMount');
    expect(dialog).not.toContain('open={shellVisible}');
    expect(dialog).not.toContain('modal={shellVisible}');
  });

  it('unique create path posts once, preserves response identity, and notifies onCreated', () => {
    const wizard = readFileSync(wizardPath, 'utf8');
    expect(wizard).toContain('createPatientFromWizard');
    expect(wizard).toContain('patientApi.create');
    expect(wizard).toContain('parseCreatePatientResponse');
    expect(wizard).toContain('formatPatientCreateError');
    expect(wizard).toContain('onRegistrationComplete?.(createdPatient)');
    expect(wizard).toContain('onCreated(patientId)');
    expect(wizard).toContain('Patient Registered Successfully');
    // Page mode success remains; dialog lifts via onRegistrationComplete.
    expect(wizard).toContain('savedPatient && !showRegistrationCard');
    expect(wizard).toContain('data-testid="patient-registration-success"');
    expect(wizard).toContain('data-testid="print-registration-card"');
    // Failed POST must not look like success — hard-block / toast clear savedPatient path.
    expect(wizard).toContain('setSavedPatient(null)');
    expect(wizard).toContain('toast.error');
    expect(wizard).not.toContain('Create Anyway');
    // No silent terminal: failures use toast, not only alert.
    expect(wizard).not.toMatch(/alert\(\s*'Failed to create patient/);
    const createParse = readFileSync(
      join(process.cwd(), 'src/lib/patients/create-patient-response.ts'),
      'utf8',
    );
    expect(createParse).toContain('Create patient response did not include patient id');
  });

  it('identity edit clears soft acknowledgement and duplicate review evidence', () => {
    const wizard = readFileSync(wizardPath, 'utf8');
    expect(wizard).toContain('setSoftMatchAcknowledgedKey(null)');
    expect(wizard).toContain('setDuplicateReviewContext(null)');
    expect(wizard).toContain('formData.firstName');
    expect(wizard).toContain('formData.lastName');
    expect(wizard).toContain('formData.dateOfBirth');
    expect(wizard).toContain('formData.phone');
    expect(wizard).toContain('formData.email');
  });

  it('Review matching preserves selected candidate server matchedAttributes for red highlights', () => {
    const wizard = readFileSync(wizardPath, 'utf8');
    expect(wizard).toContain('openDuplicateReviewForCandidate');
    expect(wizard).toContain('matchedAttributes: [...(candidate.matchedAttributes ?? [])]');
    expect(wizard).toContain('differentAttributes: [...(candidate.differentAttributes ?? [])]');
    expect(wizard).toContain('candidateId: candidate.id');
    expect(wizard).toContain('matchType: candidate.matchType');
    expect(wizard).toContain('resolveDuplicateReviewSeverity');
    expect(wizard).toContain('severity:');
    expect(wizard).toContain('duplicateEvidenceForField');
    expect(wizard).toContain('border-red-400 bg-red-50');
    expect(wizard).toContain("data-duplicate-evidence={isMatched ? 'matched' : undefined}");
    // Soft Continue is the acknowledge path; Review return keeps Confirm & Create.
    expect(wizard).toContain('continueRegistrationAfterSoftMatch');
    expect(wizard).toContain('setSoftMatchAcknowledgedKey(identityKey)');
  });

  it('hard Review context blocks Confirm & Create (no POST /patients loop)', () => {
    const wizard = readFileSync(wizardPath, 'utf8');
    expect(wizard).toContain('isHardDuplicateReviewBlocking');
    expect(wizard).toContain('CONFIRM_REJECTED_HARD_DUPLICATE_CONTEXT');
    expect(wizard).toContain('data-create-blocked="hard-duplicate"');
    expect(wizard).toContain('Creation blocked');
    expect(wizard).toContain('review-hard-duplicate-blocked');
    // Hard review opens with source hard; soft with soft.
    expect(wizard).toContain("openDuplicateReviewForCandidate(candidate, 'hard')");
    expect(wizard).toContain("openDuplicateReviewForCandidate(candidate, 'soft')");
    // Guard must run before createPatientFromWizard / check path can POST.
    const hardGuardIdx = wizard.indexOf('CONFIRM_REJECTED_HARD_DUPLICATE_CONTEXT');
    const createIdx = wizard.indexOf("regLife('CREATE_START')");
    expect(hardGuardIdx).toBeGreaterThan(-1);
    expect(createIdx).toBeGreaterThan(hardGuardIdx);
  });

  it('does not revive override or merge soft actions', () => {
    const wizard = readFileSync(wizardPath, 'utf8');
    expect(wizard).not.toContain('Create Anyway');
    expect(wizard).not.toContain('DuplicatePatientWarningDialog');
    expect(wizard).not.toContain('onProceedAnyway');
  });

  it('pre-check failure is fail-closed', () => {
    const wizard = readFileSync(wizardPath, 'utf8');
    expect(wizard).toContain('Unable to verify possible duplicate patients');
    expect(wizard).toContain('Fail-closed');
  });

  it('logical step labels remain with Review as logical REVIEW', () => {
    const wizard = readFileSync(wizardPath, 'utf8');
    for (const label of [
      'Personal Information',
      'Contact Information',
      'Identity Documents',
      'Guardian Information',
      'Emergency Contact',
      'Insurance Information',
      'Review & Confirm',
    ]) {
      expect(wizard).toContain(label);
    }
    expect(wizard).toContain("currentStepId === 'REVIEW'");
    expect(wizard).toContain('getApplicableRegistrationSteps');
  });
});

describe('patients.api registration pre-check', () => {
  it('exposes create-scoped registration check path', () => {
    const api = readFileSync(join(process.cwd(), 'src/lib/api/patients.api.ts'), 'utf8');
    expect(api).toContain('checkDuplicatesForRegistration');
    expect(api).toContain('/patients/registration/check-duplicates');
  });
});
