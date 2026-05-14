'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getOperationalSummary,
  getPendingPreAuths,
  type OperationalSummary,
  type PendingPreAuthItem,
} from '@/lib/api/ccms/ccms-dashboard.api';
import { PreAuthStatusBadge } from '@/components/ccms/PreAuthStatusBadge';
import { FileCheck, Clock, AlertCircle, TrendingUp, RefreshCw } from 'lucide-react';

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className={`rounded-xl p-4 ${color}`}>
      <p className="text-xs font-medium opacity-75 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function CcmsDashboardPage() {
  const [summary, setSummary] = useState<OperationalSummary | null>(null);
  const [pending, setPending] = useState<PendingPreAuthItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([getOperationalSummary(), getPendingPreAuths()])
      .then(([s, p]) => { setSummary(s); setPending(p); })
      .catch(e => setError(e?.message ?? 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-indigo-600" />
            Coverage & Claims Management
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Operational overview</p>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* KPI Cards */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl p-4 bg-gray-100 animate-pulse h-24" />
            ))}
          </div>
        ) : summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Active Cases"       value={summary.totalActiveCases}     color="bg-indigo-50 text-indigo-800" />
            <KpiCard label="Pending Pre-Auths"  value={summary.pendingPreAuths}      color="bg-yellow-50 text-yellow-800" sub={`Avg ${(summary.avgPreAuthTurnaroundHours ?? 0).toFixed(0)}h TAT`} />
            <KpiCard label="Pending Claims"     value={summary.pendingClaims}        color="bg-orange-50 text-orange-800" />
            <KpiCard label="Pending Settlements"value={summary.pendingSettlements}   color="bg-red-50 text-red-800" />
          </div>
        )}

        {/* Financial Summary */}
        {!loading && summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard label="Approved MTD"   value={`₹${((summary.totalApprovedAmountMtd ?? 0) / 1000).toFixed(0)}K`} color="bg-green-50 text-green-800" />
            <KpiCard label="Settled MTD"    value={`₹${((summary.totalSettledAmountMtd ?? 0) / 1000).toFixed(0)}K`}  color="bg-teal-50 text-teal-800" />
            <KpiCard label="Rejection Rate" value={`${(summary.rejectionRatePct ?? 0).toFixed(1)}%`}                  color={(summary.rejectionRatePct ?? 0) > 15 ? 'bg-red-50 text-red-800' : 'bg-gray-100 text-gray-800'} />
          </div>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { href: '/dashboard/ccms/cases',         label: 'All Cases',          icon: FileCheck },
            { href: '/dashboard/ccms/authorization', label: 'Auth Queue',         icon: Clock },
            { href: '/dashboard/ccms/claims',        label: 'Claims',             icon: TrendingUp },
            { href: '/dashboard/ccms/settlement',    label: 'Settlements',        icon: FileCheck },
            { href: '/dashboard/ccms/master-data/payers', label: 'Payers / TPA', icon: FileCheck },
            { href: '/dashboard/ccms/analytics/operational', label: 'Analytics', icon: TrendingUp },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-xl p-4 bg-white border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all text-sm font-medium text-gray-700"
            >
              <Icon className="w-4 h-4 text-indigo-500" />
              {label}
            </Link>
          ))}
        </div>

        {/* Pending Pre-Auths table */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-800">Urgent Pre-Auth Queue</h2>
            <Link href="/dashboard/ccms/authorization" className="text-xs text-indigo-600 hover:underline">View all</Link>
          </div>
          {loading ? (
            <div className="p-4 animate-pulse space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded" />)}
            </div>
          ) : pending.length === 0 ? (
            <p className="p-6 text-sm text-center text-gray-400">No urgent pre-auths pending.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="px-4 py-2 text-left font-medium">Case #</th>
                    <th className="px-4 py-2 text-left font-medium">Payer</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                    <th className="px-4 py-2 text-left font-medium">State</th>
                    <th className="px-4 py-2 text-right font-medium">Age</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pending.slice(0, 10).map(p => (
                    <tr key={p.caseId} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <Link href={`/dashboard/ccms/cases/${p.caseId}`} className="text-indigo-600 hover:underline font-medium text-xs">
                          {p.caseId.slice(0, 8)}…
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-600">{p.payerName}</td>
                      <td className="px-4 py-2 text-xs text-right font-medium">₹{p.requestedAmount.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-2"><PreAuthStatusBadge state={p.currentState} /></td>
                      <td className="px-4 py-2 text-xs text-right text-gray-500">{p.ageInHours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
