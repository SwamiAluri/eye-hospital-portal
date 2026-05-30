'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { BarChart2, RefreshCw, AlertCircle, TrendingUp, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { getCcmsApi } from '@/lib/api/ccms/ccms-base';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnalyticsSummary {
  totalCases: number;
  activeCases: number;
  closedCases: number;
  totalApproved: number;
  totalSettled: number;
  totalOutstanding: number;
  approvalRate: number;
}

interface StateCount {
  state: string;
  count: number;
}

interface PayerCount {
  payerType: string;
  count: number;
  totalApproved: number;
}

interface TrendItem {
  month: string;
  label: string;
  newCases: number;
  closedCases: number;
  settled: number;
}

interface AnalyticsData {
  summary: AnalyticsSummary;
  byState: StateCount[];
  byPayer: PayerCount[];
  trend: TrendItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function inr(n: number) {
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(1) + 'Cr';
  if (n >= 100000)   return '₹' + (n / 100000).toFixed(1) + 'L';
  if (n >= 1000)     return '₹' + (n / 1000).toFixed(0) + 'K';
  return '₹' + n.toFixed(0);
}

function stateColor(state: string) {
  const map: Record<string, string> = {
    DRAFT:              'bg-gray-200',
    APPROVED:           'bg-green-400',
    REJECTED:           'bg-red-400',
    WAITING_APPROVAL:   'bg-amber-400',
    CLAIM_SUBMITTED:    'bg-blue-400',
    CLOSED:             'bg-emerald-500',
    RECONCILED:         'bg-emerald-400',
    SETTLEMENT_PENDING: 'bg-purple-400',
  };
  return map[state] ?? 'bg-gray-300';
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CcmsAnalyticsPage() {
  const [data,    setData]    = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: d } = await getCcmsApi().get('/ccms/analytics/summary');
      setData(d);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const trendMax = data ? Math.max(...data.trend.map(t => t.newCases), 1) : 1;
  const settledMax = data ? Math.max(...data.trend.map(t => t.settled), 1) : 1;

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] text-gray-400 font-medium">CCMS</span>
            <span className="text-gray-300">/</span>
            <span className="text-[11px] text-gray-600 font-semibold">Analytics</span>
          </div>
          <h1 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-indigo-500" />
            CCMS Analytics
          </h1>
          <p className="text-[11px] text-gray-400 mt-0.5">Coverage &amp; Claims performance metrics</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 rounded-xl px-3 py-2 hover:border-indigo-300 hover:bg-indigo-50 transition-all disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="animate-pulse h-24 bg-white border border-gray-200 rounded-2xl" />)}
          </div>
        ) : data && (
          <>
            {/* ── KPI strip ─────────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Total Cases',        value: data.summary.totalCases,         accent: 'border-l-gray-400',    iconBg: 'bg-gray-100',    iconCls: 'text-gray-600',    icon: BarChart2 },
                { label: 'Active Cases',        value: data.summary.activeCases,        accent: 'border-l-amber-400',   iconBg: 'bg-amber-50',    iconCls: 'text-amber-600',   icon: Clock },
                { label: 'Closed / Reconciled', value: data.summary.closedCases,        accent: 'border-l-emerald-400', iconBg: 'bg-emerald-50',  iconCls: 'text-emerald-600', icon: CheckCircle2 },
                { label: 'Approval Rate',       value: data.summary.approvalRate + '%', accent: 'border-l-indigo-400',  iconBg: 'bg-indigo-50',   iconCls: 'text-indigo-600',  icon: TrendingUp },
              ].map(k => (
                <div key={k.label} className={`bg-white rounded-2xl border border-gray-200 border-l-4 ${k.accent} p-4 flex items-start gap-3 hover:shadow-md transition-all`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${k.iconBg}`}>
                    <k.icon className={`w-4 h-4 ${k.iconCls}`} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{k.label}</p>
                    <p className="text-2xl font-extrabold text-gray-900 leading-none">{k.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Finance KPIs ──────────────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Approved',  value: inr(data.summary.totalApproved),    accent: 'border-l-emerald-400', gradient: 'from-emerald-500 to-teal-600' },
                { label: 'Total Settled',   value: inr(data.summary.totalSettled),     accent: 'border-l-violet-400',  gradient: 'from-violet-500 to-indigo-600' },
                { label: 'Outstanding',     value: inr(data.summary.totalOutstanding), accent: data.summary.totalOutstanding > 0 ? 'border-l-red-400' : 'border-l-gray-300', gradient: data.summary.totalOutstanding > 0 ? 'from-red-500 to-rose-600' : 'from-gray-400 to-gray-500' },
              ].map(k => (
                <div key={k.label} className={`rounded-2xl bg-gradient-to-br ${k.gradient} p-4 text-white`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">{k.label}</p>
                  <p className="text-xl font-extrabold">{k.value}</p>
                </div>
              ))}
            </div>

            {/* ── Trend chart ───────────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[11px] font-bold text-gray-700 uppercase tracking-widest">6-Month Case Trend</h2>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-[10px] text-gray-500"><span className="w-3 h-2 bg-indigo-400 rounded-sm inline-block" />New</span>
                  <span className="flex items-center gap-1.5 text-[10px] text-gray-500"><span className="w-3 h-2 bg-emerald-400 rounded-sm inline-block" />Closed</span>
                  <span className="flex items-center gap-1.5 text-[10px] text-gray-500"><span className="w-3 h-2 bg-violet-300 rounded-sm inline-block" />Settled</span>
                </div>
              </div>
              <div className="relative">
                {/* Y-axis hint */}
                <div className="absolute left-0 top-0 bottom-8 w-8 flex flex-col justify-between items-end pr-2 pointer-events-none">
                  <span className="text-[9px] text-gray-300">{trendMax}</span>
                  <span className="text-[9px] text-gray-300">{Math.round(trendMax/2)}</span>
                  <span className="text-[9px] text-gray-300">0</span>
                </div>
                {/* Gridlines */}
                <div className="ml-8 relative">
                  <div className="absolute inset-x-0 top-0 border-t border-dashed border-gray-100" />
                  <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-gray-100" />
                  <div className="absolute inset-x-0 bottom-8 border-t border-dashed border-gray-100" />
                  <div className="flex items-end gap-2 h-36 pb-8">
                    {data.trend.map(t => (
                      <div key={t.month} className="flex-1 flex flex-col items-center gap-0 justify-end" style={{ height: '100%' }}>
                        <div className="w-full flex items-end justify-center gap-0.5" style={{ height: '88px' }}>
                          <div className="flex-1 bg-indigo-400 rounded-t-md hover:bg-indigo-500 transition-all cursor-default group relative"
                            style={{ height: `${Math.max(Math.round((t.newCases / trendMax) * 84), t.newCases ? 4 : 0)}px` }}
                            title={`New: ${t.newCases}`}>
                            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-indigo-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{t.newCases}</span>
                          </div>
                          <div className="flex-1 bg-emerald-400 rounded-t-md hover:bg-emerald-500 transition-all cursor-default group relative"
                            style={{ height: `${Math.max(Math.round((t.closedCases / trendMax) * 84), t.closedCases ? 4 : 0)}px` }}
                            title={`Closed: ${t.closedCases}`}>
                            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-emerald-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{t.closedCases}</span>
                          </div>
                          <div className="flex-1 bg-violet-300 rounded-t-md hover:bg-violet-400 transition-all cursor-default group relative"
                            style={{ height: `${Math.max(Math.round((t.settled / Math.max(settledMax, 1)) * 84), t.settled ? 4 : 0)}px` }}
                            title={`Settled: ₹${t.settled}`}>
                          </div>
                        </div>
                        <p className="text-[9px] text-gray-400 whitespace-nowrap mt-1">{t.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── By State + By Payer ───────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h2 className="text-[11px] font-bold text-gray-700 uppercase tracking-widest mb-4">Cases by State</h2>
                <div className="space-y-2.5">
                  {data.byState.slice(0, 10).map(s => {
                    const pct = Math.round((s.count / Math.max(data.summary.totalCases, 1)) * 100);
                    return (
                      <div key={s.state}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold text-gray-600">{s.state.replace(/_/g, ' ')}</span>
                          <span className="text-[10px] text-gray-400 tabular-nums">{s.count} <span className="opacity-60">({pct}%)</span></span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${stateColor(s.state)}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h2 className="text-[11px] font-bold text-gray-700 uppercase tracking-widest mb-4">Cases by Payer Type</h2>
                <div className="space-y-3">
                  {data.byPayer.map((p, i) => {
                    const total = data.byPayer.reduce((s, x) => s + x.count, 0);
                    const pct = Math.round((p.count / Math.max(total, 1)) * 100);
                    const colors = ['bg-indigo-400', 'bg-blue-400', 'bg-violet-400', 'bg-pink-400'];
                    return (
                      <div key={p.payerType}>
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <p className="text-[11px] font-semibold text-gray-700 capitalize">{p.payerType}</p>
                            <p className="text-[10px] text-gray-400">Approved: {inr(p.totalApproved)}</p>
                          </div>
                          <span className="text-lg font-extrabold text-gray-800 tabular-nums">{p.count}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${colors[i % colors.length]}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Quick links ───────────────────────────────────────────────────── */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between">
              <p className="text-xs text-indigo-700">Drill into specific queues for detailed operations</p>
              <Link href="/dashboard/ccms/settlement/reconciliation"
                className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-white px-3 py-1.5 rounded-lg border border-indigo-200 hover:border-indigo-400 transition-all">
                Reconciliation <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
