import { describe, expect, it } from 'vitest';
import type { PatientJourneyRowDto, WardBedDto } from '@/lib/api/ip-management.api';
import { resolveIpRoleActions } from './ip-role-actions';
import {
  blockingSummary,
  clinicalStateToChip,
  countWardQueue,
  defaultWardQueue,
  isDayCareWard,
  matchesWardKpi,
  matchesWardQueue,
  occupancySummary,
  resolveEffectiveWardQueue,
  resolveWardNextAction,
  returnedFromOtCount,
  rowLooksReadyForOt,
} from './ward-board-queues';

function journey(partial: Partial<PatientJourneyRowDto> = {}): PatientJourneyRowDto {
  return {
    id: 'j1',
    uhid: 'UAT-002',
    patientName: 'Meena Iyer',
    eyeOperated: 'OD',
    procedureName: 'Phaco',
    packageAmount: 0,
    totalPaid: 0,
    balanceDue: 0,
    wardName: 'Day Care Ward',
    bedNumber: 'C-04',
    clinicalState: 'Admitted',
    otState: 'NotSent',
    financialState: 'Draft',
    postOpState: 'None',
    admittedAt: '2026-08-25T07:05:00Z',
    surgeryScheduledAt: '2026-08-25T08:00:00Z',
    isLocked: false,
    isBillingLocked: false,
    admissionType: 'DayCare',
    patientGender: 'F',
    patientDob: null,
    patientAge: 54,
    paymentMode: 'cash',
    isEmergencyFc: false,
    emergencyFcReason: null,
    otReturnReason: null,
    counselingSessionId: null,
    otDetailsSaved: false,
    pacCompleted: true,
    readinessCompleted: 9,
    readinessTotal: 9,
    unverifiedCriticalCount: 0,
    ...partial,
  };
}

const nurse = resolveIpRoleActions(['ward.checklist.edit', 'ip.ot.mark_ready', 'ip.admit', 'ip.ot.send', 'ip.discharge']);

describe('ward board queues', () => {
  it('defaults Needs me for ward nurses and On ward for coordinators', () => {
    expect(defaultWardQueue('ward')).toBe('need');
    expect(defaultWardQueue('coordinator')).toBe('ward');
    expect(defaultWardQueue('admin')).toBe('ward');
  });

  it('treats queues as filters over existing clinical states', () => {
    const admitted = journey();
    const expected = journey({ clinicalState: 'Expected', wardName: null, bedNumber: null });
    const inOt = journey({ clinicalState: 'InOT' });
    const discharged = journey({ clinicalState: 'Discharged' });
    expect(matchesWardQueue(admitted, 'need')).toBe(true);
    expect(matchesWardQueue(admitted, 'ward')).toBe(true);
    expect(matchesWardQueue(expected, 'arrive')).toBe(true);
    expect(matchesWardQueue(expected, 'ward')).toBe(false);
    expect(matchesWardQueue(inOt, 'ot')).toBe(true);
    expect(matchesWardQueue(inOt, 'need')).toBe(false);
    expect(matchesWardQueue(discharged, 'more')).toBe(true);
  });

  it('falls through empty Needs me to On ward without inventing rows', () => {
    const onWard = [journey({ clinicalState: 'Admitted', pacCompleted: true })];
    const emptyNeed = [journey({ clinicalState: 'InOT' })];
    expect(resolveEffectiveWardQueue('need', emptyNeed)).toEqual({ queue: 'ward', fellThrough: true });
    expect(countWardQueue(emptyNeed, 'need')).toBe(0);
    expect(resolveEffectiveWardQueue('need', onWard).fellThrough).toBe(false);
  });

  it('detects day-care from ward type or name', () => {
    expect(isDayCareWard({ wardName: 'General', wardType: 'DayCare' })).toBe(true);
    expect(isDayCareWard({ wardName: 'Day Care Ward', wardType: 'IPD' })).toBe(true);
    expect(isDayCareWard({ wardName: 'General Ward', wardType: 'IPD' })).toBe(false);
  });
});

describe('ward next action', () => {
  it('uses Open pre-op when Admitted is not ready', () => {
    const blocked = journey({ pacCompleted: false, readinessCompleted: 7, readinessTotal: 9 });
    expect(rowLooksReadyForOt(blocked)).toBe(false);
    expect(resolveWardNextAction(blocked, 'ward', nurse)).toEqual({
      label: 'Open pre-op',
      kind: 'preop',
      primary: false,
    });
    expect(resolveWardNextAction(blocked, 'coordinator', nurse).label).toBe('Chase PAC');
  });

  it('offers one-click Mark ready for OT when the row looks clear', () => {
    const ready = journey();
    expect(rowLooksReadyForOt(ready)).toBe(true);
    expect(resolveWardNextAction(ready, 'ward', nurse)).toEqual({
      label: 'Mark ready for OT',
      kind: 'markReady',
      primary: true,
    });
  });

  it('does not mark ready without ready permission', () => {
    const noReady = resolveIpRoleActions(['ip_management.view']);
    const ready = journey();
    expect(resolveWardNextAction(ready, 'ward', noReady).kind).not.toBe('markReady');
  });
});

describe('occupancy and chips', () => {
  it('summarises bed kinds from the existing bed DTO', () => {
    const beds = [
      { bedId: '1', bedStatus: 'Occupied', isAvailable: false },
      { bedId: '2', bedStatus: 'Available', isAvailable: true },
      { bedId: '3', bedStatus: 'Cleaning', isAvailable: false },
      { bedId: '4', bedStatus: 'Reserved', isAvailable: false },
    ] as WardBedDto[];
    expect(occupancySummary(beds)).toEqual({
      total: 4, occupied: 1, available: 1, cleaning: 1, reserved: 1,
    });
  });

  it('maps clinical states to labelled StatusChip vocab without colour-only status', () => {
    expect(clinicalStateToChip('Admitted')).toEqual({ status: 'in-progress', label: 'Admitted' });
    expect(clinicalStateToChip('InOT').label).toBe('In OT');
    expect(clinicalStateToChip('CancelledSurgery').status).toBe('rejected');
  });

  it('counts returned-from-OT from journey fields', () => {
    expect(returnedFromOtCount([
      journey({ otReturnReason: 'BP high' }),
      journey({ otReturnReason: null }),
      journey({ otReturnReason: 'x', clinicalState: 'Discharged' }),
    ])).toBe(1);
  });

  it('joins blockers as text, not colour', () => {
    expect(blockingSummary(journey({ pacCompleted: false, unverifiedCriticalCount: 1 }))).toBe('PAC · Critical lab');
  });

  it('treats KPI chips as filters over existing journeys', () => {
    expect(matchesWardKpi(journey({ pacCompleted: false }), 'pacPending')).toBe(true);
    expect(matchesWardKpi(journey({ otReturnReason: 'BP' }), 'returnedFromOt')).toBe(true);
    expect(matchesWardKpi(journey({ clinicalState: 'Discharged', otReturnReason: 'BP' }), 'returnedFromOt')).toBe(false);
  });
});
