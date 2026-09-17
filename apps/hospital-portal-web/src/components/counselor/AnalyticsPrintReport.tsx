/**
 * Print-only Analytics report (Phase 2Z F-PRINT).
 * Screen UI stays unchanged; this block is hidden on screen and shown for @media print.
 */

'use client';

import React from 'react';
import type {
  AnalyticsSummary,
  AnalyticsTrends,
  FollowupAgingData,
} from '@/hooks/use-counselor-analytics';

export type AnalyticsPrintScope = {
  periodDays: number;
  windowFrom?: string;
  windowToExclusive?: string;
  branchId?: string | null;
  branchLabel: string;
  counselorId?: string | null;
  counselorLabel: string;
  agingPeriod: number;
};

type Props = {
  scope: AnalyticsPrintScope;
  summary: AnalyticsSummary | undefined;
  trends: AnalyticsTrends | undefined;
  aging: FollowupAgingData | undefined;
};

function pctEligible(count: number, eligible: number): string {
  if (eligible <= 0) return '0%';
  return `${Math.round((count / eligible) * 100)}%`;
}

export function AnalyticsPrintReport({ scope, summary, trends, aging }: Props) {
  const pending = summary
    ? (summary.pendingDecisionCount ?? summary.undecidedCount ?? 0)
    : 0;
  const eligible = summary?.eligibleOutcomeSessions ?? 0;

  return (
    <div
      className="analytics-print-root"
      data-testid="analytics-print-report"
    >
      <header className="mb-4 border-b border-gray-400 pb-3">
        <p className="text-xs uppercase tracking-wide text-gray-600">Hospital Portal</p>
        <h1 className="text-xl font-semibold text-black">Counsellor Analytics</h1>
      </header>

      <section className="mb-4 text-sm" data-testid="analytics-print-scope">
        <h2 className="mb-1 text-sm font-semibold">Filters / Scope</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div>
            <dt className="text-gray-600">Date period</dt>
            <dd>{scope.periodDays} days</dd>
          </div>
          <div>
            <dt className="text-gray-600">Date window</dt>
            <dd>
              {scope.windowFrom ?? summary?.from ?? '—'} →{' '}
              {scope.windowToExclusive ?? summary?.toExclusive ?? '—'} (half-open)
            </dd>
          </div>
          <div>
            <dt className="text-gray-600">Branch</dt>
            <dd>{scope.branchLabel}</dd>
          </div>
          <div>
            <dt className="text-gray-600">Counsellor</dt>
            <dd data-testid="analytics-print-counsellor">{scope.counselorLabel}</dd>
          </div>
        </dl>
      </section>

      {!summary ? (
        <p className="text-sm text-gray-600">No analytics summary loaded for this scope.</p>
      ) : (
        <>
          <section className="mb-4 text-sm" data-testid="analytics-print-kpis">
            <h2 className="mb-1 text-sm font-semibold">KPI Summary</h2>
            <table className="w-full border-collapse text-left text-xs">
              <tbody>
                {(
                  [
                    ['Total Sessions', summary.totalSessions],
                    ['Agreed', summary.agreedCount],
                    ['Declined', summary.declinedCount],
                    ['Pending', pending],
                    ['Exception', summary.exceptionCount ?? 0],
                    ['Other / Unclassified', summary.otherUnclassifiedCount ?? 0],
                    ['Eligible Outcome Sessions', eligible],
                    ['Conversion Rate', `${summary.conversionRate}%`],
                    ['Decision Rate', `${summary.decisionRate}%`],
                    ['Average Days to Decision', summary.avgDaysToDecision],
                    [
                      'Callback Total / Completion',
                      `${summary.callbackCompleted} / ${summary.callbackTotal} (${summary.callbackCompletionRate}%)`,
                    ],
                  ] as const
                ).map(([label, value]) => (
                  <tr key={label} className="border-b border-gray-200">
                    <th className="py-1 pr-3 font-medium">{label}</th>
                    <td className="py-1 tabular-nums">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mb-4 text-sm" data-testid="analytics-print-funnel">
            <h2 className="mb-1 text-sm font-semibold">Decision Funnel</h2>
            <p className="mb-2 text-[10px] text-gray-600">
              Agreed / Declined / Pending % use Eligible ({eligible}). Exception and Other are counts
              only (included in Total, excluded from Eligible).
            </p>
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-gray-400">
                  <th className="py-1">Stage</th>
                  <th className="py-1">Count</th>
                  <th className="py-1">%</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="py-1">Total</td>
                  <td className="py-1 tabular-nums">{summary.totalSessions}</td>
                  <td className="py-1">100% of Total</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-1">Agreed</td>
                  <td className="py-1 tabular-nums">{summary.agreedCount}</td>
                  <td className="py-1">{pctEligible(summary.agreedCount, eligible)} of Eligible</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-1">Declined</td>
                  <td className="py-1 tabular-nums">{summary.declinedCount}</td>
                  <td className="py-1">{pctEligible(summary.declinedCount, eligible)} of Eligible</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-1">Pending Decision</td>
                  <td className="py-1 tabular-nums">{pending}</td>
                  <td className="py-1">{pctEligible(pending, eligible)} of Eligible</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-1">Exception</td>
                  <td className="py-1 tabular-nums">{summary.exceptionCount ?? 0}</td>
                  <td className="py-1">Count only</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-1">Other / Unclassified</td>
                  <td className="py-1 tabular-nums">{summary.otherUnclassifiedCount ?? 0}</td>
                  <td className="py-1">Count only</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="mb-4 text-sm break-inside-avoid" data-testid="analytics-print-surgery">
            <h2 className="mb-1 text-sm font-semibold">Surgery Type Breakdown</h2>
            {summary.bySurgeryType.length === 0 ? (
              <p className="text-xs text-gray-600">No surgery recommendations recorded</p>
            ) : (
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-400">
                    <th className="py-1">Surgery</th>
                    <th className="py-1">Total</th>
                    <th className="py-1">Agreed</th>
                    <th className="py-1">Conv%</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.bySurgeryType.map((row) => (
                    <tr key={row.surgeryType} className="border-b border-gray-200">
                      <td className="py-1">{row.surgeryType}</td>
                      <td className="py-1 tabular-nums">{row.count}</td>
                      <td className="py-1 tabular-nums">{row.agreedCount}</td>
                      <td className="py-1 tabular-nums">
                        {row.count > 0 ? Math.round((row.agreedCount / row.count) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="mb-4 text-sm break-inside-avoid" data-testid="analytics-print-session-types">
            <h2 className="mb-1 text-sm font-semibold">Session Types</h2>
            {summary.bySessionType.length === 0 ? (
              <p className="text-xs text-gray-600">No session type data</p>
            ) : (
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-400">
                    <th className="py-1">Type</th>
                    <th className="py-1">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.bySessionType.map((row) => (
                    <tr key={row.sessionType} className="border-b border-gray-200">
                      <td className="py-1">{row.sessionType}</td>
                      <td className="py-1 tabular-nums">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      <section className="mb-4 text-sm break-inside-avoid" data-testid="analytics-print-trends">
        <h2 className="mb-1 text-sm font-semibold">Daily Trends</h2>
        {!trends?.trend?.length ? (
          <p className="text-xs text-gray-600">No trend data for this period</p>
        ) : (
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-gray-400">
                <th className="py-1">Date</th>
                <th className="py-1">Sessions</th>
                <th className="py-1">Agreed</th>
              </tr>
            </thead>
            <tbody>
              {trends.trend.map((t) => (
                <tr key={t.date} className="border-b border-gray-200">
                  <td className="py-1">{t.date}</td>
                  <td className="py-1 tabular-nums">{t.count}</td>
                  <td className="py-1 tabular-nums">{t.agreedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mb-2 text-sm break-inside-avoid" data-testid="analytics-print-aging">
        <h2 className="mb-1 text-sm font-semibold">PendingDecision Aging</h2>
        <p className="mb-1 text-[10px] text-gray-600">
          PendingDecision population only (not Active Follow-up Center). Aging period:{' '}
          {aging?.period ?? scope.agingPeriod} days.
        </p>
        {!aging ? (
          <p className="text-xs text-gray-600">Aging data not loaded</p>
        ) : (
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-gray-400">
                <th className="py-1">Bucket</th>
                <th className="py-1">Count</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-1">0–3 days</td>
                <td className="py-1 tabular-nums">{aging.counts?.bucket_0_3 ?? aging.buckets.bucket_0_3.length}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-1">4–7 days</td>
                <td className="py-1 tabular-nums">{aging.counts?.bucket_4_7 ?? aging.buckets.bucket_4_7.length}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-1">8–14 days</td>
                <td className="py-1 tabular-nums">{aging.counts?.bucket_8_14 ?? aging.buckets.bucket_8_14.length}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-1">15+ days</td>
                <td className="py-1 tabular-nums">
                  {aging.counts?.bucket_15_plus ?? aging.buckets.bucket_15_plus.length}
                </td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-1 font-medium">Total Pending</td>
                <td className="py-1 tabular-nums font-medium">{aging.totalPending}</td>
              </tr>
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
