import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  buildOtReturnedCreateSessionPayload,
  parseCreateSessionResult,
  resolveReferringDoctorId,
  counsellingSessionHref,
} from './start-ot-returned-counselling';

describe('start-ot-returned-counselling helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds create payload with AddToQueue false (no Waiting List insert)', () => {
    expect(
      buildOtReturnedCreateSessionPayload({
        patientId: 'patient-1',
        branchId: 'branch-1',
        referredByDoctorId: 'doctor-1',
        otReturnReason: 'BP high',
        procedureName: 'Phaco + IOL',
        eye: 'LE',
      }),
    ).toEqual({
      patientId: 'patient-1',
      branchId: 'branch-1',
      referredByDoctorId: 'doctor-1',
      sessionType: 'Followup',
      patientType: 'Cash',
      addToQueue: false,
      recommendedSurgery: 'Phaco + IOL',
      surgeryTentativeEye: 'LE',
      additionalNotes: 'OT Returned: BP high',
    });
  });

  it('does not put CounselorId in the create payload (no ownership bypass)', () => {
    const payload = buildOtReturnedCreateSessionPayload({
      patientId: 'p',
      branchId: 'b',
      referredByDoctorId: 'd',
    });
    expect(Object.keys(payload)).not.toContain('counselorId');
  });

  it('parses successful create response for sessionId', () => {
    expect(
      parseCreateSessionResult({
        status: 200,
        data: { success: true, sessionId: 'new-sess-1' },
      }),
    ).toEqual({ ok: true, sessionId: 'new-sess-1', created: true });
  });

  it('parses PD-C conflict (409) with sessionId as continue-existing', () => {
    expect(
      parseCreateSessionResult({
        status: 409,
        data: {
          success: false,
          sessionId: 'existing-sess-9',
          message: 'Patient already has an open counselling episode.',
        },
      }),
    ).toEqual({ ok: true, sessionId: 'existing-sess-9', created: false });
  });

  it('rejects failure without sessionId', () => {
    expect(
      parseCreateSessionResult({
        status: 400,
        data: { success: false, message: 'Referring doctor is required.' },
      }),
    ).toEqual({
      ok: false,
      message: 'Referring doctor is required.',
    });
  });

  it('resolves referring doctor from journey detail then falls back to prior session', () => {
    expect(
      resolveReferringDoctorId({
        primarySurgeonId: 'surg-1',
        admittingDoctorId: null,
        priorSessionReferredByDoctorId: 'doc-old',
      }),
    ).toBe('surg-1');

    expect(
      resolveReferringDoctorId({
        primarySurgeonId: null,
        admittingDoctorId: 'admit-1',
        priorSessionReferredByDoctorId: 'doc-old',
      }),
    ).toBe('admit-1');

    expect(
      resolveReferringDoctorId({
        primarySurgeonId: null,
        admittingDoctorId: null,
        priorSessionReferredByDoctorId: 'doc-old',
      }),
    ).toBe('doc-old');

    expect(
      resolveReferringDoctorId({
        primarySurgeonId: null,
        admittingDoctorId: null,
        priorSessionReferredByDoctorId: null,
      }),
    ).toBeNull();
  });

  it('builds counselling session href for navigation', () => {
    expect(counsellingSessionHref('sess-42')).toBe(
      '/dashboard/counsellors-desk/sess-42?from=waiting-list',
    );
  });

  it('startOtReturnedCounselling creates then navigates to new session', async () => {
    const { startOtReturnedCounselling } = await import('./start-ot-returned-counselling');
    const createSession = vi.fn().mockResolvedValue({
      status: 200,
      data: { success: true, sessionId: 'created-1' },
    });
    const result = await startOtReturnedCounselling(
      { journeyId: 'j-1', patientId: 'p-1', branchId: 'b-1' },
      {
        getJourneyDetail: async () => ({
          patientId: 'p-1',
          primarySurgeonId: 'doc-1',
          admittingDoctorId: null,
        }),
        getPatientSessions: async () => [],
        createSession,
      },
    );
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'p-1',
        addToQueue: false,
        referredByDoctorId: 'doc-1',
      }),
    );
    expect(result).toEqual({
      sessionId: 'created-1',
      created: true,
      href: '/dashboard/counsellors-desk/created-1?from=waiting-list',
    });
  });

  it('startOtReturnedCounselling uses PD-C conflict sessionId without claiming a new create', async () => {
    const { startOtReturnedCounselling } = await import('./start-ot-returned-counselling');
    const result = await startOtReturnedCounselling(
      { journeyId: 'j-1', patientId: 'p-1', branchId: 'b-1' },
      {
        getJourneyDetail: async () => ({
          patientId: 'p-1',
          primarySurgeonId: null,
          admittingDoctorId: null,
        }),
        getPatientSessions: async () => [
          { id: 'old', referredByDoctorId: 'doc-prior', status: 'InProgress' },
        ],
        createSession: async () => ({
          status: 409,
          data: {
            success: false,
            sessionId: 'existing-open',
            message: 'Patient already has an open counselling episode.',
          },
        }),
      },
    );
    expect(result.created).toBe(false);
    expect(result.sessionId).toBe('existing-open');
    expect(result.href).toContain('existing-open');
  });

  it('startOtReturnedCounselling fails when no referring doctor can be resolved', async () => {
    const { startOtReturnedCounselling } = await import('./start-ot-returned-counselling');
    await expect(
      startOtReturnedCounselling(
        { journeyId: 'j-1', patientId: 'p-1' },
        {
          getJourneyDetail: async () => ({
            patientId: 'p-1',
            primarySurgeonId: null,
            admittingDoctorId: null,
          }),
          getPatientSessions: async () => [],
          createSession: async () => ({ status: 200, data: {} }),
        },
      ),
    ).rejects.toThrow(/referring surgeon/i);
  });
});
