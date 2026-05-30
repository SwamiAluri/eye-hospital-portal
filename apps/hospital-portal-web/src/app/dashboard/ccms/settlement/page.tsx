'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { getAgingReport, type AgingBucket } from '@/lib/api/ccms/ccms-settlements.api';
import { RefreshCw, AlertCircle, Landmark, GitMerge, TrendingDown, ArrowRight } from 'lucide-react';

export default function CcmsSettlementPage() {
  const [aging, setAging]     = useState<AgingBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getAgingReport()
      .then(setAging)
      .catch(e => setError((e as Error)?.message ?? 'Failed to load settlement data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const totalOutstanding = aging.reduce((s, b) => s + b.totalAmount, 0);
  const totalCases       = aging.reduce((s, b) => s + b.count, 0);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] text-gray-400 font-medium">CCMS</span>
            <span className="text-gray-300">/</span>
            <span className="text-[11px] text-gray-600 font-semibold">Settlements</span>
          </div>
          <h1 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
            <Landmark className="w-4 h-4 text-violet-500" />
            Settlements &amp; Reconciliation
          </h1>
          <p className="text-[11px] text-gray-400 mt-0.5">Track payments, aging, and close settled cases</p>
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

        {/* KPI summary tiles */}
        {!loading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total Cases',     value: totalCases,  accent: 'border-l-violet-400', iconBg: 'bg-violet-50', iconColor: 'text-violet-600', Icon: Landmark },
              { label: 'Outstanding',     value: `₹${totalOutstanding >= 100000 ? (totalOutstanding/100000).toFixed(1)+'L' : (totalOutstanding/1000).toFixed(0)+'K'}`,  accent: 'border-l-red-400', iconBg: 'bg-red-50', iconColor: 'text-red-600', Icon: TrendingDown },
              { label: 'Overdue (>30d)',  value: aging.filter(b => b.bucket.includes('60') || b.bucket.includes('90') || b.bucket.includes('>')).reduce((s,b) => s+b.count, 0),  accent: 'border-l-amber-400', iconBg: 'bg-amber-50', iconColor: 'text-amber-600', Icon: AlertCircle },
              { label: 'Up to Date',     value: aging.find(b => b.bucket.includes('30') && !b.bucket.includes('60'))?.count ?? 0,  accent: 'border-l-emerald-400', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', Icon: GitMerge },
            ].map(({ label, value, accent, iconBg, iconColor, Icon }) => (
              <div key={label} className={`bg-white border border-gray-200 border-l-4 ${accent} rounded-2xl p-4 flex items-start gap-3 hover:shadow-md transition-all`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                  <Icon className={`w-4 h-4 ${iconColor}`} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
                  <p className="text-2xl font-extrabold text-gray-900 leading-none">{value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Navigation cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/dashboard/ccms/operations/settlement"
            className="group bg-white border border-indigo-100 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-md transition-all flex items-start justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mb-3">
                <Landmark className="w-5 h-5 text-indigo-600" />
              </div>
              <p className="text-sm font-bold text-gray-900">Settlement Desk</p>
              <p className="text-xs text-gray-500 mt-1">
                Record payments, track outstanding amounts, and view partial settlements by case.
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 mt-1 flex-shrink-0 transition-colors" />
          </Link>

          <Link href="/dashboard/ccms/settlement/reconciliation"
            className="group bg-white border border-green-100 rounded-2xl p-5 hover:border-green-300 hover:shadow-md transition-all flex items-start justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mb-3">
                <GitMerge className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-sm font-bold text-gray-900">Reconciliation Workbench</p>
              <p className="text-xs text-gray-500 mt-1">
                Review discrepancies, approve write-offs, and close fully settled cases.
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-green-500 mt-1 flex-shrink-0 transition-colors" />
          </Link>
        </div>

        {/* Aging summary strip */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <p className="text-[11px] font-bold text-gray-700 uppercase tracking-widest flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-red-500" />
              Outstanding Aging
            </p>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>{totalCases} cases</span>
              <span className="font-bold text-red-600">₹{(totalOutstanding / 100000).toFixed(1)}L outstanding</span>
            </div>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-100">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="animate-pulse bg-white p-5 h-24" />)}
            </div>
          ) : aging.length === 0 ? (
            <div className="py-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-2">
                <Landmark className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-sm font-semibold text-green-700">All settlements current</p>
              <p className="text-xs text-gray-400 mt-0.5">No outstanding aging buckets.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-gray-100">
              {aging.map(b => {
                const isOld = b.bucket.includes('90') || b.bucket.includes('>');
                const pct = totalCases > 0 ? (b.count / totalCases) * 100 : 0;
                const { bar, text, bg } = isOld
                  ? { bar: 'bg-red-500',   text: 'text-red-700',   bg: 'bg-red-50' }
                  : b.bucket.includes('60')
                  ? { bar: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50' }
                  : b.bucket.includes('30')
                  ? { bar: 'bg-amber-500',  text: 'text-amber-700',  bg: 'bg-amber-50' }
                  : { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' };
                return (
                  <div key={b.bucket} className={`p-5 ${bg}`}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">{b.bucket}</p>
                    <p className={`text-2xl font-extrabold ${text}`}>{b.count}</p>
                    <p className={`text-xs font-semibold ${text} opacity-70 mt-0.5`}>
                      ₹{b.totalAmount >= 100000
                        ? (b.totalAmount / 100000).toFixed(1) + 'L'
                        : (b.totalAmount / 1000).toFixed(0) + 'K'}
                    </p>
                    <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
                      <div className={`h-full ${bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick link to full cases */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between">
          <p className="text-xs text-indigo-700">View individual case settlements from the case detail page.</p>
          <Link href="/dashboard/ccms/cases"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-indigo-200 hover:border-indigo-400 transition-all">
            Browse Cases <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
