import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CANONICAL_ADD_PATIENT_PATH,
  bookingAddPatientReturnPath,
  buildCanonicalAddPatientHref,
  resolveCreatedPatientNavigation,
  sanitizeAddPatientReturnTo,
} from './canonical-add-patient';

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('canonical add patient routing', () => {
  it('builds the wizard href and rejects external return targets', () => {
    expect(buildCanonicalAddPatientHref('/dashboard/patients')).toBe(
      '/dashboard/patients/new?returnTo=%2Fdashboard%2Fpatients',
    );
    expect(sanitizeAddPatientReturnTo('https://evil.example/dashboard/patients')).toBeNull();
    expect(sanitizeAddPatientReturnTo('//evil.example')).toBeNull();
    expect(sanitizeAddPatientReturnTo('/dashboard/patients/new')).toBeNull();
    expect(buildCanonicalAddPatientHref('https://evil.example')).toBe(CANONICAL_ADD_PATIENT_PATH);
  });

  it('keeps the existing record close when no workflow asked to resume', () => {
    expect(
      resolveCreatedPatientNavigation({
        returnTo: null,
        patientId: 'p1',
        inIframe: false,
      }),
    ).toEqual({ kind: 'record', href: '/dashboard/patients/p1' });
  });

  it('returns directory and front office without starting another workflow', () => {
    expect(
      resolveCreatedPatientNavigation({
        returnTo: '/dashboard/patients',
        patientId: 'p1',
        inIframe: false,
      }).href,
    ).toBe('/dashboard/patients');
    expect(
      resolveCreatedPatientNavigation({
        returnTo: '/dashboard/frontdesk',
        patientId: 'p1',
        inIframe: false,
      }).href,
    ).toBe('/dashboard/frontdesk');
  });

  it('returns counsellor and booking with the created patient id only', () => {
    expect(
      resolveCreatedPatientNavigation({
        returnTo: '/dashboard/counsellors-desk/waiting-list',
        patientId: 'p1',
        inIframe: false,
      }).href,
    ).toBe('/dashboard/counsellors-desk/waiting-list?createdPatientId=p1');
    expect(
      resolveCreatedPatientNavigation({
        returnTo: '/dashboard/appointments/book',
        patientId: 'p1',
        inIframe: false,
      }).href,
    ).toBe('/dashboard/appointments/book?createdPatientId=p1');
  });

  it('uses the book route when registration starts from the appointments page', () => {
    expect(bookingAddPatientReturnPath('/dashboard/appointments')).toBe('/dashboard/appointments/book');
    expect(bookingAddPatientReturnPath('/dashboard/frontdesk/book')).toBe('/dashboard/frontdesk/book');
  });
});

describe('canonical add patient entry points', () => {
  it('directory add patient opens the shared wizard in a dialog and does not navigate away', () => {
    const hub = source('src/components/patients/lookup/PatientHubPage.tsx');
    expect(hub).toContain('AddPatientDialog');
    expect(hub).toContain('setAddPatientOpen(true)');
    expect(hub).not.toContain("buildCanonicalAddPatientHref('/dashboard/patients')");
    expect(hub).not.toContain('router.push(buildCanonicalAddPatientHref');
    expect(hub).not.toContain('PatientFormModal');
    expect(hub).toContain('patientLookupKeys.all');
    expect(hub).toContain('openCreatedPatientPreview');
    expect(hub).toContain('createdHandoffPatientId');
  });

  it('front office new patient navigates to the wizard', () => {
    const desk = source('src/app/dashboard/frontdesk/page.tsx');
    expect(desk).toContain("buildCanonicalAddPatientHref('/dashboard/frontdesk')");
    expect(desk).not.toContain('NewPatientModal');
    expect(desk).toContain('Check-In');
  });

  it('counsellor new patient uses the wizard and still schedules through the waiting list', () => {
    const page = source('src/app/dashboard/counsellors-desk/waiting-list/page.tsx');
    expect(page).toContain("buildCanonicalAddPatientHref('/dashboard/counsellors-desk/waiting-list')");
    expect(page).not.toContain('PatientFormModal');
    expect(page).toContain('AddPatientModal');
    expect(page).toContain('createdPatientId');
    expect(page).not.toContain('setCounselorId');
  });

  it('appointment booking no longer posts an alternate patient payload', () => {
    const booking = source('src/components/appointments/UnifiedAppointmentBooking.tsx');
    expect(booking).toContain('buildCanonicalAddPatientHref');
    expect(booking).not.toContain("api.post('/patients'");
    expect(booking).not.toContain('guardianMobile');
    expect(booking).not.toContain('handleSaveQuickRegistration');
    expect(booking).toContain('resumePatientId');
  });

  it('the canonical wizard still creates through patientApi.create', () => {
    const page = source('src/app/dashboard/patients/new/page.tsx');
    const wizard = source('src/components/patients/AddPatientWizard.tsx');
    expect(page).toContain('AddPatientWizard');
    expect(page).toContain('presentation="page"');
    expect(wizard).toContain('patientApi.create');
    expect(wizard).toContain('contactNumber');
    expect(wizard).toContain('resolveCreatedPatientNavigation');
    expect(wizard).toContain('sanitizeAddPatientReturnTo');
    // DUP-C.3 — create-scoped pre-check (not the view-gated check-duplicates)
    expect(wizard).toContain('checkDuplicatesForRegistration');
    expect(wizard).toContain('DuplicatePatientSoftMatchDialog');
    expect(wizard).toContain('DuplicatePatientHardBlockDialog');
    expect(wizard).toContain('onDuplicatePhaseChange');
    expect(wizard).not.toContain("'/patients/check-duplicates'");
    expect(wizard).not.toContain('"/patients/check-duplicates"');
    const patientsApi = source('src/lib/api/patients.api.ts');
    expect(patientsApi).toContain('/patients/registration/check-duplicates');
    expect(patientsApi).not.toMatch(
      /checkDuplicatesForRegistration[\s\S]*?\/patients\/check-duplicates'/,
    );
    // DUP-C3A.1 — registration success must not console-log PHI payloads
    expect(wizard).not.toContain('Saved patient data');
    expect(wizard).not.toContain('Photo URL in saved patient');
    expect(wizard).not.toContain('Photo upload response');
    expect(wizard).toContain('parseDuplicateHardBlockError');
    expect(wizard).toContain('Personal Information');
    expect(wizard).toContain('Insurance Information');
    expect(wizard).toContain('Review & Confirm');
    expect(wizard).toContain('Confirm & Create Patient');
    expect(wizard).toContain('overflow-y-auto');
    expect(wizard).not.toContain('Registration progress');
    expect(wizard).not.toContain('Edit Registration');
    expect(wizard).not.toContain('Matches selected patient');
    expect(wizard).not.toContain('Registration information is ready to review');
    expect(wizard).toContain('registration-stepper');
    expect(wizard).toContain('getApplicableRegistrationSteps');
    expect(wizard).toContain('getStepperLayoutMode');
    expect(wizard).toContain("setCurrentStepId('REVIEW')");
    expect(wizard).toContain('placeholder="DD-MM-YYYY"');
    expect(wizard).toContain('registration-step-connector');
    expect(wizard).toContain('whitespace-nowrap');
    expect(wizard).toContain('openDuplicateReviewForCandidate');
    expect(wizard).not.toContain('Possible duplicate detected');
    expect(wizard).not.toContain('rounded-full px-2.5');
    expect(wizard).toMatch(/>\s*Back\s*</);
    expect(wizard).toMatch(/>\s*Next\s*</);
    const dialog = source('src/components/patients/AddPatientDialog.tsx');
    expect(dialog).toContain('resolveRegistrationSessionRootOpen');
    expect(dialog).toContain('shouldMountRegistrationWizard');
    expect(dialog).toContain('applyRegistrationShellDismissAttempt');
    expect(dialog).toContain('open={sessionRootOpen}');
    expect(dialog).toContain('{wizardMounted ? (');
    expect(dialog).toContain('hostDuplicateDialogsExternally');
    expect(dialog).toContain('<DuplicatePatientSoftMatchDialog');
    expect(dialog).toContain('modal={sessionRootOpen}');
    expect(dialog).not.toContain('forceMount');
    expect(dialog).not.toContain('modal={shellVisible}');
    expect(wizard).toContain('clearFieldError');
    expect(wizard).toContain('hostDuplicateDialogsExternally');
    expect(wizard).toContain('skipInitialSoftSyncRef');
  });
});


