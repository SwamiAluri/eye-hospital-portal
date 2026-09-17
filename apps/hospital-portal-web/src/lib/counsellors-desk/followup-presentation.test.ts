import { describe, expect, it } from 'vitest';
import {
  ACTIVE_FOLLOWUP_INTENTIONS,
  formatFollowupAverage,
  formatFollowupShortDate,
  intentionPillClass,
  POST_DISCHARGE_AGING_KPI_LABEL,
} from './followup-presentation';

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
