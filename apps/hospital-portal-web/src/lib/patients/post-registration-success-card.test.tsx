import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('post-registration success / card ownership', () => {
  const hub = source('src/components/patients/lookup/PatientHubPage.tsx');
  const dialog = source('src/components/patients/AddPatientDialog.tsx');
  const wizard = source('src/components/patients/AddPatientWizard.tsx');
  const preview = source('src/components/patients/RegistrationCardPreview.tsx');
  const success = source('src/components/patients/PatientRegistrationSuccessDialog.tsx');
  const cardSurface = source(
    'src/components/patients/PatientRegistrationCardSurfaceDialog.tsx',
  );

  it('Directory hosts success + card outside Add Patient wizard', () => {
    expect(hub).toContain('<PatientRegistrationSuccessDialog');
    expect(hub).toContain('<PatientRegistrationCardSurfaceDialog');
    expect(hub).toContain('onRegistrationComplete');
    expect(hub).toContain('openCreatedPatientPreview');
    // Add Patient dialog close must not trigger Preview handoff.
    const addDialogIdx = hub.indexOf('<AddPatientDialog');
    const successIdx = hub.indexOf('<PatientRegistrationSuccessDialog');
    expect(addDialogIdx).toBeGreaterThan(-1);
    expect(successIdx).toBeGreaterThan(addDialogIdx);
    const addDialogBlock = hub.slice(addDialogIdx, successIdx);
    expect(addDialogBlock).toContain('setAddPatientOpen(next)');
    expect(addDialogBlock).not.toContain('openCreatedPatientPreview');
  });

  it('dialog create completes registration and lifts patient out of wizard', () => {
    expect(dialog).toContain('onRegistrationComplete');
    expect(wizard).toContain('onRegistrationComplete');
    expect(wizard).toContain('if (isDialog)');
    expect(wizard).toContain('onRegistrationComplete?.(createdPatient)');
    // Dialog path must not keep success inside Register New Patient shell.
    expect(wizard).toMatch(
      /if \(isDialog\) \{[\s\S]*?onRegistrationComplete\?\.\(createdPatient\);[\s\S]*?return;/,
    );
  });

  it('success surface is dedicated and excludes wizard chrome', () => {
    expect(success).toContain('Patient Registered Successfully');
    expect(success).toContain('Medical Record Number');
    expect(success).toContain('print-registration-card');
    expect(success).toContain('registration-success-close');
    expect(success).toContain('patient-registration-success-dialog');
    expect(success).not.toContain('Register New Patient');
    expect(success).not.toContain('Personal Information');
    expect(success).not.toContain('Review & Confirm');
    expect(success).not.toContain('registration-step');
  });

  it('card surface is dedicated and print uses isolated document helper', () => {
    expect(cardSurface).toContain('Registration Card');
    expect(cardSurface).toContain('RegistrationCardPreview');
    expect(cardSurface).not.toContain('Register New Patient');
    expect(preview).toContain('openRegistrationCardPrint');
    expect(preview).toContain('registration-card-print-target');
    expect(preview).not.toContain('window.print()');
    expect(preview).not.toContain('@media print');
    expect(preview).not.toContain('body *');
  });
});
