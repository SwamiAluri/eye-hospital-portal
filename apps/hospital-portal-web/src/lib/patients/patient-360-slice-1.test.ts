import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PATIENT_360_SECTIONS } from '@/lib/patients/patient-360-sections';
import { buildFrontDeskCheckInHref } from '@/lib/patients/patient-handoff';
import { canDirectoryOfferCheckIn } from '@/lib/patients/patient-hub-row-display';
import { resolvePatient360PrimaryActions } from '@/lib/patients/patient-360-primary-actions';
import { patientEncounterUrl, patientPrintSummaryUrl } from '@/lib/patients/patient-routes';

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

describe('merge retirement', () => {
  it('removes Patient 360 merge CTAs and keeps a read-only duplicate warning', async () => {
    const banner = await readSrc('components/patients/record/PatientDuplicateHintBanner.tsx');
    expect(banner).toContain('Possible duplicate patient record');
    expect(banner).toContain('patientLookupTestIds.duplicateHintBanner');
    expect(banner).not.toContain('Merge records');
    expect(banner).not.toContain('Merge into this profile');
    expect(banner).not.toContain('patientMergeUrl');
    expect(banner).not.toContain('mergeLink');
    expect(banner).not.toContain('patient.update');
  });

  it('retires the active merge route, client, and dead enhanced API method', async () => {
    expect(await exists(src('app/dashboard/patients/merge/page.tsx'))).toBe(false);
    expect(await exists(src('lib/api/patient-merge.api.ts'))).toBe(false);
    expect(await exists(src('lib/patients/patient-merge-routes.ts'))).toBe(false);
    const enhanced = await readSrc('lib/api/patients-enhanced.api.ts');
    expect(enhanced).not.toContain('mergePatients');
    expect(enhanced).not.toContain('/merge');
  });
});

describe('Patient 360 slice 1 shell', () => {
  it('keeps one visible section navigation and hides Existing record tools', async () => {
    const page = await readSrc('components/patients/record/PatientRecordPage.tsx');
    expect(page).toContain('Patient360SectionNav');
    expect(PATIENT_360_SECTIONS.map((section) => section.key)).toEqual([
      'overview',
      'clinical',
      'care',
      'documents',
      'coverage',
      'administration',
      'timeline',
    ]);
    expect(page).not.toContain('Existing record tools');
    expect(page).not.toContain('PatientRecordTabGroups');
    expect(page).not.toContain('PatientRecordTabContent');
    expect(page).not.toContain('recordTools');
    expect(page).toContain('mapLegacyRecordTabToPatient360Section');
  });

  it('gates the Patient 360 route on patient.view', async () => {
    const route = await readSrc('app/dashboard/patients/[id]/page.tsx');
    expect(route).toContain('ProtectedRoute');
    expect(route).toContain('requiredPermission="patient.view"');
  });

  it('uses existing check-in eligibility and appointment.view for header actions', async () => {
    const page = await readSrc('components/patients/record/PatientRecordPage.tsx');
    const primary = await readSrc('lib/patients/patient-360-primary-actions.ts');
    expect(primary).toContain('canDirectoryOfferCheckIn');
    expect(page).toContain('resolvePatient360PrimaryActions');
    expect(page).toContain('appointment.view');
    expect(page).toContain('buildFrontDeskCheckInHref');
    expect(page).toContain('patientEncounterUrl');
    expect(page).not.toContain('EMERGENCY OVERRIDE LOGGED');
    expect(page).not.toContain('EmergencyOverrideDialog');
    expect(page).not.toContain('grantOverride');
    expect(page).not.toContain('Merge records');
    expect(page).not.toContain("setTabWithUrl('billing')");
    expect(page).not.toContain("setTabWithUrl('insurance')");
    expect(canDirectoryOfferCheckIn({ scheduledAt: '2026-10-06T09:00:00' })).toBe(true);
    expect(buildFrontDeskCheckInHref('pat-1')).toBe('/dashboard/frontdesk/check-in?patientId=pat-1');
    expect(patientEncounterUrl('p1', 'v1')).toBe('/dashboard/patients/p1/encounter/v1');
    expect(patientPrintSummaryUrl('p1')).toBe('/dashboard/patients/p1/summary/print');
    expect(resolvePatient360PrimaryActions({ assignedVisitId: 'v1' })).toEqual({
      canContinueEncounter: true,
      canOfferCheckIn: false,
    });
    expect(resolvePatient360PrimaryActions({ scheduledAt: '2026-10-06T09:00:00' })).toEqual({
      canContinueEncounter: false,
      canOfferCheckIn: true,
    });
  });

  it('does not introduce a second breakpoint map or overflow-hidden shell', async () => {
    const page = await readSrc('components/patients/record/PatientRecordPage.tsx');
    expect(page).not.toContain('@media');
    expect(page).toContain('md:');
    expect(page).toContain('lg:');
    expect(page).toContain('sm:');
    expect(page).not.toMatch(/overflow-x-hidden/);
  });
});
