/**
 * CounselorAnalyticsTab — Counsellor operational analytics.
 * Metrics from Phase 2D Summary / Trends APIs — no client-side aggregation.
 */

'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { getApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  Target,
  RefreshCw,
  Users,
  BarChart2,
  Download,
  Printer,
} from 'lucide-react';
import { FollowupAgingTable } from './FollowupAgingTable';
import { ConversionFunnelChart, type FunnelStageKey } from './ConversionFunnelChart';
import {
  counselorAnalyticsKeys,
  useCounselorAnalytics,
  useCounselorAnalyticsTrends,
  useCounselorFollowupAging,
} from '@/hooks/use-counselor-analytics';
import { buildCounselorAnalyticsCsv } from '@/lib/counsellors-desk/counselor-analytics-export';
import {
  buildAgreedSessionsHref,
  buildConversionSessionsHref,
  buildDeclinedSessionsHref,
  buildPendingDecisionSessionsHref,
  buildSurgerySessionsHref,
  buildTotalSessionsHref,
} from '@/lib/counsellors-desk/analytics-drilldown';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives/CounsellingButton';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { useQueryClient } from '@tanstack/react-query';
import { AnalyticsPrintReport } from '@/components/counselor/AnalyticsPrintReport';
import { useHasPermission } from '@/hooks/use-permissions';
import { COUNSELLING_SESSIONS_REASSIGN_PERMISSION } from '@/lib/counsellors-desk/counselling-auth';
import {
  ANALYTICS_AUTHORIZED_BRANCH_LABEL,
  ANALYTICS_MY_WORK_LABEL,
  analyticsCounselorScopeLabel,
  resolveInitialAnalyticsCounselorId,
} from '@/lib/counsellors-desk/analytics-scope';

/** Summary/trends period presets — 7/14/30 days. */
export const ANALYTICS_PERIODS = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
] as const;

const denseBtn = 'min-h-8 !min-h-8 h-8 text-xs';

type CounselorOption = { id: string; label: string };

function displayNameFromUser(u: Record<string, unknown>): string {
  const first = String(u.firstName ?? u.FirstName ?? '').trim();
  const last = String(u.lastName ?? u.LastName ?? '').trim();
  const combined = `${first} ${last}`.trim();
  if (combined) return combined;
  const name = String(u.name ?? u.fullName ?? u.userName ?? '').trim();
  if (name) return name;
  return String(u.email ?? u.id ?? '');
}

function mapCounselorOptions(raw: unknown[]): CounselorOption[] {
  return raw
    .map((row) => {
      const u = row as Record<string, unknown>;
      return {
        id: String(u.id ?? u.userId ?? ''),
        label: displayNameFromUser(u),
      };
    })
    .filter((u) => u.id);
}

function Bar({ pct }: { pct: number }) {
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-counselling-muted">
      <div
        className="h-full rounded-full bg-counselling-primary/70 transition-all duration-500"
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

function SurgeryTypeRow({
  item,
  maxCount,
  onOpen,
}: {
  item: { surgeryType: string; count: number; agreedCount: number };
  maxCount: number;
  onOpen: () => void;
}) {
  const convPct = item.count > 0 ? Math.round((item.agreedCount / item.count) * 100) : 0;
  const barPct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 py-1.5 text-left hover:bg-counselling-muted/30"
      data-testid="analytics-surgery-row"
    >
      <p
        className="w-36 flex-shrink-0 truncate text-sm text-counselling-foreground"
        title={item.surgeryType}
      >
        {item.surgeryType}
      </p>
      <Bar pct={barPct} />
      <span className="w-8 flex-shrink-0 text-right text-xs font-semibold tabular-nums text-counselling-foreground">
        {item.count}
      </span>
      <span
        className={cn(
          'w-12 flex-shrink-0 text-right text-xs font-semibold tabular-nums',
          convPct >= 50
            ? 'text-emerald-700'
            : convPct >= 25
              ? 'text-amber-800'
              : 'text-red-800',
        )}
      >
        {convPct}%
      </span>
    </button>
  );
}

function TrendsStrip({
  trend,
}: {
  trend: { date: string; count: number; agreedCount: number }[];
}) {
  if (!trend.length) {
    return (
      <p className="py-4 text-center text-xs text-counselling-muted-foreground">
        No trend data for this period
      </p>
    );
  }
  const max = Math.max(...trend.map((t) => t.count), 1);
  return (
    <div
      className="flex h-16 items-end gap-0.5 overflow-x-auto overscroll-x-contain pb-1"
      data-testid="analytics-trends"
      aria-label="Daily session trends"
    >
      {trend.map((t) => {
        const h = Math.max(4, Math.round((t.count / max) * 56));
        return (
          <div
            key={t.date}
            className="flex min-w-[6px] flex-1 flex-col items-center justify-end"
            title={`${t.date}: ${t.count} sessions, ${t.agreedCount} agreed`}
          >
            <div
              className="w-full max-w-[10px] rounded-t-sm bg-counselling-primary/60"
              style={{ height: h }}
            />
          </div>
        );
      })}
    </div>
  );
}

function useCounselorOptions(): {
  options: CounselorOption[];
  isError: boolean;
  isPending: boolean;
  errorMessage: string | null;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: ['counseling', 'counselors', 'picker'],
    queryFn: async (): Promise<CounselorOption[]> => {
      // counseling_sessions.read — same permission as Analytics (not user.view).
      const res = await getApi().get('/Counseling/counselors');
      const raw = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
      return mapCounselorOptions(raw);
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return {
    options: query.data ?? [],
    isError: query.isError,
    isPending: query.isPending,
    errorMessage: query.isError
      ? 'Counselor list unavailable — check access and try again'
      : null,
    refetch: () => {
      void query.refetch();
    },
  };
}

export function CounselorAnalyticsTab() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, selectedBranchId } = useAuthStore();
  const hasReassignPermission = useHasPermission(COUNSELLING_SESSIONS_REASSIGN_PERMISSION);
  const currentUserId = user?.id ?? null;
  const branchId = selectedBranchId ?? user?.branchId;
  const [period, setPeriod] = useState(30);
  const [agingPeriod, setAgingPeriod] = useState(365);
  /** undefined = use PD-S11-08 default; null = Authorized Branch; string = counselor scope */
  const [counselorIdOverride, setCounselorIdOverride] = useState<
    string | null | undefined
  >(undefined);
  const defaultCounselorId = resolveInitialAnalyticsCounselorId({
    hasReassignPermission,
    currentUserId,
  });
  const counselorId =
    counselorIdOverride === undefined ? defaultCounselorId : counselorIdOverride;
  const counselorPicker = useCounselorOptions();

  const analyticsFilters = { branchId, counselorId, period };
  const agingFilters = { branchId, counselorId };

  const {
    data,
    isPending,
    isError,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useCounselorAnalytics(analyticsFilters);

  const windowDrillContext = useMemo(
    () => ({
      branchId,
      counselorId,
      from: data?.from,
      toExclusive: data?.toExclusive,
    }),
    [branchId, counselorId, data?.from, data?.toExclusive],
  );

  const trendsQuery = useCounselorAnalyticsTrends(analyticsFilters);
  const agingQuery = useCounselorFollowupAging({ ...agingFilters, period: agingPeriod });

  const selectedCounselorLabel = analyticsCounselorScopeLabel({
    counselorId,
    currentUserId,
    selectedCounselorName: counselorId
      ? counselorPicker.options.find((c) => c.id === counselorId)?.label
      : null,
  });

  const handleFunnelStage = (stage: FunnelStageKey) => {
    switch (stage) {
      case 'total':
        router.push(buildTotalSessionsHref(windowDrillContext));
        break;
      case 'agreedCount':
        router.push(buildAgreedSessionsHref(windowDrillContext));
        break;
      case 'declinedCount':
        router.push(buildDeclinedSessionsHref(windowDrillContext));
        break;
      case 'pendingDecisionCount':
        router.push(buildPendingDecisionSessionsHref(windowDrillContext));
        break;
      default:
        break;
    }
  };

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const pendingCount = data
    ? (data.pendingDecisionCount ?? data.undecidedCount ?? 0)
    : 0;

  /** Compact PD13 partition strip + conversion/decision + operational metrics. */
  const kpiItems = data
    ? [
        {
          key: 'total',
          label: 'Total',
          value: data.totalSessions,
          sub:
            data.windowMode === 'custom'
              ? 'Custom range'
              : `${data.period ?? period}d`,
          href: buildTotalSessionsHref(windowDrillContext),
        },
        {
          key: 'agreed',
          label: 'Agreed',
          value: data.agreedCount,
          sub: 'Partition',
          href: buildAgreedSessionsHref(windowDrillContext),
        },
        {
          key: 'declined',
          label: 'Declined',
          value: data.declinedCount,
          sub: 'Partition',
          href: buildDeclinedSessionsHref(windowDrillContext),
        },
        {
          key: 'pending',
          label: 'Pending',
          value: pendingCount,
          sub: 'Partition',
          href: buildPendingDecisionSessionsHref(windowDrillContext),
        },
        {
          key: 'exception',
          label: 'Exception',
          value: data.exceptionCount ?? 0,
          sub: 'In Total',
          href: null,
        },
        {
          key: 'other',
          label: 'Other',
          value: data.otherUnclassifiedCount ?? 0,
          sub: 'In Total',
          href: null,
        },
        {
          key: 'eligible',
          label: 'Eligible',
          value: data.eligibleOutcomeSessions ?? 0,
          sub: 'T−Ex−Other',
          href: null,
        },
        {
          key: 'conversion',
          label: 'Conversion',
          value: `${data.conversionRate}%`,
          sub: 'Agreed÷Elig',
          href: buildConversionSessionsHref(windowDrillContext),
        },
        {
          key: 'decision',
          label: 'Decision',
          value: `${data.decisionRate}%`,
          sub: '(A+D)÷Elig',
          href: null,
        },
        {
          key: 'avgDays',
          label: 'Avg Days',
          value: data.avgDaysToDecision,
          sub: 'To decision',
          href: null,
        },
        {
          key: 'callbacks',
          label: 'Callbacks',
          value: `${data.callbackCompletionRate}%`,
          sub: `${data.callbackCompleted}/${data.callbackTotal}`,
          href: null,
        },
      ]
    : [];

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain min-[1600px]:gap-2.5 print:overflow-visible"
      data-testid="analytics-workspace"
    >
      <AnalyticsPrintReport
        scope={{
          periodDays: period,
          windowFrom: data?.from,
          windowToExclusive: data?.toExclusive,
          branchId,
          branchLabel: branchId ?? 'Authorized branches',
          counselorId,
          counselorLabel: selectedCounselorLabel,
          agingPeriod,
        }}
        summary={data}
        trends={trendsQuery.data}
        aging={agingQuery.data}
      />

      <div className="analytics-screen flex min-h-0 min-w-0 flex-1 flex-col gap-0.5 min-[1600px]:gap-2.5">
      <div
        className={cn(
          counsellingSessionTokens.sessionWidget,
          'flex shrink-0 flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 min-[1600px]:px-4 min-[1600px]:py-2.5',
        )}
        data-testid="analytics-toolbar"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {lastUpdated && (
            <p className="text-xs text-counselling-muted-foreground">Last updated {lastUpdated}</p>
          )}
          <label className="flex items-center gap-1.5 text-xs text-counselling-muted-foreground">
            <span className="sr-only">Counselor</span>
            <select
              value={counselorId ?? ''}
              onChange={(e) => setCounselorIdOverride(e.target.value || null)}
              disabled={counselorPicker.isPending || counselorPicker.isError}
              className="h-8 max-w-[12rem] truncate rounded-md border border-counselling-border bg-counselling-card px-2 text-xs text-counselling-foreground disabled:opacity-60"
              data-testid="analytics-counselor-select"
              aria-label="Filter by counselor"
            >
              <option value="">{ANALYTICS_AUTHORIZED_BRANCH_LABEL}</option>
              {currentUserId && (
                <option value={currentUserId}>{ANALYTICS_MY_WORK_LABEL}</option>
              )}
              {counselorPicker.options
                .filter((c) => c.id !== currentUserId)
                .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <p
            className="text-[10px] text-counselling-muted-foreground"
            data-testid="analytics-counselor-scope"
          >
            Scope: {selectedCounselorLabel}
            {counselorId ? ` (${counselorId.slice(0, 8)}…)` : ''}
          </p>
          {counselorPicker.isError && (
            <p
              className="text-[10px] text-red-800"
              role="alert"
              data-testid="analytics-counselor-error"
            >
              {counselorPicker.errorMessage}{' '}
              <button
                type="button"
                className="underline"
                onClick={() => counselorPicker.refetch()}
              >
                Retry
              </button>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Period"
            className={cn(counsellingSessionTokens.pillTabTrack, 'flex-nowrap')}
            data-testid="analytics-period"
          >
            {ANALYTICS_PERIODS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setPeriod(o.value)}
                className={cn(
                  counsellingSessionTokens.pillTab,
                  'shrink-0',
                  period === o.value && counsellingSessionTokens.pillTabCurrent,
                )}
                data-testid={`analytics-period-${o.value}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <PermissionGate permission="counseling_sessions.read">
            <CounsellingButton
              type="button"
              variant="outline"
              size="sm"
              className={denseBtn}
              disabled={!data}
              title="Export CSV"
              aria-label="Export CSV"
              data-testid="analytics-export-csv"
              onClick={() => {
                if (!data) return;
                const blob = new Blob([buildCounselorAnalyticsCsv(data, { branchId, counselorId })], {
                  type: 'text/csv;charset=utf-8;',
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `counselor-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              CSV
            </CounsellingButton>
            <CounsellingButton
              type="button"
              variant="outline"
              size="sm"
              className={denseBtn}
              title="Print"
              aria-label="Print"
              data-testid="analytics-print"
              onClick={() => window.print()}
            >
              <Printer className="mr-1 h-3.5 w-3.5" />
              Print
            </CounsellingButton>
            <CounsellingButton
              type="button"
              variant="outline"
              size="sm"
              className={denseBtn}
              disabled={isFetching}
              title="Refresh"
              aria-label="Refresh"
              data-testid="analytics-refresh"
              onClick={() => {
                void queryClient.invalidateQueries({ queryKey: counselorAnalyticsKeys.all });
              }}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            </CounsellingButton>
          </PermissionGate>
        </div>
      </div>

      {isPending && (
        <div className="space-y-2" data-testid="analytics-loading" aria-hidden>
          <div
            className={cn(counsellingSessionTokens.sessionStatusStrip, 'h-16 animate-pulse')}
          />
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            <div className={cn(counsellingSessionTokens.sessionWidget, 'h-40 animate-pulse')} />
            <div className={cn(counsellingSessionTokens.sessionWidget, 'h-40 animate-pulse')} />
          </div>
        </div>
      )}

      {isError && !isPending && (
        <div
          className={cn(
            counsellingSessionTokens.sessionWidget,
            'px-4 py-10 text-center',
          )}
          data-testid="analytics-error"
          role="alert"
        >
          <p className="text-sm font-medium text-red-800">Failed to load analytics</p>
          <p className="mt-1 text-xs text-counselling-muted-foreground">
            Check that the backend is running and you have access.
          </p>
          <CounsellingButton
            type="button"
            variant="outline"
            size="sm"
            className={cn(denseBtn, 'mt-3')}
            onClick={() => void refetch()}
          >
            Try again
          </CounsellingButton>
        </div>
      )}

      {data && (
        <>
          <div
            data-testid="analytics-summary"
            className={cn(counsellingSessionTokens.sessionStatusStrip, 'shrink-0')}
            aria-label="Analytics KPIs"
          >
            <dl
              className={cn(
                counsellingSessionTokens.sessionStatusDetails,
                'grid-cols-3 gap-x-2 gap-y-1 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11',
              )}
            >
              {kpiItems.map((item) => (
                <div key={item.label} className="min-w-0">
                  {item.href ? (
                    <button
                      type="button"
                      onClick={() => router.push(item.href!)}
                      className="text-left hover:opacity-80"
                      data-testid={`analytics-kpi-${item.key}`}
                    >
                      <dd className="text-base font-semibold leading-5 tabular-nums text-counselling-foreground min-[1600px]:text-lg">
                        {item.value}
                      </dd>
                      <dt className={counsellingSessionTokens.sessionStatusDetailLabel}>
                        {item.label}
                      </dt>
                      <p className="text-[10px] text-counselling-muted-foreground">{item.sub}</p>
                    </button>
                  ) : (
                    <>
                      <dd className="text-base font-semibold leading-5 tabular-nums text-counselling-foreground min-[1600px]:text-lg">
                        {item.value}
                      </dd>
                      <dt className={counsellingSessionTokens.sessionStatusDetailLabel}>
                        {item.label}
                      </dt>
                      <p className="text-[10px] text-counselling-muted-foreground">{item.sub}</p>
                    </>
                  )}
                </div>
              ))}
            </dl>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-0.5 min-[1600px]:gap-2.5 lg:grid-cols-2">
            <div
              className={cn(counsellingSessionTokens.sessionWidget, 'min-w-0 p-3 min-[1600px]:p-4')}
              data-testid="analytics-funnel"
            >
              <h2 className={cn(counsellingSessionTokens.sessionWidgetTitle, 'mb-2')}>
                <TrendingUp className="h-4 w-4 text-counselling-primary" aria-hidden />
                Decision Funnel
              </h2>
              <ConversionFunnelChart data={data} onStageClick={handleFunnelStage} />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-counselling-border/50 pt-2 text-xs text-counselling-muted-foreground">
                <span>Decision rate (eligible)</span>
                <span className="font-semibold tabular-nums text-counselling-foreground">
                  {data.decisionRate}%
                </span>
              </div>
            </div>

            <div
              className={cn(counsellingSessionTokens.sessionWidget, 'min-w-0 p-3 min-[1600px]:p-4')}
              data-testid="analytics-session-mix"
            >
              <h2 className={cn(counsellingSessionTokens.sessionWidgetTitle, 'mb-2')}>
                <BarChart2 className="h-4 w-4 text-counselling-primary" aria-hidden />
                Session Types
              </h2>
              {data.bySessionType.length === 0 ? (
                <p className="py-6 text-center text-xs text-counselling-muted-foreground">No data</p>
              ) : (
                <div className="space-y-2">
                  {data.bySessionType.map((st) => (
                    <div key={st.sessionType} className="flex items-center gap-3">
                      <p className="w-28 flex-shrink-0 truncate text-xs text-counselling-muted-foreground">
                        {st.sessionType}
                      </p>
                      <Bar
                        pct={
                          data.totalSessions > 0 ? (st.count / data.totalSessions) * 100 : 0
                        }
                      />
                      <span className="w-8 flex-shrink-0 text-right text-xs font-semibold tabular-nums text-counselling-foreground">
                        {st.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div
            className={cn(counsellingSessionTokens.sessionWidget, 'min-w-0 p-3 min-[1600px]:p-4')}
            data-testid="analytics-surgery-mix"
          >
            <h2 className={cn(counsellingSessionTokens.sessionWidgetTitle, 'mb-2')}>
              <Target className="h-4 w-4 text-counselling-primary" aria-hidden />
              Surgery Type Breakdown
            </h2>
            <div className="mb-2 flex items-center gap-3 px-0.5">
              <p className="w-36 flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground">
                Surgery
              </p>
              <p className="flex-1 text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground">
                Volume
              </p>
              <p className="w-8 flex-shrink-0 text-right text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground">
                Total
              </p>
              <p className="w-12 flex-shrink-0 text-right text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground">
                Conv%
              </p>
            </div>
            {data.bySurgeryType.length === 0 ? (
              <p className="py-6 text-center text-xs text-counselling-muted-foreground">
                No surgery recommendations recorded
              </p>
            ) : (
              <div className="divide-y divide-counselling-border/40">
                {data.bySurgeryType.map((item) => (
                  <SurgeryTypeRow
                    key={item.surgeryType}
                    item={item}
                    maxCount={data.bySurgeryType[0]?.count ?? 1}
                    onOpen={() =>
                      router.push(
                        buildSurgerySessionsHref(windowDrillContext, item.surgeryType),
                      )
                    }
                  />
                ))}
              </div>
            )}
          </div>

          <div
            className={cn(counsellingSessionTokens.sessionWidget, 'min-w-0 p-3 min-[1600px]:p-4')}
            data-testid="analytics-trends-widget"
          >
            <h2 className={cn(counsellingSessionTokens.sessionWidgetTitle, 'mb-2')}>
              <Users className="h-4 w-4 text-counselling-primary" aria-hidden />
              Daily Trends
            </h2>
            {trendsQuery.isPending ? (
              <div className="h-16 animate-pulse rounded-md bg-counselling-muted" />
            ) : trendsQuery.isError ? (
              <p className="text-xs text-counselling-muted-foreground">
                Trends unavailable
                <button
                  type="button"
                  className="ml-2 text-counselling-primary underline"
                  onClick={() => void trendsQuery.refetch()}
                >
                  Retry
                </button>
              </p>
            ) : (
              <TrendsStrip trend={trendsQuery.data?.trend ?? []} />
            )}
          </div>

          <FollowupAgingTable
            filters={agingFilters}
            agingPeriod={agingPeriod}
            onAgingPeriodChange={setAgingPeriod}
          />
        </>
      )}

      {!data && !isPending && !isError && (
        <FollowupAgingTable
          filters={agingFilters}
          agingPeriod={agingPeriod}
          onAgingPeriodChange={setAgingPeriod}
        />
      )}
      </div>
    </div>
  );
}
