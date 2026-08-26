import { describe, expect, it } from 'vitest';
import { buildCensusAttention, buildIpRowSituation } from './ip-row-situation';
import type { PatientJourneyRowDto } from '@/lib/api/ip-management.api';

function row(partial: Partial<PatientJourneyRowDto> & { clinicalState: string }): PatientJourneyRowDto {
  return {
    id: 'j1',
    uhid: 'U1',
    patientName: 'Test',
    eyeOperated: null,
    procedureName: 'Phaco',
    packageAmount: 40000,
    totalPaid: 0,
    balanceDue: 0,
    wardName: 'Ward A',
    bedNumber: 'B2',
    otState: 'NotSent',
    financialState: 'Paid',
    postOpState: 'NotStarted',
    admittedAt: '2026-08-24T08:00:00Z',
    surgeryScheduledAt: null,
    isLocked: false,
    isBillingLocked: false,
    admissionType: 'IPD',
    patientGender: 'M',
    patientDob: null,
    patientAge: 60,
    paymentMode: null,
    isEmergencyFc: false,
    emergencyFcReason: null,
    otReturnReason: null,
    counselingSessionId: null,
    otDetailsSaved: false,
    ...partial,
  } as PatientJourneyRowDto;
}

describe('buildIpRowSituation', () => {
  it('answers where / next action / owner without using financial state as clinical state', () => {
    const s = buildIpRowSituation(row({ clinicalState: 'Admitted', financialState: 'PartiallyPaid', balanceDue: 1200 }));
    expect(s.location).toContain('Ward A');
    expect(s.nextAction).toBe('Needs pre-op');
    expect(s.nextActionOwner).toBe('Ward');
    expect(s.financialBlocker).toContain('Patient dues');
  });

  it('assigns OT ownership after send', () => {
    const s = buildIpRowSituation(row({ clinicalState: 'SentToOT', otState: 'SentToOT' }));
    expect(s.nextAction).toBe('Awaiting OT acceptance');
    expect(s.nextActionOwner).toBe('OT');
    expect(s.location).toBe('En route to OT');
  });

  it('does not treat coverage as a clinical location', () => {
    const s = buildIpRowSituation(row({
      clinicalState: 'PostOp',
      paymentMode: 'Insurance',
      financialState: 'Confirmed',
    }));
    expect(s.nextAction).toBe('Recovery');
    expect(s.coverageBlocker).toMatch(/Coverage/);
  });

  it('describes expected and ready-for-OT as situations, not mutations', () => {
    expect(buildIpRowSituation(row({ clinicalState: 'Expected' })).nextAction).toBe('Awaiting admission');
    expect(buildIpRowSituation(row({ clinicalState: 'ReadyForSurgery' })).nextAction).toBe('Awaiting OT');
  });

  it('collapses financial and coverage blockers into a single Attention cell', () => {
    const clear = buildCensusAttention(row({ clinicalState: 'Admitted', financialState: 'Paid', balanceDue: 0 }));
    expect(clear).toEqual({ label: 'No listed blockers', tone: 'info', level: 'information' });

    const dues = buildCensusAttention(row({ clinicalState: 'Admitted', financialState: 'PartiallyPaid', balanceDue: 90000 }));
    expect(dues.tone).toBe('danger');
    expect(dues.label).toMatch(/Patient dues/);

    const both = buildCensusAttention(row({
      clinicalState: 'Admitted',
      financialState: 'Confirmed',
      balanceDue: 90000,
      paymentMode: 'Insurance',
    }));
    expect(both).toEqual({ label: '2 blockers', tone: 'danger', level: 'critical' });
    expect(dues.level).toBe('warning');
  });
});
