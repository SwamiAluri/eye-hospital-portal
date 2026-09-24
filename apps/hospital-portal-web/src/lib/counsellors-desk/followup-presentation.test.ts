import { describe, expect, it } from 'vitest';
import {
  ACTIVE_FOLLOWUP_INTENTIONS,
  FOLLOWUP_TABS,
  formatFollowupAverage,
  formatFollowupShortDate,
  formatOriginalCounsellorAttribution,
  intentionPillClass,
  POST_DISCHARGE_AGING_KPI_LABEL,
} from './followup-presentation';
import type {
  FollowupListQueryParams,
  PostSurgeryFollowupRecord,
} from '@/types/counsellors-desk';

describe('followup-presentation', () => {
  it('exposes only backend active intention allowlist (+ All)', () => {
    const values = ACTIVE_FOLLOWUP_INTENTIONS.map((i) => i.value).filter(Boolean);
    expect(values).toEqual([
      'WillingWeek',
      'WillingMonth',
      'WillingQuarter',
      'WillingCallToConfirm',
      'Undecided',
      'WaitingFinancial',
      'WaitingFear',
    ]);
  });

  it('formats nullable averages without inventing zero', () => {
    expect(formatFollowupAverage(null)).toBe('—');
    expect(formatFollowupAverage(undefined)).toBe('—');
    expect(formatFollowupAverage(2)).toBe('2');
    expect(formatFollowupAverage(1.25)).toBe('1.3');
  });

  it('formats short dates for contact columns', () => {
    expect(formatFollowupShortDate('2026-09-01T00:00:00Z')).toMatch(/01/);
  });

  it('maps intention pills without due-date heuristics', () => {
    expect(intentionPillClass('Declined')).toContain('red');
    expect(intentionPillClass('WillingWeek')).toContain('emerald');
  });

  it('Phase2Y: Post aging KPI is factual discharge age, not overdue/priority', () => {
    expect(POST_DISCHARGE_AGING_KPI_LABEL).toBe('Discharged ≥30 days');
    expect(POST_DISCHARGE_AGING_KPI_LABEL.toLowerCase()).not.toContain('overdue');
    expect(POST_DISCHARGE_AGING_KPI_LABEL.toLowerCase()).not.toContain('priority');
    expect(POST_DISCHARGE_AGING_KPI_LABEL).not.toBe('Over 30 Days');
  });
});

/** Phase 3I Slice 10 — Follow-up Center ownership/lifecycle honesty (presentation only). */
describe('Phase 3I Slice 10 — Original Counsellor attribution', () => {
  it('labels resolved name as Original Counsellor (not Owner)', () => {
    const label = formatOriginalCounsellorAttribution({
      counselorId: 'c1',
      counselorName: 'Amelia Martinez',
    });
    expect(label).toBe(' · Original Counsellor: Amelia Martinez');
    expect(label).not.toMatch(/\bOwner\b/);
    expect(label).not.toContain('Assigned To');
    expect(label).not.toContain('Follow-up Owner');
    expect(label).not.toContain('Current Owner');
  });

  it('labels null CounselorId as Original Counsellor Unassigned', () => {
    const label = formatOriginalCounsellorAttribution({
      counselorId: null,
      counselorName: null,
    });
    expect(label).toBe(' · Original Counsellor: Unassigned');
    expect(label).not.toMatch(/\bOwner\b/);
    expect(label).not.toContain('Claim');
  });

  it('labels unresolved name (id present, name null) without Owner wording', () => {
    const label = formatOriginalCounsellorAttribution({
      counselorId: 'c-unknown',
      counselorName: null,
    });
    expect(label).toBe(' · Original Counsellor: Unresolved');
    expect(label).not.toMatch(/\bOwner\b/);
  });

  it('Center tabs stay Active / Cold / Post-Surgery — no My Follow-ups', () => {
    const labels = FOLLOWUP_TABS.map((t) => t.label);
    expect(labels).toEqual(['Active', 'Cold Leads', 'Post-Surgery']);
    expect(labels.join(' ')).not.toMatch(/My Follow-?ups/i);
    expect(labels.join(' ')).not.toMatch(/Assigned to Me/i);
  });

  it('Follow-up list query params do not include counselorId (shared queue)', () => {
    const keys: (keyof FollowupListQueryParams)[] = [
      'branchId',
      'intention',
      'q',
      'page',
      'pageSize',
    ];
    expect(keys).not.toContain('counselorId' as keyof FollowupListQueryParams);
    type Forbidden = Extract<keyof FollowupListQueryParams, 'counselorId' | 'assignedTo' | 'mine'>;
    type AssertNever = Forbidden extends never ? true : never;
    const ok: AssertNever = true;
    expect(ok).toBe(true);
  });

  it('Post-Surgery record type has no counselor attribution fields', () => {
    type PostKeys = keyof PostSurgeryFollowupRecord;
    type Forbidden = Extract<PostKeys, 'counselorId' | 'counselorName'>;
    type AssertNever = Forbidden extends never ? true : never;
    const ok: AssertNever = true;
    expect(ok).toBe(true);
  });
});
