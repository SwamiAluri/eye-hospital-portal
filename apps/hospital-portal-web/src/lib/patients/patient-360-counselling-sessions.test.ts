import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCounselingSessionContextByPatient = vi.fn();

vi.mock('@/lib/api/counseling-sessions.api', () => ({
  getCounselingSessionContextByPatient: (...args: unknown[]) => getCounselingSessionContextByPatient(...args),
}));

import {
  classifyCounsellingSessionError,
  counsellingSessionEmptyMessage,
  counsellingSessionUnauthorizedMessage,
  counsellingSessionUnavailableMessage,
  loadPatient360CounsellingSessions,
  mapCounsellingSession,
} from '@/lib/patients/patient-360-counselling-sessions';

const patientId = '741a1b98-874b-45d5-a3f6-d2d7a4ef9899';

describe('patient 360 counselling session context', () => {
  beforeEach(() => {
    getCounselingSessionContextByPatient.mockReset();
  });

  it('maps the approved fields and drops operational payload', () => {
    const row = mapCounsellingSession({
      id: 'session-1',
      sessionNumber: 'CS-14',
      sessionType: 'Followup',
      sessionDate: '2026-09-02T00:00:00',
      sessionStartTime: '2026-09-02T09:15:00',
      sessionEndTime: '2026-09-02T09:45:00',
      status: 'InProgress',
      counsellorName: 'Ada Lovelace',
      counselorId: 'owner-1',
      clinicalSummary: '{"diagnosis":"secret-dx"}',
      packageAmount: 9999.5,
      additionalNotes: 'secret-note',
      pendingDecision: true,
      currentStage: 'Financial',
      attenderPhone: '9990001111',
      recommendedSurgery: 'Phaco',
    });
    expect(row).toEqual({
      id: 'session-1',
      sessionNumber: 'CS-14',
      sessionType: 'Followup',
      sessionDate: '2026-09-02',
      sessionTime: '09:15–09:45',
      status: 'InProgress',
      counsellorName: 'Ada Lovelace',
    });
  });

  it('leaves the counsellor name empty when it is absent', () => {
    const row = mapCounsellingSession({
      id: 'session-2',
      sessionType: 'Initial',
      status: 'Scheduled',
      counsellorName: '',
    });
    expect(row?.counsellorName).toBeNull();
    expect(row?.sessionNumber).toBeNull();
  });

  it('loads every returned session for the patient', async () => {
    getCounselingSessionContextByPatient.mockResolvedValue({
      sessions: [
        { id: 'a', sessionType: 'Initial', status: 'Scheduled', sessionDate: '2026-09-01' },
        { id: 'b', sessionType: 'Followup', status: 'Completed', sessionDate: '2026-09-02' },
      ],
      totalCount: 2,
    });
    const result = await loadPatient360CounsellingSessions(patientId);
    expect(getCounselingSessionContextByPatient).toHaveBeenCalledWith(patientId);
    expect(result.state).toBe('ready');
    expect(result.rows.map((row) => row.id)).toEqual(['a', 'b']);
    expect(result.rows[1]?.status).toBe('Completed');
  });

  it('treats a successful empty list as recorded absence', async () => {
    getCounselingSessionContextByPatient.mockResolvedValue({ sessions: [], totalCount: 0 });
    const result = await loadPatient360CounsellingSessions(patientId);
    expect(result).toEqual({ state: 'ready', rows: [] });
    expect(counsellingSessionEmptyMessage()).toBe('No counselling sessions recorded.');
  });

  it('classifies authorization separately from failure and empty', () => {
    expect(classifyCounsellingSessionError({ response: { status: 401 } })).toBe('unauthorized');
    expect(classifyCounsellingSessionError({ response: { status: 403 } })).toBe('unauthorized');
    expect(classifyCounsellingSessionError({ response: { status: 500 } })).toBe('unavailable');
    expect(counsellingSessionUnauthorizedMessage()).toBe(
      'Counselling session information is not available to this sign-in.',
    );
    expect(counsellingSessionUnavailableMessage()).toBe('Counselling session information is unavailable.');
  });

  it('treats a missing sessions array as unavailable', async () => {
    getCounselingSessionContextByPatient.mockResolvedValue({});
    const result = await loadPatient360CounsellingSessions(patientId);
    expect(result.state).toBe('unavailable');
    expect(result.rows).toEqual([]);
  });
});
