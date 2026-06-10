/**
 * CounselorAnalyticsTab — Phase E
 * Counselor-level analytics: conversion funnel, session mix, callback KPIs.
 * Uses GET /api/counseling/analytics/summary (no external chart library).
 */

'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import { TrendingUp, Phone, Clock, Target, RefreshCw, Users, BarChart2, Download, Printer } from 'lucide-react';
import { FollowupAgingTable } from './FollowupAgingTable';
import { ConversionFunnelChart } from './ConversionFunnelChart';
import { useCounselorAnalytics } from '@/hooks/use-counselor-analytics';
import type { AnalyticsSummary } from '@/hooks/use-counselor-analytics';

const ANALYTICS_PERIODS = [
  { value: 7,   label: '7 days'  },
  { value: 30,  label: '30 days' },
  { value: 60,  label: '60 days' },
  { value: 90,  label: '90 days' },
];

// ─── Small helpers ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-3">
      <div className={cn('p-2 rounded-lg flex-shrink-0', color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium truncate">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/** Simple horizontal bar. pct should be 0-100. */
function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-500', color)}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

function SurgeryTypeRow({
  item,
  maxCount,
}: {
  item: { surgeryType: string; count: number; agreedCount: number };
  maxCount: number;
}) {
  const convPct = item.count > 0 ? Math.round((item.agreedCount / item.count) * 100) : 0;
  const barPct  = maxCount > 0   ? (item.count / maxCount) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <p className="text-sm text-gray-700 w-36 truncate flex-shrink-0" title={item.surgeryType}>
        {item.surgeryType}
      </p>
      <Bar pct={barPct} color="bg-blue-400" />
      <span className="text-xs font-semibold text-gray-700 w-8 text-right flex-shrink-0">{item.count}</span>
      <span
        className={cn(
          'text-xs font-semibold w-12 text-right flex-shrink-0',
          convPct >= 50 ? 'text-green-600' : convPct >= 25 ? 'text-amber-500' : 'text-red-500'
        )}
      >
        {convPct}%
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CounselorAnalyticsTab() {
  const { user } = useAuthStore();
  const [period, setPeriod] = useState(30);

  const {
    data,
    isPending,
    isError,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useCounselorAnalytics(user?.branchId, period);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-blue-600" /> Counselor Analytics
          </h2>
          {lastUpdated && (
            <p className="text-xs text-gray-400 mt-0.5">Last updated {lastUpdated}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-0.5">
            {ANALYTICS_PERIODS.map(o => (
              <button
                key={o.value}
                onClick={() => setPeriod(o.value)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  period === o.value ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                )}
              >
                {o.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              if (!data) return;
              const rows = [
                ['Metric', 'Value'],
                ['Period (days)', data.period],
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
                ...data.bySurgeryType.map(r => [
                  r.surgeryType,
                  r.count,
                  r.agreedCount,
                  r.count > 0 ? Math.round((r.agreedCount / r.count) * 100) : 0,
                ]),
              ];
              const csv = rows
                .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
                .join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `counselor-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            disabled={!data}
            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="Export CSV"
          >
            <Download className="w-4 h-4 text-gray-500" />
          </button>

          <button
            onClick={() => window.print()}
            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            title="Print"
          >
            <Printer className="w-4 h-4 text-gray-500" />
          </button>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={cn('w-4 h-4 text-gray-500', isFetching && 'animate-spin')} />
          </button>
        </div>
      </div>

      {isPending && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-24 bg-white rounded-xl border border-gray-100 animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="h-48 bg-white rounded-xl border border-gray-100 animate-pulse" />
            <div className="h-48 bg-white rounded-xl border border-gray-100 animate-pulse" />
          </div>
          <div className="h-32 bg-white rounded-xl border border-gray-100 animate-pulse" />
        </div>
      )}

      {isError && !isPending && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm font-medium text-red-500">Failed to load analytics</p>
          <p className="text-xs text-gray-400 mt-1">Check that the backend is running and you have access.</p>
          <button onClick={() => refetch()} className="mt-2 text-xs text-blue-600 hover:underline">
            Try again
          </button>
        </div>
      )}

      {data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Total Sessions"
              value={data.totalSessions}
              sub={`Last ${data.period} days`}
              icon={Users}
              color="bg-blue-100 text-blue-600"
            />
            <StatCard
              label="Conversion Rate"
              value={`${data.conversionRate}%`}
              sub={`${data.agreedCount} agreed to surgery`}
              icon={Target}
              color="bg-green-100 text-green-600"
            />
            <StatCard
              label="Avg Days to Decision"
              value={data.avgDaysToDecision}
              sub="from session to decision"
              icon={Clock}
              color="bg-amber-100 text-amber-600"
            />
            <StatCard
              label="Callback Completion"
              value={`${data.callbackCompletionRate}%`}
              sub={`${data.callbackCompleted} / ${data.callbackTotal} done`}
              icon={Phone}
              color="bg-purple-100 text-purple-600"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            {/* Conversion funnel */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-indigo-500" /> Decision Funnel
              </h3>
              <ConversionFunnelChart data={data} />
              <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                <span>Decision rate</span>
                <span className="font-semibold text-gray-700">{data.decisionRate}%</span>
              </div>
            </div>

            {/* Session type mix */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-blue-500" /> Session Types
              </h3>
              {data.bySessionType.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">No data</p>
              ) : (
                <div className="space-y-2">
                  {data.bySessionType.map(st => (
                    <div key={st.sessionType} className="flex items-center gap-3">
                      <p className="text-xs text-gray-500 w-28 flex-shrink-0 truncate">{st.sessionType}</p>
                      <Bar
                        pct={data.totalSessions > 0 ? (st.count / data.totalSessions) * 100 : 0}
                        color="bg-indigo-400"
                      />
                      <span className="text-xs font-semibold text-gray-700 w-8 text-right flex-shrink-0">
                        {st.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Surgery type breakdown */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-green-500" /> Surgery Type Breakdown
            </h3>
            <div className="flex items-center gap-3 mb-2 px-0.5">
              <p className="text-[10px] font-semibold text-gray-400 w-36 flex-shrink-0">Surgery</p>
              <p className="flex-1 text-[10px] font-semibold text-gray-400">Volume</p>
              <p className="text-[10px] font-semibold text-gray-400 w-8 text-right flex-shrink-0">Total</p>
              <p className="text-[10px] font-semibold text-gray-400 w-12 text-right flex-shrink-0">Conv%</p>
            </div>
            {data.bySurgeryType.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No surgery recommendations recorded</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {data.bySurgeryType.map(item => (
                  <SurgeryTypeRow
                    key={item.surgeryType}
                    item={item}
                    maxCount={data.bySurgeryType[0]?.count ?? 1}
                  />
                ))}
              </div>
            )}
          </div>
          {/* Followup aging */}
          <div className="mt-5">
            <FollowupAgingTable />
          </div>
        </>
      )}

      {/* Always render aging table even while summary is loading */}
      {!data && !isPending && !isError && (
        <div className="mt-5">
          <FollowupAgingTable />
        </div>
      )}
    </div>
  );
}
