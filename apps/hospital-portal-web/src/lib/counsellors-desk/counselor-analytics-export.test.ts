import { describe, expect, it } from 'vitest';
import { buildCounselorAnalyticsCsv } from './counselor-analytics-export';
import type { AnalyticsSummary } from '@/hooks/use-counselor-analytics';

const sample: AnalyticsSummary = {
  period: 30,
  totalSessions: 10,
  agreedCount: 4,
  declinedCount: 2,
  undecidedCount: 4,
  pendingDecisionCount: 4,
  exceptionCount: 0,
  otherUnclassifiedCount: 0,
  eligibleOutcomeSessions: 6,
  decisionRate: 60,
  conversionRate: 40,
  avgDaysToDecision: 3.5,
  bySurgeryType: [{ surgeryType: 'Phaco', count: 5, agreedCount: 2 }],
  bySessionType: [{ sessionType: 'New', count: 10 }],
  callbackTotal: 8,
  callbackCompleted: 6,
  callbackCompletionRate: 75,
  generatedAt: '2026-09-10T00:00:00Z',
};

describe('buildCounselorAnalyticsCsv', () => {
  it('exports API summary fields without inventing metrics', () => {
    const csv = buildCounselorAnalyticsCsv(sample, { branchId: 'b1', counselorId: 'c1' });
    expect(csv).toContain('"Total Sessions","10"');
    expect(csv).toContain('"Eligible Outcome Sessions","6"');
    expect(csv).toContain('"Pending Decision","4"');
    expect(csv).toContain('"Conversion Rate %","40"');
    expect(csv).toContain('"Phaco","5","2","40"');
    expect(csv).toContain('"Branch ID","b1"');
    expect(csv).not.toContain('Payable');
  });
});
