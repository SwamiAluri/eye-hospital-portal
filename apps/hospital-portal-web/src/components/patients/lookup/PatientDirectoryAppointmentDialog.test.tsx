import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dialog = readFileSync(
  resolve(__dirname, 'PatientDirectoryAppointmentDialog.tsx'),
  'utf8',
);
const booking = readFileSync(
  resolve(__dirname, '../../appointments/UnifiedAppointmentBooking.tsx'),
  'utf8',
);

describe('directory appointment dialog', () => {
  it('hosts the existing booking workflow in the portal dialog for the selected patient', () => {
    expect(dialog).toContain('<Dialog');
    expect(dialog).toContain('Book appointment');
    expect(dialog).toContain('without leaving the directory');
    expect(dialog).toContain('embedded');
    expect(dialog).toContain('resumePatientId={patientId}');
    expect(dialog).toContain('patientLookupKeys.all');
    expect(dialog).not.toContain('/dashboard/appointments/schedule');
    expect(dialog).not.toContain('router.push');
  });

  it('keeps booking creation on the existing appointment API and reports success', () => {
    expect(booking).toContain("api.post('/appointments'");
    expect(booking).toContain('onSuccess?.()');
    expect(booking).toContain('embedded');
    expect(booking).not.toContain('mockDoctors');
  });
});
