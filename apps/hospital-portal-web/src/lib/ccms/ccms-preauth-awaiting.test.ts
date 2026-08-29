import { describe, expect, it } from 'vitest';
import {
  CCMS_PREAUTH_AWAITING_STATES,
  isCcmsPreAuthAwaiting,
} from './ccms-preauth-awaiting';

describe('isCcmsPreAuthAwaiting (IP/CCMS awaiting SoT)', () => {
  it.each([
    'WAITING_APPROVAL',
    'PREAUTH_SENT',
    'CLARIFICATION_REQUIRED',
    'RESUBMITTED',
    'PREAUTH_GENERATED',
  ] as const)('treats %s as awaiting', (state) => {
    expect(isCcmsPreAuthAwaiting(state)).toBe(true);
  });

  it('is case-insensitive on state codes', () => {
    expect(isCcmsPreAuthAwaiting('waiting_approval')).toBe(true);
  });

  it('treats decision BLOCK as awaiting/actionable', () => {
    expect(isCcmsPreAuthAwaiting('DRAFT', 'BLOCK')).toBe(true);
    expect(isCcmsPreAuthAwaiting(null, 'BLOCK')).toBe(true);
  });

  it('does not treat approved/closed/draft states as awaiting without BLOCK', () => {
    expect(isCcmsPreAuthAwaiting('APPROVED')).toBe(false);
    expect(isCcmsPreAuthAwaiting('DRAFT')).toBe(false);
    expect(isCcmsPreAuthAwaiting('CLOSED')).toBe(false);
    expect(isCcmsPreAuthAwaiting(undefined)).toBe(false);
    expect(isCcmsPreAuthAwaiting('')).toBe(false);
  });

  it('exports the same five state codes used by IP CoverageContextBlock', () => {
    expect([...CCMS_PREAUTH_AWAITING_STATES].sort()).toEqual([
      'CLARIFICATION_REQUIRED',
      'PREAUTH_GENERATED',
      'PREAUTH_SENT',
      'RESUBMITTED',
      'WAITING_APPROVAL',
    ]);
  });
});
