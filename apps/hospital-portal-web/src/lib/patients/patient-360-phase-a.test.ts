import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BILLING_DESK_VIEW_PERMISSIONS } from '@/lib/ip-management/collect-payment';
import { PATIENT_360_SECTIONS } from '@/lib/patients/patient-360-sections';
import { resolvePatient360PrimaryActions } from '@/lib/patients/patient-360-primary-actions';

const src = (...parts: string[]) => join(process.cwd(), 'src', ...parts);

async function readSrc(...parts: string[]) {
  return readFile(src(...parts), 'utf8');
}

describe('P360 Phase A header / action system', () => {
  it('keeps Continue XOR Check-in via the certified helper', () => {
    expect(resolvePatient360PrimaryActions({ assignedVisitId: 'v1' })).toEqual({
      canContinueEncounter: true,
      canOfferCheckIn: false,
    });
    expect(resolvePatient360PrimaryActions({ scheduledAt: '2026-10-06T09:00:00' })).toEqual({
      canContinueEncounter: false,
      canOfferCheckIn: true,
    });
    expect(resolvePatient360PrimaryActions({ assignedVisitId: 'v1', scheduledAt: '2026-10-06T09:00:00' })).toEqual({
      canContinueEncounter: true,
      canOfferCheckIn: false,
    });
  });

  it('exposes Schedule as a patient-aware general appointment dialog, not the broken schedule route', async () => {
    const page = await readSrc('components/patients/record/PatientRecordPage.tsx');
    const dialog = await readSrc('components/patients/lookup/PatientDirectoryAppointmentDialog.tsx');
    expect(page).toContain('PatientDirectoryAppointmentDialog');
    expect(page).toContain('appointment.view');
    expect(page).toContain('aria-label="Schedule"');
    expect(page).toMatch(/resumePatientId=\{patientId\}|patientId=\{summary\.id\}/);
    expect(page).not.toContain('/dashboard/appointments/schedule');
    expect(page).not.toContain('schedule?patientId=');
    expect(page).not.toContain('Counselling Appointment');
    expect(dialog).toContain('resumePatientId={patientId}');
    expect(dialog).toContain('UnifiedAppointmentBooking');
  });

  it('exposes Billing as a gated OPD view handoff, not IP billing or bill create', async () => {
    const page = await readSrc('components/patients/record/PatientRecordPage.tsx');
    expect(page).toContain('BILLING_DESK_VIEW_PERMISSIONS');
    expect(page).toContain('useHasAnyPermission');
    expect(page).toContain('/dashboard/billing/opd?patientId=');
    expect(page).not.toContain('/dashboard/ip-management/billing');
    expect(page).not.toContain('/dashboard/billing/opd/create');
    expect(page).not.toContain('Generate New Bill');
    expect(BILLING_DESK_VIEW_PERMISSIONS).toEqual([
      'bill.view',
      'opd_bill.view',
      'bill.update',
      'ip.billing.collect',
      'bill.create',
    ]);
  });

  it('promotes Print and Export out of a generic More menu', async () => {
    const page = await readSrc('components/patients/record/PatientRecordPage.tsx');
    expect(page).toContain('patientPrintSummaryUrl');
    expect(page).toContain("useHasPermission('patient.export')");
    expect(page).toContain('patientLookupTestIds.recordPrint');
    expect(page).toContain('patientLookupTestIds.recordExportPdf');
    expect(page).not.toMatch(/>\s*More\s*</);
    expect(page).not.toContain('recordQuickActionsMore');
    expect(page).not.toContain('Open Counselling');
    expect(page).not.toContain('Queue status');
    expect(page).not.toContain('/dashboard/frontdesk/queue');
    expect(page).not.toContain('Edit Patient');
    expect(page).not.toContain('CounselorId');
  });

  it('keeps Summary overflow limited to Print and Export when used', async () => {
    const page = await readSrc('components/patients/record/PatientRecordPage.tsx');
    if (page.includes('aria-label="Summary"')) {
      const start = page.indexOf('aria-label="Summary"');
      const end = page.indexOf('</DropdownMenu>', start);
      const overflow = page.slice(start, end === -1 ? start + 900 : end);
      expect(overflow).toContain('Print');
      expect(overflow).toContain('Export PDF');
      expect(overflow).not.toContain('Schedule');
      expect(overflow).not.toContain('Billing');
      expect(overflow).not.toContain('Open Counselling');
      expect(overflow).not.toContain('Queue');
    }
  });

  it('does not restore patient switching or change seven-section navigation', async () => {
    const page = await readSrc('components/patients/record/PatientRecordPage.tsx');
    expect(page).not.toContain('PatientSwitcherRail');
    expect(page).not.toContain('PatientRecordNav');
    expect(page).not.toContain('PatientWorkspaceTabs');
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
  });

  it('does not mutate counsellor ownership from Patient 360 chrome', async () => {
    const page = await readSrc('components/patients/record/PatientRecordPage.tsx');
    expect(page).not.toContain('/assign');
    expect(page).not.toContain('Start counselling');
    expect(page).not.toContain('Assign Counselor');
    expect(page).not.toContain('ReQueue');
    expect(page).not.toContain('counseling_sessions.create');
  });
});
