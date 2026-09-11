import type { AnalyticsSummary } from '@/hooks/use-counselor-analytics';

/** CSV export uses API summary fields only — no recalculated KPIs. */
export function buildCounselorAnalyticsCsv(data: AnalyticsSummary): string {
  const rows: (string | number)[][] = [
    ['Metric', 'Value'],
    ['Period (days)', data.period ?? ''],
    ['Total Sessions', data.totalSessions],
    ['Agreed to Surgery', data.agreedCount],
    ['Declined', data.declinedCount],
    ['Undecided', data.undecidedCount],
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
