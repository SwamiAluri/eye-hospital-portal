import { describe, expect, it } from 'vitest';
import { funnelStagePercentage } from './analytics-funnel-pct';

describe('funnelStagePercentage PD13', () => {
  const total = 100;
  const eligible = 80; // Total - Exception - Other

  it('Total is 100% of total sessions', () => {
    const r = funnelStagePercentage('total', 100, total, eligible);
    expect(r.pct).toBe(100);
    expect(r.showEligiblePct).toBe(true);
  });

  it('Agreed / Declined / Pending use Eligible denominator', () => {
    expect(funnelStagePercentage('agreedCount', 40, total, eligible).pct).toBe(50);
    expect(funnelStagePercentage('declinedCount', 20, total, eligible).pct).toBe(25);
    expect(funnelStagePercentage('pendingDecisionCount', 20, total, eligible).pct).toBe(25);
  });

  it('Exception and Other have no Eligible percentage', () => {
    const ex = funnelStagePercentage('exceptionCount', 10, total, eligible);
    const ot = funnelStagePercentage('otherUnclassifiedCount', 10, total, eligible);
    expect(ex.pct).toBeNull();
    expect(ex.showEligiblePct).toBe(false);
    expect(ot.pct).toBeNull();
    expect(ot.showEligiblePct).toBe(false);
  });

  it('eligible zero yields 0% for outcome stages', () => {
    expect(funnelStagePercentage('agreedCount', 0, 5, 0).pct).toBe(0);
  });
});
