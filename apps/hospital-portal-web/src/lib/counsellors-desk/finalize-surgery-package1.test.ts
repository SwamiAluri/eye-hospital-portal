import { describe, expect, it } from 'vitest';
import {
  NEEDS_ATTENTION_KPI_LABEL,
  countNeedsAttention,
  isCancelReasonPresent,
  isNeedsAttentionStatus,
  isReportingTimePresent,
  isReportingTimeValid,
} from './finalize-surgery-package1';

describe('Package 1 — PD-FS-01 Needs Attention predicate', () => {
  it('includes NotConfirmed and Confirmed only', () => {
    expect(isNeedsAttentionStatus('NotConfirmed')).toBe(true);
    expect(isNeedsAttentionStatus('Confirmed')).toBe(true);
  });

  it('excludes other statuses', () => {
    for (const s of ['Finalised', 'OTPrepared', 'Cancelled', 'SurgeryDone', '', undefined, null]) {
      expect(isNeedsAttentionStatus(s as never)).toBe(false);
    }
  });

  it('counts only NotConfirmed + Confirmed', () => {
    expect(
      countNeedsAttention([
        { status: 'NotConfirmed' },
        { status: 'Confirmed' },
        { status: 'Finalised' },
        { status: 'OTPrepared' },
        { status: 'Cancelled' },
        { status: 'SurgeryDone' },
      ]),
    ).toBe(2);
  });

  it('uses honest KPI label from PD-FS-01 Option A', () => {
    expect(NEEDS_ATTENTION_KPI_LABEL).toBe('Awaiting Finalise');
  });
});

describe('Package 1 — PD-FS-03 Reporting Time', () => {
  it('rejects missing Reporting Time', () => {
    expect(isReportingTimePresent('')).toBe(false);
    expect(isReportingTimePresent('   ')).toBe(false);
    expect(isReportingTimePresent(null)).toBe(false);
    expect(isReportingTimePresent(undefined)).toBe(false);
  });

  it('accepts valid Reporting Time', () => {
    expect(isReportingTimeValid('07:30')).toBe(true);
    expect(isReportingTimeValid('07:30:00')).toBe(true);
  });

  it('rejects invalid Reporting Time', () => {
    expect(isReportingTimeValid('25:00')).toBe(false);
    expect(isReportingTimeValid('ab:cd')).toBe(false);
    expect(isReportingTimeValid('7')).toBe(false);
  });
});

describe('Package 1 — PD-FS-04 Cancel reason', () => {
  it('requires a non-empty reason', () => {
    expect(isCancelReasonPresent('')).toBe(false);
    expect(isCancelReasonPresent('   ')).toBe(false);
    expect(isCancelReasonPresent('Patient deferred')).toBe(true);
  });
});
