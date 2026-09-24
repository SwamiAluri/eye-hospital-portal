import { describe, expect, it } from 'vitest';
import {
  buildCreateCounsellingSessionPayload,
  displayIdentifierForWaitingList,
  findActiveWaitingListDuplicate,
  matchPatientForAddWaitingList,
  requireSelectedMpiPatient,
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

  it('PD-C: Done duplicate message directs to ReEvaluate', () => {
    expect(
      waitingListDuplicateCreateMessage({
        patientName: 'Meena Iyer',
        status: 'Done',
      }),
    ).toMatch(/ReEvaluate/i);
  });

  it('PD-C: RepeatCounselling message continues existing episode (not ReEvaluate)', () => {
    const msg = waitingListDuplicateCreateMessage({
      patientName: 'Meena Iyer',
      status: 'RepeatCounselling',
    });
    expect(msg).toMatch(/existing session|open counselling episode/i);
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
