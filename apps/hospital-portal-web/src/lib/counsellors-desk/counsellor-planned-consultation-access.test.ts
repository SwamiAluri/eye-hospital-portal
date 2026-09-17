import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Finding #7 — planned consultation Access Denied:
 * Patient Directory appointment booking requires appointment.view.
 * Counsellor must not be granted appointment.view; UI must gate the entry points.
 */
describe('Counsellor planned-consultation Access Denied contract', () => {
  it('Amelia-like permission set excludes appointment.view', () => {
    const amelia = [
      'dashboard.view',
      'patient.view',
      'patient.create',
      'counseling_sessions.read',
      'counseling_sessions.create',
      'counseling_sessions.update',
      'bill.view',
      'opd_bill.view',
      'ip.view',
    ];
    expect(amelia).not.toContain('appointment.view');
    expect(amelia).not.toContain('appointment.create');
    expect(amelia).not.toContain('user.view');
  });

  it('PatientSchedulingTab gates fetch on appointment.view', async () => {
    const text = await readFile(
      join(process.cwd(), 'src/components/patients/record/PatientSchedulingTab.tsx'),
      'utf8',
    );
    expect(text).toContain("useHasPermission('appointment.view')");
    expect(text).toContain('canViewAppointments');
  });

  it('PatientHubRowActions gates Book appointment on appointment.view', async () => {
    const text = await readFile(
      join(process.cwd(), 'src/components/patients/lookup/PatientHubRowActions.tsx'),
      'utf8',
    );
    expect(text).toContain("useHasPermission('appointment.view')");
    expect(text).toContain('canBookAppointment');
  });
});
