import { describe, expect, it } from 'vitest';
import {
  buildAnalyticsParams,
  counselorAnalyticsKeys,
} from '@/hooks/use-counselor-analytics';
import { buildCounselorAnalyticsCsv } from '@/lib/counsellors-desk/counselor-analytics-export';
import {
  buildAgreedSessionsHref,
  buildConversionSessionsHref,
  buildPendingDecisionSessionsHref,
  buildTotalSessionsHref,
} from '@/lib/counsellors-desk/analytics-drilldown';
import type { AnalyticsSummary } from '@/hooks/use-counselor-analytics';

describe('counselor analytics filter propagation', () => {
  it('Authorized Branch omits counselorId from query params', () => {
    const params = buildAnalyticsParams({
      branchId: 'b1',
      counselorId: null,
      period: 30,
    });
    expect(params.get('period')).toBe('30');
    expect(params.get('branchId')).toBe('b1');
    expect(params.has('counselorId')).toBe(false);
  });

  it('selected counselor sets counselorId on params and query key', () => {
    const cid = '48a94c56-ccb2-49c0-9916-bee2703b0251';
    const filters = { branchId: 'b1', counselorId: cid, period: 30 };
    const params = buildAnalyticsParams(filters);
    expect(params.get('counselorId')).toBe(cid);

    const summaryKey = counselorAnalyticsKeys.summary(filters);
    const trendsKey = counselorAnalyticsKeys.trends(filters);
    const agingKey = counselorAnalyticsKeys.aging({ ...filters, period: 365 });
    expect(summaryKey).toContain(cid);
    expect(trendsKey).toContain(cid);
    expect(agingKey).toContain(cid);

    const cleared = counselorAnalyticsKeys.summary({ ...filters, counselorId: null });
    expect(cleared).not.toContain(cid);
  });

  it('drilldowns preserve counselorId; Conversion uses Agreed population + Conversion label', () => {
    const cid = '48a94c56-ccb2-49c0-9916-bee2703b0251';
    const ctx = {
      branchId: 'b1',
      counselorId: cid,
      from: '2026-09-01',
      toExclusive: '2026-10-01',
    };
    expect(buildTotalSessionsHref(ctx)).toContain(`counselorId=${cid}`);
    expect(buildAgreedSessionsHref(ctx)).toContain('pendingDecision=false');
    expect(buildAgreedSessionsHref(ctx)).toContain(`counselorId=${cid}`);
    const conv = buildConversionSessionsHref(ctx);
    expect(conv).toContain('patientAgreedToSurgery=true');
    expect(conv).toContain('pendingDecision=false');
    expect(conv).toContain('analyticsOutcome=Conversion');
    expect(conv).toContain(`counselorId=${cid}`);
    expect(buildPendingDecisionSessionsHref(ctx)).toContain('pendingDecision=true');
    expect(buildPendingDecisionSessionsHref(ctx)).not.toContain('surgery-followup');
  });

  it('CSV includes selected Counselor ID', () => {
    const summary = {
      period: 30,
      from: '2026-08-11',
      toExclusive: '2026-09-11',
      totalSessions: 2,
      agreedCount: 1,
      declinedCount: 0,
      undecidedCount: 1,
      pendingDecisionCount: 1,
      exceptionCount: 0,
      otherUnclassifiedCount: 0,
      eligibleOutcomeSessions: 2,
      decisionRate: 50,
      conversionRate: 50,
      avgDaysToDecision: 1,
      bySurgeryType: [],
      bySessionType: [],
      callbackTotal: 0,
      callbackCompleted: 0,
      callbackCompletionRate: 0,
      generatedAt: '2026-09-15T00:00:00Z',
    } as AnalyticsSummary;
    const cid = '48a94c56-ccb2-49c0-9916-bee2703b0251';
    const csv = buildCounselorAnalyticsCsv(summary, { branchId: 'b1', counselorId: cid });
    expect(csv).toContain(cid);
    const allCsv = buildCounselorAnalyticsCsv(summary, { branchId: 'b1', counselorId: null });
    expect(allCsv).toMatch(/"Counselor ID",""/);
  });
});
