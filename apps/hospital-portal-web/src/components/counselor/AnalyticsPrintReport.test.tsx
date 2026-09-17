import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AnalyticsPrintReport } from '@/components/counselor/AnalyticsPrintReport';
import type { AnalyticsSummary, FollowupAgingData } from '@/hooks/use-counselor-analytics';

const summary = {
  period: 30,
  from: '2026-08-11T00:00:00Z',
  toExclusive: '2026-09-11T00:00:00Z',
  totalSessions: 10,
  agreedCount: 4,
  declinedCount: 2,
  undecidedCount: 3,
  pendingDecisionCount: 3,
  exceptionCount: 1,
  otherUnclassifiedCount: 0,
  eligibleOutcomeSessions: 9,
  decisionRate: 66.7,
  conversionRate: 44.4,
  avgDaysToDecision: 2,
  bySurgeryType: [{ surgeryType: 'Phaco', count: 5, agreedCount: 2 }],
  bySessionType: [{ sessionType: 'Initial', count: 10 }],
  callbackTotal: 2,
  callbackCompleted: 1,
  callbackCompletionRate: 50,
  generatedAt: '2026-09-15T00:00:00Z',
} as AnalyticsSummary;

const aging = {
  totalPending: 3,
  period: 365,
  population: 'PendingDecision',
  counts: { bucket_0_3: 1, bucket_4_7: 1, bucket_8_14: 0, bucket_15_plus: 1 },
  buckets: {
    bucket_0_3: [],
    bucket_4_7: [],
    bucket_8_14: [],
    bucket_15_plus: [],
  },
} as FollowupAgingData;

describe('AnalyticsPrintReport — printable content + visibility opt-in', () => {
  it('renders report with real Analytics content and analytics-print-root class', () => {
    const html = renderToStaticMarkup(
      React.createElement(AnalyticsPrintReport, {
        scope: {
          periodDays: 30,
          windowFrom: summary.from,
          windowToExclusive: summary.toExclusive,
          branchId: 'b1',
          branchLabel: 'b1',
          counselorId: '48a94c56-ccb2-49c0-9916-bee2703b0251',
          counselorLabel: 'Amelia Martinez',
          agingPeriod: 365,
        },
        summary,
        trends: {
          period: 30,
          trend: [{ date: '2026-09-01', count: 2, agreedCount: 1 }],
        },
        aging,
      }),
    );

    expect(html).toContain('analytics-print-root');
    expect(html).toContain('data-testid="analytics-print-report"');
    expect(html).toContain('Counsellor Analytics');
    expect(html).toContain('Amelia Martinez');
    expect(html).toContain('30 days');
    expect(html).toContain('Total Sessions');
    expect(html).toContain('>10<');
    expect(html).toContain('Eligible Outcome Sessions');
    expect(html).toContain('Count only');
    expect(html).toContain('PendingDecision Aging');
    expect(html).toContain('Phaco');
    expect(html).toContain('2026-09-01');
    expect(html).not.toContain('Critical');
    expect(html).not.toContain('class="hidden');
  });

  it('globals.css opts analytics-print-root into body* visibility:hidden print model', () => {
    const cssPath = resolve(process.cwd(), 'src/app/globals.css');
    const css = readFileSync(cssPath, 'utf8');
    expect(css).toContain('body *');
    expect(css).toContain('visibility: hidden');
    expect(css).toContain('.analytics-print-root');
    expect(css).toMatch(/\.analytics-print-root[\s\S]*visibility:\s*visible/);
    expect(css).toMatch(/\.analytics-screen[\s\S]*display:\s*none/);
  });
});
