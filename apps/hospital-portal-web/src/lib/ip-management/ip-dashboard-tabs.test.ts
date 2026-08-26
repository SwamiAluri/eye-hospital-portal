import { describe, expect, it } from 'vitest';
import {
  IP_DASHBOARD_TABS,
  matchesIpDashboardTab,
  matchesIpFinancialFilter,
  type IpDashboardTab,
} from './ip-dashboard-tabs';
import type { PatientJourneyRowDto } from '@/lib/api/ip-management.api';

function row(partial: Partial<PatientJourneyRowDto> & { clinicalState: string }): PatientJourneyRowDto {
  return {
    id: 'j1',
    uhid: 'U1',
    patientName: 'Test',
    eyeOperated: null,
    procedureName: null,
    packageAmount: 0,
    totalPaid: 0,
    balanceDue: 0,
    wardName: null,
    bedNumber: null,
    otState: 'NotSent',
    financialState: 'Draft',
    postOpState: 'NotStarted',
    admittedAt: null,
    surgeryScheduledAt: null,
    isLocked: false,
    isBillingLocked: false,
    admissionType: null,
    patientGender: null,
    patientDob: null,
    patientAge: null,
    paymentMode: null,
    isEmergencyFc: false,
    emergencyFcReason: null,
    otReturnReason: null,
    counselingSessionId: null,
    otDetailsSaved: false,
    ...partial,
  } as PatientJourneyRowDto;
}

describe('matchesIpDashboardTab', () => {
  it('keeps primary tabs clinical, not financial', () => {
    const keys = IP_DASHBOARD_TABS.map(t => t.key);
    expect(keys).not.toContain('PartiallyPaid' as IpDashboardTab);
    expect(keys).not.toContain('PendingBill' as IpDashboardTab);
    expect(matchesIpDashboardTab(row({ clinicalState: 'Admitted', financialState: 'PartiallyPaid' }), 'InHouse')).toBe(true);
    expect(matchesIpDashboardTab(row({ clinicalState: 'Admitted', financialState: 'PartiallyPaid' }), 'ReadyForOt')).toBe(false);
  });

  it('splits Ready for OT, Sent to OT, and In OT', () => {
    expect(matchesIpDashboardTab(row({ clinicalState: 'ReadyForSurgery' }), 'ReadyForOt')).toBe(true);
    expect(matchesIpDashboardTab(row({ clinicalState: 'SentToOT' }), 'SentToOt')).toBe(true);
    expect(matchesIpDashboardTab(row({ clinicalState: 'InOT' }), 'InOt')).toBe(true);
    expect(matchesIpDashboardTab(row({ clinicalState: 'SentToOT' }), 'InOt')).toBe(false);
  });

  it('maps cancel off-ramps', () => {
    expect(matchesIpDashboardTab(row({ clinicalState: 'CancelledSurgery' }), 'Cancelled')).toBe(true);
    expect(matchesIpDashboardTab(row({ clinicalState: 'AdmissionCancelled' }), 'Cancelled')).toBe(true);
  });
});

describe('matchesIpFinancialFilter', () => {
  it('treats balance and emergency FC as secondary filters', () => {
    expect(matchesIpFinancialFilter(row({ clinicalState: 'Admitted', balanceDue: 500 }), 'HasBalance')).toBe(true);
    expect(matchesIpFinancialFilter(row({ clinicalState: 'Admitted', isEmergencyFc: true }), 'EmergencyFc')).toBe(true);
    expect(matchesIpFinancialFilter(row({ clinicalState: 'Admitted', isEmergencyFc: false }), 'EmergencyFc')).toBe(false);
  });
});
