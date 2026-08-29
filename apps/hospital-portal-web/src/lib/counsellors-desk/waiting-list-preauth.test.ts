import { describe, expect, it } from 'vitest';
import { isWaitingListPreAuthQueue } from './waiting-list-preauth';

describe('isWaitingListPreAuthQueue', () => {
  it('requires coverage patientType AND an existing CCMS case in awaiting set', () => {
    expect(
      isWaitingListPreAuthQueue({
        patientType: 'Insurance',
        ccmsState: 'WAITING_APPROVAL',
        hasCcmsCase: true,
      }),
    ).toBe(true);
  });

  it('excludes coverage patient with no CCMS case', () => {
    expect(
      isWaitingListPreAuthQueue({
        patientType: 'Insurance',
        ccmsState: undefined,
        hasCcmsCase: false,
      }),
    ).toBe(false);
  });

  it('excludes coverage patient whose CCMS case is not awaiting', () => {
    expect(
      isWaitingListPreAuthQueue({
        patientType: 'TPA',
        ccmsState: 'APPROVED',
        hasCcmsCase: true,
      }),
    ).toBe(false);
  });

  it('excludes non-coverage patientType even with awaiting CCMS state', () => {
    expect(
      isWaitingListPreAuthQueue({
        patientType: 'Cash',
        ccmsState: 'WAITING_APPROVAL',
        hasCcmsCase: true,
      }),
    ).toBe(false);
  });

  it('uses patientType (not a separate paymentType field)', () => {
    expect(
      isWaitingListPreAuthQueue({
        patientType: 'CGHS',
        ccmsState: 'PREAUTH_GENERATED',
        hasCcmsCase: true,
      }),
    ).toBe(true);
  });
});
