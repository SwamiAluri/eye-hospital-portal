import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PATIENT_360_SECTIONS } from '@/lib/patients/patient-360-sections';
import { resolvePatient360PrimaryActions } from '@/lib/patients/patient-360-primary-actions';
import { formatPatientSex } from '@/lib/patients/patient-display-utils';

const src = (...parts: string[]) => join(process.cwd(), 'src', ...parts);

async function readSrc(...parts: string[]) {
  return readFile(src(...parts), 'utf8');
}

async function exists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

describe('P360-UX-2.1 fixed patient workspace shell', () => {
  it('does not mount patient-switching chrome on Patient 360', async () => {
    const page = await readSrc('components/patients/record/PatientRecordPage.tsx');
    expect(page).not.toContain('PatientSwitcherRail');
    expect(page).not.toContain('PatientRecordNav');
    expect(page).not.toContain('PatientWorkspaceTabs');
    expect(page).not.toContain('patientLookupTestIds.switcherRail');
    expect(page).not.toContain('patientLookupTestIds.recordNav');
    expect(page).not.toContain('patientLookupTestIds.workspaceTabs');
    expect(page).not.toContain('usePatientSuggestQuery');
    expect(page).not.toContain('/patients/suggest');
    expect(page).not.toContain('readPatientRecordNav');
    expect(page).not.toContain('savePatientRecordNav');
    expect(page).not.toContain('touchPatient');
    expect(page).not.toMatch(/of \$\{/);
    expect(page).not.toContain('positionLabel');
  });

  it('preserves switching utilities for Directory and other consumers', async () => {
    expect(await exists(src('components/patients/record/PatientSwitcherRail.tsx'))).toBe(true);
    expect(await exists(src('components/patients/record/PatientRecordNav.tsx'))).toBe(true);
    expect(await exists(src('components/patients/record/PatientWorkspaceTabs.tsx'))).toBe(true);
    expect(await exists(src('lib/patients/patient-record-nav.ts'))).toBe(true);
    const lookup = await readSrc('lib/api/patient-lookup.api.ts');
    expect(lookup).toContain('suggest');
    const hub = await readSrc('components/patients/lookup/PatientHubPage.tsx');
    expect(hub).toContain('savePatientRecordNav');
    expect(hub).not.toContain('PatientSwitcherRail');
  });

  it('formats sex with the existing display utility and keeps identity from summary', async () => {
    const page = await readSrc('components/patients/record/PatientRecordPage.tsx');
    expect(page).toContain('formatPatientSex');
    expect(page).toContain('summary.firstName');
    expect(page).toContain('summary.mrn');
    expect(page).toContain('PatientAvatar');
    expect(page).toContain('calcPatientAge');
    expect(page).toContain('<h1');
    expect(formatPatientSex('male')).toBe('Male');
    expect(page).not.toMatch(/\{summary\.gender\}/);
  });

  it('keeps Continue XOR Check-in, Schedule appointment.view, and gates Export PDF', async () => {
    const page = await readSrc('components/patients/record/PatientRecordPage.tsx');
    expect(page).toContain('resolvePatient360PrimaryActions');
    expect(page).toContain('appointment.view');
    expect(page).toContain("useHasPermission('patient.export')");
    expect(page).toContain('/dashboard/billing/opd?patientId=');
    expect(page).toContain('patientPrintSummaryUrl');
    expect(page).not.toContain('Open Counselling');
    expect(page).not.toContain('Queue status');
    expect(page).not.toContain('/dashboard/frontdesk/queue');
    expect(page).not.toContain('Edit Patient');
    expect(page).not.toContain('Open CCMS');
    expect(page).not.toContain('/dashboard/ccms');
    expect(page).not.toContain('Start counselling');
    expect(page).not.toContain('Assign Counselor');
    expect(page).not.toContain('ReQueue');
    expect(resolvePatient360PrimaryActions({ assignedVisitId: 'v1' })).toEqual({
      canContinueEncounter: true,
      canOfferCheckIn: false,
    });
    expect(resolvePatient360PrimaryActions({ scheduledAt: '2026-10-06T09:00:00' })).toEqual({
      canContinueEncounter: false,
      canOfferCheckIn: true,
    });
  });

  it('keeps seven section keys and keyboard section navigation', async () => {
    const page = await readSrc('components/patients/record/PatientRecordPage.tsx');
    const nav = await readSrc('components/patients/record/Patient360SectionNav.tsx');
    expect(PATIENT_360_SECTIONS.map((section) => section.key)).toEqual([
      'overview',
      'clinical',
      'care',
      'documents',
      'coverage',
      'administration',
      'timeline',
    ]);
    expect(page).toContain('Patient360SectionNav');
    expect(nav).toContain('ArrowRight');
    expect(nav).toContain('ArrowLeft');
    expect(nav).toContain('role="tablist"');
    expect(nav).toContain('focus-visible:ring-2');
  });

  it('removes unscoped CCMS from Coverage while keeping patient-scoped billing', async () => {
    const coverage = await readSrc('components/patients/record/Patient360Coverage.tsx');
    expect(coverage).toContain('/dashboard/billing/opd?patientId=');
    expect(coverage).toContain('Open Billing');
    expect(coverage).not.toContain('Open CCMS');
    expect(coverage).not.toContain('/dashboard/ccms');
  });
});
