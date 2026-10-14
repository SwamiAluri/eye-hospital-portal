import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PATIENT_360_SECTIONS } from '@/lib/patients/patient-360-sections';

const src = (...parts: string[]) => join(process.cwd(), 'src', ...parts);

async function readSrc(...parts: string[]) {
  return readFile(src(...parts), 'utf8');
}

describe('P360 Phase B overview workspace', () => {
  it('keeps Overview on summary + recent visits only', async () => {
    const overview = await readSrc('components/patients/record/Patient360Overview.tsx');
    const model = await readSrc('lib/patients/patient-360-overview.ts');
    expect(overview).toContain('usePatientRecord');
    expect(overview).toContain('recentVisitsQuery');
    expect(model).not.toContain('GET /diagnoses');
    expect(model).not.toContain('prescriptionsApi');
    expect(overview).not.toContain('appointmentsApi');
    expect(overview).not.toContain('opdBillsApi');
    expect(overview).not.toContain('loadPatient360Clinical');
  });

  it('does not restore the six-card overview grid or header-owned next actions', async () => {
    const overview = await readSrc('components/patients/record/Patient360Overview.tsx');
    expect(overview).not.toContain('md:grid-cols-2');
    expect(overview).not.toContain('Patient snapshot');
    expect(overview).not.toContain('Current care context');
    expect(overview).not.toContain('Next actions');
    expect(overview).not.toContain('Continue encounter');
    expect(overview).not.toContain('Check-in');
    expect(overview).toContain("recentActivityMessage('empty')");
    expect(overview).toContain('No clinical flags recorded.');
    const model = await readSrc('lib/patients/patient-360-overview.ts');
    expect(model).toContain('No visits recorded.');
  });

  it('leaves Phase A header actions and seven sections intact', async () => {
    const page = await readSrc('components/patients/record/PatientRecordPage.tsx');
    expect(page).toContain('PatientDirectoryAppointmentDialog');
    expect(page).toContain('/dashboard/billing/opd?patientId=');
    expect(page).toContain('patientPrintSummaryUrl');
    expect(page).toContain("useHasPermission('patient.export')");
    expect(page).toContain('resolvePatient360PrimaryActions');
    expect(page).not.toContain('PatientSwitcherRail');
    expect(page).not.toContain('Open Counselling');
    expect(PATIENT_360_SECTIONS.map((section) => section.key)).toEqual([
      'overview',
      'clinical',
      'care',
      'documents',
      'coverage',
      'administration',
      'timeline',
    ]);
  });
});
