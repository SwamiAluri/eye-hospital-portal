import { describe, expect, it } from 'vitest';
import {
  buildDecisionSummaryLines,
  formatScheduleSummary,
  isDecisionPhaseComplete,
  resolveDecisionPhaseBlocker,
} from './decision-workspace-presentation';
import { clarifyPhaseAdvanceHint } from './counselling-action-hints';
import type { CounsellingPhaseValidationContext } from './counselling-progress';

const baseContext: CounsellingPhaseValidationContext = {
  selectedVariantId: 'variant-1',
  hasActiveTemplate: false,
  selectedIolId: null,
  variantSubOption: null,
  iolOptionCount: 0,
  paymentType: 'Insurance',
  insuranceCompany: 'Star Health',
  decision: '',
  schedule: null,
  followUpReason: '',
  followUpDate: '',
  counsellorNotes: '',
  patientRemarks: '',
  wantToSeeDoctor: false,
  interestedToUpgrade: false,
  notRequiredPreAuth: false,
  procedureVariants: [],
};

describe('decision-workspace-presentation', () => {
  it('maps validation errors to action-bar-aligned blockers', () => {
    expect(resolveDecisionPhaseBlocker(baseContext)).toBe(
      clarifyPhaseAdvanceHint('Please select a patient decision'),
    );
    expect(
      resolveDecisionPhaseBlocker({
        ...baseContext,
        decision: 'DateForSurgery',
        paymentType: 'Cash',
      }),
    ).toBe(clarifyPhaseAdvanceHint('Please schedule surgery date and doctor'));
  });

  it('returns null blocker when decision phase is complete', () => {
    expect(
      resolveDecisionPhaseBlocker({
        ...baseContext,
        decision: 'NotInterested',
        paymentType: 'Cash',
        followUpReason: 'Financial Planning',
        followUpDate: '2026-09-15',
      }),
    ).toBeNull();
    expect(
      isDecisionPhaseComplete({
        ...baseContext,
        decision: 'NotInterested',
        paymentType: 'Cash',
        followUpReason: 'Financial Planning',
        followUpDate: '2026-09-15',
      }),
    ).toBe(true);
  });

  it('builds decision summary lines for insurance and schedule', () => {
    const summary = buildDecisionSummaryLines({
      decision: 'DateForSurgery',
      paymentType: 'Insurance',
      insuranceCompany: 'Star Health',
      schedule: {
        selectedDate: '2026-09-12',
        surgeryStartTime: '10:30',
        operationTheatre: 'OT 2',
        doctor: 'Dr Rao',
        avoidTimeFrom: '',
        avoidTimeTo: '',
      },
    });

    expect(summary?.headline).toBe('Surgery date agreed');
    expect(summary?.paymentLine).toBe('Payment: Insurance · Star Health');
    expect(summary?.detail).toContain('Surgery scheduled');
    expect(formatScheduleSummary({
      selectedDate: '2026-09-12',
      surgeryStartTime: '10:30',
      operationTheatre: 'OT 2',
      doctor: 'Dr Rao',
      avoidTimeFrom: '',
      avoidTimeTo: '',
    })).toContain('OT 2');
  });

  it('builds cash summary without insurer', () => {
    const summary = buildDecisionSummaryLines({
      decision: 'NeedsTime',
      paymentType: 'Cash',
      insuranceCompany: '',
      schedule: null,
    });

    expect(summary?.headline).toBe('Needs more time');
    expect(summary?.paymentLine).toBe('Payment: Cash');
  });

  it('never surfaces Invalid Date when schedule.selectedDate is ISO datetime', () => {
    const text = formatScheduleSummary({
      selectedDate: '2026-09-07T00:00:00',
      surgeryStartTime: '08:14',
      operationTheatre: 'OT 1',
      doctor: 'Dr Rao',
      avoidTimeFrom: '',
      avoidTimeTo: '',
    });

    expect(text).not.toBeNull();
    expect(text).not.toMatch(/Invalid Date/i);
    expect(text).toContain('8:14 AM');
    expect(text).toContain('OT 1');
  });

  it('omits date part when selectedDate is unusable but keeps time', () => {
    const text = formatScheduleSummary({
      selectedDate: 'not-a-date',
      surgeryStartTime: '08:14',
      operationTheatre: '',
      doctor: '',
      avoidTimeFrom: '',
      avoidTimeTo: '',
    });

    expect(text).not.toMatch(/Invalid Date/i);
    expect(text).toContain('8:14 AM');
  });
});
