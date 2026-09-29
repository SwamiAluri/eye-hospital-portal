import { describe, expect, it } from 'vitest';
import {
  buildCreateCounsellingSessionPayload,
  buildScheduleCounsellingDecision,
  decisionFromScheduleCounsellingServerMessage,
  displayIdentifierForWaitingList,
  findActiveWaitingListDuplicate,
  isScheduleCounsellingBlocked,
  matchPatientForAddWaitingList,
  requireSelectedMpiPatient,
  ScheduleCounsellingBlockedError,
  waitingListDuplicateCreateMessage,
  type UnifiedPatientHit,
} from './add-patient-to-waiting-list';

const hits: UnifiedPatientHit[] = [
  { id: 'p1', firstName: 'Meena', lastName: 'Iyer', mrn: 'MRN-100', healthId: 'UHID-100' },
  { id: 'p2', firstName: 'Ravi', lastName: 'Kumar', mrn: 'UHID-200' },
];

describe('requireSelectedMpiPatient', () => {
  it('accepts a selected MPI patient with id', () => {
    const result = requireSelectedMpiPatient(hits[0]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.patient.id).toBe('p1');
  });

  it('rejects when no patient has been selected or registered', () => {
    const result = requireSelectedMpiPatient(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/select or register/i);
  });

  it('rejects when patient id is missing', () => {
    const result = requireSelectedMpiPatient({
      id: '',
      firstName: 'X',
      lastName: 'Y',
      mrn: 'MRN-1',
    });
    expect(result.ok).toBe(false);
  });
});

describe('displayIdentifierForWaitingList', () => {
  it('prefers HealthId/UHID over MRN when present', () => {
    expect(displayIdentifierForWaitingList(hits[0])).toBe('UHID-100');
  });

  it('falls back to MRN when HealthId is absent', () => {
    expect(displayIdentifierForWaitingList(hits[1])).toBe('UHID-200');
  });
});

describe('matchPatientForAddWaitingList', () => {
  it('resolves exact MRN match (case-insensitive)', () => {
    const result = matchPatientForAddWaitingList(hits, 'mrn-100', 'Meena Iyer');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.patient.id).toBe('p1');
  });

  it('resolves exact HealthId/UHID when distinct from MRN', () => {
    const result = matchPatientForAddWaitingList(hits, 'UHID-100', 'Meena Iyer');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.patient.id).toBe('p1');
  });

  it('fails when no patient matches UHID', () => {
    const result = matchPatientForAddWaitingList(hits, 'MISSING', 'Anyone');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/no patient/i);
  });

  it('fails when entered name does not match resolved patient', () => {
    const result = matchPatientForAddWaitingList(hits, 'UHID-100', 'Wrong Name');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/does not match/i);
  });
});

describe('findActiveWaitingListDuplicate', () => {
  it('detects Pending/Processed/AddOnSurgery duplicates by UHID', () => {
    const dup = findActiveWaitingListDuplicate({
      uhid: 'UHID-100',
      patientDisplayName: 'Meena Iyer',
      rows: [
        { uhid: 'UHID-100', patientName: 'Meena Iyer', status: 'Pending' },
      ],
    });
    expect(dup?.status).toBe('Pending');
  });

  it('PD-C: blocks Done and RepeatCounselling; allows SurgeryDone new episode', () => {
    expect(
      findActiveWaitingListDuplicate({
        uhid: 'UHID-100',
        patientDisplayName: 'Meena Iyer',
        rows: [{ uhid: 'UHID-100', patientName: 'Meena Iyer', status: 'Done' }],
      })?.status,
    ).toBe('Done');

    expect(
      findActiveWaitingListDuplicate({
        uhid: 'UHID-100',
        patientDisplayName: 'Meena Iyer',
        rows: [{ uhid: 'UHID-100', patientName: 'Meena Iyer', status: 'RepeatCounselling' }],
      })?.status,
    ).toBe('RepeatCounselling');

    expect(
      findActiveWaitingListDuplicate({
        uhid: 'UHID-100',
        patientDisplayName: 'Meena Iyer',
        rows: [{ uhid: 'UHID-100', patientName: 'Meena Iyer', status: 'SurgeryDone' }],
      }),
    ).toBeUndefined();
  });

  it('PD-C: Done duplicate message directs to re-evaluate without internal wording', () => {
    const msg = waitingListDuplicateCreateMessage({
      patientName: 'Meena Iyer',
      status: 'Done',
    });
    expect(msg).toMatch(/re-evaluate/i);
    expect(msg).not.toMatch(/ReEvaluate/);
  });

  it('Done block uses the in-dialog re-evaluate copy', () => {
    const decision = buildScheduleCounsellingDecision({
      patientName: 'Venkatesh Murthy',
      status: 'Done',
      uhid: 'FRESH-006',
      sessionId: 'sess-1',
    });
    expect(decision.action).toBe('re-evaluate');
    expect(decision.title).toBe('Counselling already completed');
    expect(decision.primaryLabel).toBe('Re-evaluate session');
    expect(decision.statusLabel).toBe('Done');
    expect(decision.body).toMatch(/finished/i);
    expect(decision.body).not.toMatch(/ReEvaluate/);
    expect(decision.uhid).toBe('FRESH-006');
    expect(decision.sessionId).toBe('sess-1');
  });

  it('RepeatCounselling block continues the existing session', () => {
    const decision = buildScheduleCounsellingDecision({
      patientName: 'Meena Iyer',
      status: 'RepeatCounselling',
      uhid: 'UHID-100',
    });
    expect(decision.action).toBe('continue');
    expect(decision.title).toBe('Session already open');
    expect(decision.primaryLabel).toBe('Continue session');
    expect(decision.statusLabel).toBe('Repeat counselling');
    expect(decision.body).not.toMatch(/ReEvaluate/);
  });

  it('Pending, Processing, and Add-on blocks open the existing row', () => {
    for (const status of ['Pending', 'Processed', 'AddOnSurgery'] as const) {
      const decision = buildScheduleCounsellingDecision({
        patientName: 'Meena Iyer',
        status,
        uhid: 'UHID-100',
      });
      expect(decision.action).toBe('open');
      expect(decision.title).toBe('Already on the waiting list');
      expect(decision.primaryLabel).toBe('Open existing row');
    }
    expect(
      buildScheduleCounsellingDecision({
        patientName: 'Meena Iyer',
        status: 'Processed',
        uhid: 'UHID-100',
      }).statusLabel,
    ).toBe('Processing');
  });

  it('maps the server reuse sentences onto the same decisions', () => {
    const done = decisionFromScheduleCounsellingServerMessage(
      'Existing counselling is completed but surgery is not done. ReEvaluate the existing counselling session instead of creating another.',
      { patientName: 'Venkatesh Murthy', uhid: 'FRESH-006', sessionId: 'sess-9' },
    );
    expect(done?.action).toBe('re-evaluate');
    expect(done?.body).not.toMatch(/ReEvaluate/);

    const active = decisionFromScheduleCounsellingServerMessage(
      'Patient already has an active counselling session. Open the existing waiting list row instead of creating another.',
      { patientName: 'Meena Iyer', uhid: 'UHID-100' },
    );
    expect(active?.action).toBe('open');

    const openEpisode = decisionFromScheduleCounsellingServerMessage(
      'Patient already has an open counselling episode. Continue the existing session instead of creating another.',
      { patientName: 'Meena Iyer', uhid: 'UHID-100' },
    );
    expect(openEpisode?.action).toBe('continue');

    expect(
      decisionFromScheduleCounsellingServerMessage('Patient not found in this tenant.', {
        patientName: 'Meena Iyer',
        uhid: 'UHID-100',
      }),
    ).toBeNull();
  });

  it('marks a blocked schedule error so the dialog can catch it without a toast', () => {
    const err = new ScheduleCounsellingBlockedError(
      buildScheduleCounsellingDecision({
        patientName: 'Venkatesh Murthy',
        status: 'Done',
        uhid: 'FRESH-006',
      }),
    );
    expect(isScheduleCounsellingBlocked(err)).toBe(true);
    expect(isScheduleCounsellingBlocked(new Error('Failed to schedule counselling'))).toBe(false);
  });

  it('PD-C: RepeatCounselling message continues existing episode (not ReEvaluate)', () => {
    const msg = waitingListDuplicateCreateMessage({
      patientName: 'Meena Iyer',
      status: 'RepeatCounselling',
    });
    expect(msg).toMatch(/continue that session/i);
    expect(msg).not.toMatch(/ReEvaluate/i);
  });
});

describe('buildCreateCounsellingSessionPayload', () => {
  it('builds POST /Counseling/sessions body with AddToQueue and branch', () => {
    const body = buildCreateCounsellingSessionPayload({
      patientId: 'p1',
      branchId: 'b1',
      doctorId: 'd1',
      sessionTypeCode: 'INITIAL',
      surgeryType: 'Surgery',
      surgeryName: 'Phaco',
      eye: 'RE',
      remarks: 'Walk-in',
    });
    expect(body).toEqual({
      patientId: 'p1',
      branchId: 'b1',
      referredByDoctorId: 'd1',
      sessionType: 'Initial',
      patientType: 'Cash',
      addToQueue: true,
      recommendedSurgery: 'Phaco',
      sessionCategory: 'Surgery',
      surgeryTentativeEye: 'RE',
      additionalNotes: 'Walk-in',
    });
  });

  it('Phase 3I: FE omits counselorId — BE establishes owner when actor is counsellor', () => {
    const body = buildCreateCounsellingSessionPayload({
      patientId: 'p1',
      doctorId: 'd1',
      sessionTypeCode: 'INITIAL',
      surgeryType: 'Procedure',
      surgeryName: '',
      eye: '',
      remarks: '',
    });
    expect('counselorId' in body).toBe(false);
    expect(Object.keys(body)).not.toContain('counselorId');
  });
});
