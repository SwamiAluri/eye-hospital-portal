import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
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

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('AddPatientDialog (session-stable wizard + sibling duplicates)', () => {
  const dialog = source('src/components/patients/AddPatientDialog.tsx');
  const wizard = source('src/components/patients/AddPatientWizard.tsx');
  const soft = source('src/components/patients/DuplicatePatientSoftMatchDialog.tsx');

  it('binds Dialog Root to session open — never shell visibility (Portal teardown remounts wizard)', () => {
    // Regression: open={shellOpen} tore down DialogPortal → AddPatientWizard remount → empty PERSONAL.
    expect(dialog).toContain('resolveRegistrationSessionRootOpen');
    expect(dialog).toContain('shouldMountRegistrationWizard');
    expect(dialog).toContain('applyRegistrationShellDismissAttempt');
    expect(dialog).toContain('open={sessionRootOpen}');
    expect(dialog).toContain('{wizardMounted ? (');
    expect(dialog).toContain('hostDuplicateDialogsExternally');
    // modal must stay bound to session — toggling with shell remounts wizard.
    expect(dialog).toContain('modal={sessionRootOpen}');
    expect(dialog).not.toContain('modal={shellVisible}');
    expect(dialog).toContain('hideOverlay={false}');
    // Must not gate Root or wizard mount on shell visibility.
    expect(dialog).not.toContain('open={shellOpen}');
    expect(dialog).not.toContain('open={shellVisible}');
    expect(dialog).not.toContain('open={showRegistration}');
    expect(dialog).not.toContain('{shellOpen ? (');
    expect(dialog).not.toContain('{shellVisible ? (');
    // forceMount alone is insufficient if Content remounts — do not treat it as the fix.
    expect(dialog).not.toContain('forceMount');
  });

  it('ignores Radix shell dismiss during soft/hard duplicate review', () => {
    expect(dialog).toContain('applyRegistrationShellDismissAttempt');
    expect(dialog).toContain('onEscapeKeyDown');
    expect(dialog).toContain('onPointerDownOutside');
    expect(dialog).toContain('onInteractOutside');
  });

  it('soft dialog blocks outside dismiss so nested soft UI cannot flash-close the host', () => {
    expect(soft).toContain('onPointerDownOutside');
    expect(soft).toContain('onInteractOutside');
    expect(soft).toContain('event.preventDefault()');
  });

  it('hosts soft/hard dialogs as siblings', () => {
    expect(dialog).toContain('<DuplicatePatientSoftMatchDialog');
    expect(dialog).toContain('<DuplicatePatientHardBlockDialog');
    expect(dialog).toContain('hostDuplicateDialogsExternally');
    const softIdx = dialog.indexOf('<DuplicatePatientSoftMatchDialog');
    const dialogClose = dialog.lastIndexOf('</Dialog>');
    expect(softIdx).toBeGreaterThan(dialogClose);
  });

  it('wizard returns to logical REVIEW from Review matching information', () => {
    expect(wizard).toContain("setCurrentStepId('REVIEW')");
    expect(wizard).toContain('markStepReached');
    expect(wizard).toContain('getApplicableRegistrationSteps');
  });

  it('adult shell starts on PERSONAL with six applicable steps', () => {
    const html = renderToStaticMarkup(<AddPatientWizard presentation="dialog" />);
    expect(html).toContain('data-current-step-id="PERSONAL"');
    expect(html).toContain('data-applicable-step-count="6"');
    expect(html).not.toMatch(/data-step-id="GUARDIAN"/);
  });

  it('header has no Patient registration subtitle', () => {
    expect(dialog).toContain('Register New Patient');
    expect(dialog).not.toContain('>Patient registration<');
  });

  it('forwards created patient id to parent onCreated immediately (Directory invalidate on create)', () => {
    // CASE B: do not defer hub invalidate until dialog close only.
    expect(dialog).toMatch(
      /onCreated=\{\(patientId\)\s*=>\s*\{[\s\S]*?createdId\.current\s*=\s*patientId;[\s\S]*?onCreated\?\.\(patientId\);/,
    );
    expect(dialog).toContain('onRegistrationComplete');
    const hub = source('src/components/patients/lookup/PatientHubPage.tsx');
    expect(hub).toContain('patientLookupKeys.all');
    expect(hub).toContain('invalidateQueries');
    expect(hub).toContain('onRegistrationComplete');
    expect(hub).toContain('PatientRegistrationSuccessDialog');
  });

  it('close path still notifies parent when a created id is pending', () => {
    expect(dialog).toContain('createdId.current');
    expect(dialog).toContain('onCreated?.(id)');
  });

  it('registration complete closes Register New Patient and lifts success ownership', () => {
    expect(dialog).toContain('onRegistrationComplete?.(patient)');
    expect(dialog).toContain('onOpenChange(false)');
    expect(dialog).toContain('createdId.current = null');
  });

  it('Confirm & Create is type=button with preventDefault/stopPropagation (no accidental dialog close)', () => {
    expect(wizard).toMatch(
      /type="button"[\s\S]{0,800}?data-testid="confirm-create-patient"/,
    );
    expect(wizard).toMatch(
      /preventDefault\(\);[\s\S]{0,200}?stopPropagation\(\);[\s\S]{0,200}?data-testid="confirm-create-patient"/,
    );
    expect(wizard).toContain('<form onSubmit={handleSubmit}');
  });
});
