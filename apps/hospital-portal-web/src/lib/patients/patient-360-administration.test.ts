import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getVisits = vi.fn();
const getAppointments = vi.fn();
const getConsents = vi.fn();

vi.mock('@/lib/api', () => ({
  appointmentsApi: { getByPatient: (...args: unknown[]) => getAppointments(...args) },
  visitsApi: { getByPatient: (...args: unknown[]) => getVisits(...args) },
}));

vi.mock('@/lib/api/patient-consents.api', () => ({
  patientConsentsApi: { getByPatient: (...args: unknown[]) => getConsents(...args) },
}));
import {
  SURGERY_UNAVAILABLE,
  administrationEmptyMessage,
  administrationUnavailableMessage,
  classifyAdministrationError,
  mapAppointment,
  mapConsent,
  administrationUnauthorizedMessage,
  loadPatient360Administration,
  mapVisit,
} from '@/lib/patients/patient-360-administration';

describe('patient 360 administration reads', () => {
  beforeEach(() => {
    getVisits.mockReset();
    getAppointments.mockReset();
    getConsents.mockReset();
    getAppointments.mockResolvedValue({ data: [] });
    getConsents.mockResolvedValue({ data: [] });
  });

  it('renders an authorized visit and keeps unauthorized distinct from an empty list', async () => {
    getVisits.mockResolvedValueOnce({
      data: [{
        id: 'v1',
        status: 'completed',
        visitType: 'review',
        createdAt: '2026-09-01T10:00:00',
      }],
    });
    const ready = await loadPatient360Administration('p1');
    expect(getVisits).toHaveBeenCalledWith('p1', 1, 100);
    expect(ready.visits.state).toBe('ready');
    expect(ready.visits.rows[0]).toMatchObject({ id: 'v1', status: 'completed', title: 'review' });

    getVisits.mockResolvedValueOnce({ data: [] });
    const empty = await loadPatient360Administration('p1');
    expect(empty.visits).toEqual({ state: 'ready', rows: [] });
    expect(administrationEmptyMessage('visits')).toBe('No visits recorded.');

    getVisits.mockRejectedValueOnce({ response: { status: 403 } });
    const denied = await loadPatient360Administration('p1');
    expect(denied.visits).toEqual({ state: 'unauthorized', rows: [] });
    expect(administrationUnauthorizedMessage('visits')).not.toBe(administrationEmptyMessage('visits'));
    expect(administrationUnavailableMessage('visits')).not.toBe(administrationEmptyMessage('visits'));
  });

  it('preserves appointment status, including cancelled rows', () => {
    const row = mapAppointment({
      id: 'apt-1',
      appointmentDate: '2026-09-30T09:30:00',
      status: 'Cancelled',
      doctorName: 'Dr Sen',
      appointmentType: 'Follow-up',
      notes: 'Blurred vision',
    });
    expect(row).toEqual({
      id: 'apt-1',
      when: '2026-09-30 09:30',
      status: 'Cancelled',
      provider: 'Dr Sen',
      title: 'Follow-up',
      detail: 'Blurred vision',
    });
    expect(administrationEmptyMessage('appointments')).toBe('No appointments recorded.');
    expect(classifyAdministrationError({ response: { status: 500 } })).toBe('unavailable');
    expect(administrationUnavailableMessage('appointments')).toBe('Appointments are not available in Patient 360.');
    expect(administrationUnavailableMessage('appointments')).not.toMatch(/No appointments recorded/i);
  });

  it('shows check-in time only when returned and keeps visit status', () => {
    expect(
      mapVisit('p1', {
        id: 'v1',
        status: 'completed',
        visitType: 'OPD',
        currentStation: 'Optometry',
        consultantName: 'Dr Sen',
        checkedInAt: '2026-09-28T10:00:00',
      }),
    ).toMatchObject({
      status: 'completed',
      checkInTime: '2026-09-28 10:00',
      encounterHref: '/dashboard/patients/p1/encounter/v1',
    });
    const withoutCheckIn = mapVisit('p1', { id: 'v2', status: 'waiting', visitType: 'Review' });
    expect(withoutCheckIn?.checkInTime).toBeNull();
    expect(withoutCheckIn?.status).toBe('waiting');
    expect(mapVisit('p1', { status: 'completed' })?.encounterHref).toBeNull();
    expect(administrationEmptyMessage('visits')).toBe('No visits recorded.');
    expect(administrationUnavailableMessage('visits')).toBe('Visits are not available in Patient 360.');
  });

  it('does not present a revoked consent as active', () => {
    const revoked = mapConsent({
      id: 'c1',
      consentName: 'Treatment',
      status: 'active',
      grantedAt: '2026-01-01T08:00:00',
      revokedAt: '2026-06-01T09:00:00',
    });
    expect(revoked?.status.toLowerCase()).not.toBe('active');
    expect(revoked?.revokedAt).toBe('2026-06-01 09:00');
    expect(revoked?.grantedAt).toBe('2026-01-01 08:00');
    expect(mapConsent({ id: 'c2', consentName: 'Photo', status: 'active', grantedAt: '2026-02-01T08:00:00' })?.status).toBe('active');
    expect(administrationEmptyMessage('consents')).toBe('No consents recorded.');
    expect(administrationUnavailableMessage('consents')).toBe('Consents are not available in Patient 360.');
    expect(SURGERY_UNAVAILABLE).toBe('Surgery / OT is not available in Patient 360.');
    expect(SURGERY_UNAVAILABLE).not.toMatch(/No surgery/i);
  });
});

describe('patient 360 administration boundaries', () => {
  it('loads administration reads only from the administration panel', () => {
    const root = resolve(__dirname, '../..');
    const page = readFileSync(resolve(root, 'components/patients/record/PatientRecordPage.tsx'), 'utf8');
    const panel = readFileSync(resolve(root, 'components/patients/record/Patient360Administration.tsx'), 'utf8');
    const reads = readFileSync(resolve(root, 'lib/patients/patient-360-administration.ts'), 'utf8');
    const joined = `${panel}\n${reads}`;

    expect(page).toContain("section === 'administration'");
    expect(page).toContain('Patient360AdministrationPanel');
    expect(page).not.toContain('Existing record tools');
    expect(reads).toContain('appointmentsApi.getByPatient');
    expect(reads).toContain('visitsApi.getByPatient');
    expect(reads).toContain('patientConsentsApi.getByPatient');
    expect(reads.match(/appointmentsApi\.getByPatient/g)).toHaveLength(1);
    expect(reads.match(/visitsApi\.getByPatient/g)).toHaveLength(1);
    expect(reads.match(/patientConsentsApi\.getByPatient/g)).toHaveLength(1);

    const overview = readFileSync(resolve(root, 'lib/patients/patient-360-overview.ts'), 'utf8');
    expect(overview).toContain('summary.ipAdmission?.isAdmitted');
    expect(panel).toContain('Inpatient History');
    expect(panel).toContain('loadPatient360InpatientHistory');

    for (const banned of [
      'appointmentsApi.create',
      'appointmentsApi.cancel',
      'visitsApi.checkIn',
      'patientConsentsApi.revoke',
      'surgeryRequestsApi',
      'AdmissionsTab',
      'CounselorId',
      'patient_events',
      'No admissions',
      'No surgery',
      'deletedAt',
      'deleted_at',
    ]) {
      expect(joined, banned).not.toContain(banned);
    }
  });
});
