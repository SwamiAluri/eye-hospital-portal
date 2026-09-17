import type { AnalyticsSummary } from '@/hooks/use-counselor-analytics';

export type CounselorAnalyticsExportContext = {
  branchId?: string | null;
  counselorId?: string | null;
};

/** CSV export uses API summary fields only — no recalculated KPIs. */
export function buildCounselorAnalyticsCsv(
  data: AnalyticsSummary,
  ctx?: CounselorAnalyticsExportContext,
): string {
  const pendingCount = data.pendingDecisionCount ?? data.undecidedCount ?? 0;
  const rows: (string | number)[][] = [
    ['Metric', 'Value'],
    ['Period (days)', data.period ?? ''],
    ['Window From', data.from ?? ''],
    ['Window To Exclusive', data.toExclusive ?? ''],
    ['Branch ID', ctx?.branchId ?? data.branchId ?? ''],
    ['Counselor ID', ctx?.counselorId ?? data.counselorId ?? ''],
    ['Total Sessions', data.totalSessions],
    ['Eligible Outcome Sessions', data.eligibleOutcomeSessions ?? ''],
    ['Agreed to Surgery', data.agreedCount],
    ['Declined', data.declinedCount],
    ['Pending Decision', pendingCount],
    ['Exception', data.exceptionCount ?? ''],
    ['Other / Unclassified', data.otherUnclassifiedCount ?? ''],
    ['Conversion Rate %', data.conversionRate],
    ['Decision Rate %', data.decisionRate],
    ['Avg Days to Decision', data.avgDaysToDecision],
    ['Callback Total', data.callbackTotal],
    ['Callback Completed', data.callbackCompleted],
    ['Callback Completion %', data.callbackCompletionRate],
    [],
    ['Surgery Type', 'Count', 'Agreed', 'Conversion %'],
    ...data.bySurgeryType.map((r) => [
      r.surgeryType,
      r.count,
      r.agreedCount,
      r.count > 0 ? Math.round((r.agreedCount / r.count) * 100) : 0,
    ]),
  ];
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}
