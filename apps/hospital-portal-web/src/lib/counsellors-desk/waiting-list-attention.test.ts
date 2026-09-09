import { describe, expect, it } from 'vitest';
import { resolveWaitingListAttention } from './waiting-list-attention';

describe('resolveWaitingListAttention', () => {
  it('returns CCMS Awaiting when Insurance + WAITING_APPROVAL + hasCcmsCase true', () => {
    expect(
      resolveWaitingListAttention({
        status: 'Pending',
        patientType: 'Insurance',
        ccmsState: 'WAITING_APPROVAL',
        hasCcmsCase: true,
      }),
    ).toBe('CCMS Awaiting');
  });

  it('returns Pre-Auth Required when Insurance + hasCcmsCase false', () => {
    expect(
      resolveWaitingListAttention({
        status: 'Pending',
        patientType: 'Insurance',
        hasCcmsCase: false,
      }),
    ).toBe('Pre-Auth Required');
  });

  it('returns null for Cash', () => {
    expect(
      resolveWaitingListAttention({
        status: 'Pending',
        patientType: 'Cash',
        hasCcmsCase: false,
      }),
    ).toBeNull();
  });

  it('returns Follow-up Due for RepeatCounselling with followUpDate', () => {
    expect(
      resolveWaitingListAttention({
        status: 'RepeatCounselling',
        patientType: 'Cash',
        hasCcmsCase: false,
        followUpDate: '2026-09-10',
      }),
    ).toBe('Follow-up Due');
  });

  it('returns Upgrade Requested for AddOnSurgery with packages', () => {
    expect(
      resolveWaitingListAttention({
        status: 'AddOnSurgery',
        patientType: 'Cash',
        hasCcmsCase: false,
        previousPackage: 'Basic',
        newPackage: 'Premium',
      }),
    ).toBe('Upgrade Requested');
  });

  it('CCMS Awaiting beats Pre-Auth Required (PREAUTH_SENT + hasCcmsCase)', () => {
    expect(
      resolveWaitingListAttention({
        status: 'Pending',
        patientType: 'Insurance',
        ccmsState: 'PREAUTH_SENT',
        hasCcmsCase: true,
      }),
    ).toBe('CCMS Awaiting');
  });
});
