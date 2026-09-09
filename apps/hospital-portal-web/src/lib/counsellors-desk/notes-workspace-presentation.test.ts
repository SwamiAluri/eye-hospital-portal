import { describe, expect, it } from 'vitest';
import {
  buildNotesReadinessItems,
  hasAnyNotesContent,
  isNotesPhaseComplete,
  resolveNotesPhaseBlocker,
} from './notes-workspace-presentation';
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
  decision: 'DateForSurgery',
  schedule: {
    selectedDate: '2026-09-12',
    surgeryStartTime: '10:30',
    operationTheatre: 'OT 2',
    doctor: 'Dr Rao',
    avoidTimeFrom: '',
    avoidTimeTo: '',
  },
  followUpReason: '',
  followUpDate: '',
  counsellorNotes: '',
  patientRemarks: '',
  wantToSeeDoctor: false,
  interestedToUpgrade: false,
  notRequiredPreAuth: false,
  procedureVariants: [],
};

describe('notes-workspace-presentation', () => {
  it('marks notes phase complete when decision workflow is complete', () => {
    expect(isNotesPhaseComplete(baseContext)).toBe(true);
  });

  it('returns upstream blocker when decision is incomplete', () => {
    expect(
      resolveNotesPhaseBlocker({
        ...baseContext,
        decision: '',
      }),
    ).toBe(clarifyPhaseAdvanceHint('Please select a patient decision'));
  });

  it('detects entered note content', () => {
    expect(
      hasAnyNotesContent({
        counsellorNotes: 'Discussed pricing',
        patientRemarks: '',
        doctorNotes: '',
      }),
    ).toBe(true);
  });

  it('builds compact readiness items from existing session fields', () => {
    const items = buildNotesReadinessItems(baseContext);
    expect(items).not.toBeNull();
    expect(items!.map((i) => i.label)).toEqual(['Decision', 'Surgery date', 'Payment']);
    expect(items!.find((i) => i.label === 'Decision')?.value).toMatch(/Surgery date agreed/i);
    expect(items!.find((i) => i.label === 'Payment')?.value).toBe('Insurance · Star Health');
  });

  it('omits readiness strip when decision not recorded', () => {
    expect(buildNotesReadinessItems({ ...baseContext, decision: '' })).toBeNull();
  });

  it('uses follow-up date when decision is NeedsTime', () => {
    const items = buildNotesReadinessItems({
      ...baseContext,
      decision: 'NeedsTime',
      schedule: null,
      followUpReason: 'Financial Planning',
      followUpDate: '2026-10-01',
    });
    expect(items!.find((i) => i.label === 'Follow-up')?.value).toMatch(/2026|01|Oct/i);
  });
});
