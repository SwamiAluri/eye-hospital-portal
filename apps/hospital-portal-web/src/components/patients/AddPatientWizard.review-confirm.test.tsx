import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-master-values', () => ({
  useMasterValues: () => ({ options: [], loading: false }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/lib/api/patients.api', () => ({
  patientApi: {
    checkDuplicatesForRegistration: vi.fn(),
    create: vi.fn(),
    uploadPhoto: vi.fn(),
  },
}));

import { AddPatientWizard } from '@/components/patients/AddPatientWizard';

describe('AddPatientWizard Review return + dynamic steps', () => {
  const wizardPath = join(process.cwd(), 'src/components/patients/AddPatientWizard.tsx');
  const dialogPath = join(process.cwd(), 'src/components/patients/AddPatientDialog.tsx');
  const wizard = readFileSync(wizardPath, 'utf8');
  const dialog = readFileSync(dialogPath, 'utf8');

  it('uses logical REVIEW for duplicate review return (not hard-coded step 1 or 7)', () => {
    expect(wizard).toContain("setCurrentStepId('REVIEW')");
    expect(wizard).toContain('openDuplicateReviewForCandidate');
    expect(wizard).toContain("currentStepId !== 'REVIEW'");
    expect(wizard).toContain("onEditStep('PERSONAL')");
    expect(wizard).toContain("onEditStep('EMERGENCY')");
    expect(wizard).toContain("onEditStep('INSURANCE')");
    expect(wizard).toContain("onEditStep('GUARDIAN')");
    expect(wizard).not.toContain('FINAL_REGISTRATION_STEP');
    expect(wizard).not.toContain('setCurrentStep(1)');
    expect(wizard).not.toContain('setCurrentStep(FINAL');
  });

  it('keeps wizard mounted across soft duplicate via session Root (not shell open)', () => {
    expect(dialog).toContain('resolveRegistrationSessionRootOpen');
    expect(dialog).toContain('shouldMountRegistrationWizard');
    expect(dialog).toContain('applyRegistrationShellDismissAttempt');
    expect(dialog).toContain('open={sessionRootOpen}');
    expect(dialog).toContain('{wizardMounted ? (');
    expect(dialog).toContain('hostDuplicateDialogsExternally');
    expect(dialog).toContain('<DuplicatePatientSoftMatchDialog');
    expect(dialog).toContain('modal={sessionRootOpen}');
    // Wizard mount keys off session, not shell visibility (shell hides for soft/hard).
    expect(dialog).not.toContain('{shellOpen ? (');
    expect(dialog).not.toContain('open={shellVisible}');
    expect(dialog).not.toContain('modal={shellVisible}');
    expect(dialog).not.toContain('forceMount');
  });

  it('builds applicableSteps dynamically (no phantom guardian number)', () => {
    expect(wizard).toContain('getApplicableRegistrationSteps');
    expect(wizard).toContain('data-applicable-step-count');
    expect(wizard).toContain('data-guardian-applicable');
    expect(wizard).toContain('data-current-step-id');
    expect(wizard).toContain('data-step-id');
  });

  it('adult initial render shows six applicable steps and LEFT_CURRENT personal', () => {
    const html = renderToStaticMarkup(<AddPatientWizard presentation="dialog" />);
    expect(html).toContain('data-current-step-id="PERSONAL"');
    expect(html).toContain('data-applicable-step-count="6"');
    expect(html).toContain('data-guardian-applicable="false"');
    expect(html).toContain('data-stepper-layout="LEFT_CURRENT"');
    expect(html).toContain('data-current-step-label="Personal Information"');
    expect(html).not.toMatch(/data-step-id="GUARDIAN"/);
    for (const n of [1, 2, 3, 4, 5, 6]) {
      expect(html).toContain(`data-testid="registration-step-${n}"`);
    }
    expect(html).not.toContain('data-testid="registration-step-7"');
    expect(html).not.toMatch(/<h2[^>]*>Personal Information<\/h2>/);
  });

  it('creates only from Confirm after review validation with duplicate pre-check', () => {
    expect(wizard).toContain('Confirm & Create Patient');
    expect(wizard).toContain('validateForCreate');
    expect(wizard).toContain('checkDuplicatesForRegistration');
    expect(wizard).toContain('hostDuplicateDialogsExternally');
    expect(wizard).not.toContain('Create Anyway');
    expect(wizard).not.toContain('Edit Registration');
    expect(wizard).not.toContain('Matches selected patient');
    expect(wizard).toContain('border-red-400 bg-red-50');
  });

  it('wires DOB DD-MM-YYYY and clears field errors on correction', () => {
    expect(wizard).toContain('placeholder="DD-MM-YYYY"');
    expect(wizard).toContain('clearFieldError');
    expect(wizard).toContain("clearFieldError('dateOfBirth')");
  });
});
