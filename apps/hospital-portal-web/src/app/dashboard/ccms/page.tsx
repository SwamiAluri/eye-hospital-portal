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
import {
  FileCheck, Clock, AlertCircle, TrendingUp, RefreshCw,
  ShieldCheck, Landmark, BarChart3, Building2, ListChecks,
  Scale, ArrowUpRight, Folder, ChevronRight,
} from 'lucide-react';

function inr(n: number) {
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function KpiTile({
  label, value, sub, icon: Icon, iconBg, valueClass = 'text-gray-900', accent,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; iconBg: string; valueClass?: string; accent: string;
}) {
  return (
    <div className={`bg-white border border-gray-200 rounded-2xl staff-kpi-pad flex items-start gap-3 hover:shadow-md transition-all border-l-4 ${accent}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest leading-none mb-1">{label}</p>
        <p className={`staff-kpi-value font-bold leading-none ${valueClass}`}>{value}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function FinanceTile({ label, value, icon: Icon, gradient }: {
  label: string; value: string; icon: React.ElementType; gradient: string;
}) {
  return (
    <div className={`rounded-2xl staff-kpi-pad text-white ${gradient}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">{label}</p>
        <Icon className="w-4 h-4 opacity-60" />
      </div>
      <p className="staff-kpi-value font-bold">{value}</p>
    </div>
  );
}

const QUICK_LINKS = [
  { href: '/dashboard/ccms/cases',               label: 'All Cases',       desc: 'Browse & search cases', icon: Folder },
  { href: '/dashboard/ccms/authorization',        label: 'Auth Queue',      desc: 'Pre-auth management',   icon: ShieldCheck },
  { href: '/dashboard/ccms/claims',               label: 'Claims',          desc: 'Submit & track claims', icon: ListChecks },
  { href: '/dashboard/ccms/settlement',           label: 'Settlements',     desc: 'Payments & reconcile',  icon: Scale },
  { href: '/dashboard/ccms/master-data/payers',   label: 'Payers / TPA',   desc: 'Manage insurers',       icon: Building2 },
  { href: '/dashboard/ccms/analytics/operational',label: 'Analytics',       desc: 'Performance reports',   icon: BarChart3 },
];

export default function CcmsDashboardPage() {
  const [summary, setSummary] = useState<OperationalSummary | null>(null);
  const [pending, setPending] = useState<PendingPreAuthItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

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
    <div className="flex flex-col h-full bg-gray-50/60">
      {/* Header */}
      <div className="staff-page-header flex items-center justify-between bg-white border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] text-gray-400 font-medium">CCMS</span>
            <span className="text-gray-300">/</span>
            <span className="text-[11px] text-gray-600 font-semibold">Dashboard</span>
          </div>
          <h1 className="staff-page-title font-bold text-gray-900 flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-indigo-600" />
            Coverage &amp; Claims
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Operational overview · {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 rounded-xl px-3 py-2 hover:border-indigo-300 hover:bg-indigo-50 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto staff-page staff-page-stack">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 staff-kpi-grid">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl p-4 bg-white border border-gray-200 animate-pulse h-24" />
            ))
          ) : summary ? (
            <>
              <KpiTile
                label="Active Cases" value={summary.totalActiveCases}
                icon={Folder} iconBg="bg-indigo-100 text-indigo-600"
                valueClass="text-indigo-700" accent="border-indigo-400"
              />
              <KpiTile
                label="Pending Pre-Auth" value={summary.pendingPreAuths}
                sub={`Avg ${(summary.avgPreAuthTurnaroundHours ?? 0).toFixed(0)}h TAT`}
                icon={Clock} iconBg="bg-amber-100 text-amber-600"
                valueClass="text-amber-700" accent="border-amber-400"
              />
              <KpiTile
                label="Pending Claims" value={summary.pendingClaims}
                icon={ListChecks} iconBg="bg-blue-100 text-blue-600"
                valueClass="text-blue-700" accent="border-blue-400"
              />
              <KpiTile
                label="Pending Settlements" value={summary.pendingSettlements}
                icon={Scale} iconBg="bg-emerald-100 text-emerald-600"
                valueClass="text-emerald-700" accent="border-emerald-400"
              />
            </>
          ) : null}
        </div>

        {/* Financial Strip */}
        {!loading && summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 staff-kpi-grid">
            <FinanceTile
              label="Approved MTD"
              value={inr(summary.totalApprovedAmountMtd ?? 0)}
              icon={TrendingUp}
              gradient="bg-gradient-to-br from-green-500 to-emerald-600"
            />
            <FinanceTile
              label="Settled MTD"
              value={inr(summary.totalSettledAmountMtd ?? 0)}
              icon={Landmark}
              gradient="bg-gradient-to-br from-teal-500 to-cyan-600"
            />
            <FinanceTile
              label="Rejection Rate"
              value={`${(summary.rejectionRatePct ?? 0).toFixed(1)}%`}
              icon={AlertCircle}
              gradient={(summary.rejectionRatePct ?? 0) > 15
                ? 'bg-gradient-to-br from-red-500 to-rose-600'
                : 'bg-gradient-to-br from-gray-500 to-gray-600'}
            />
          </div>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {QUICK_LINKS.map(({ href, label, desc, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 rounded-2xl p-4 bg-white border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
                <Icon className="w-4.5 h-4.5 text-indigo-600 w-[18px] h-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors">{label}</p>
                <p className="text-[10px] text-gray-400 truncate">{desc}</p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
            </Link>
          ))}
        </div>

        {/* Pre-Auth Queue Table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-bold text-gray-800">Urgent Pre-Auth Queue</h2>
            </div>
            <Link
              href="/dashboard/ccms/authorization"
              className="flex items-center gap-0.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              View all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <div className="p-5 animate-pulse space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-9 bg-gray-100 rounded-lg" />
              ))}
            </div>
          ) : pending.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mb-2">
                <ShieldCheck className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-sm font-semibold text-gray-700">All clear!</p>
              <p className="text-xs text-gray-400 mt-0.5">No urgent pre-auths pending.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Case #</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Patient / Payer</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Requested</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Age</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.slice(0, 10).map((p) => {
                    const ageHours = p.ageInHours;
                    const ageClass = ageHours >= 72 ? 'text-red-600 font-bold' : ageHours >= 24 ? 'text-amber-600 font-semibold' : 'text-gray-500';
                    const isUrgent = p.urgencyLevel === 'high' || ageHours >= 48;
                    return (
                      <tr
                        key={p.caseId}
                        className={`border-b border-gray-50 hover:bg-indigo-50/30 transition-colors ${isUrgent ? 'border-l-2 border-l-red-400 bg-red-50/20' : ''}`}
                      >
                        <td className="px-5 py-2.5">
                          <Link
                            href={`/dashboard/ccms/cases/${p.caseId}`}
                            className="text-indigo-600 hover:text-indigo-800 font-mono text-xs font-semibold"
                          >
                            {p.caseNumber ?? p.caseId.slice(0, 8) + '…'}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 max-w-[160px]">
                          {p.patientName && (
                            <div className="text-xs font-semibold text-gray-800 truncate">{p.patientName}</div>
                          )}
                          <div className="text-[11px] text-gray-500 truncate">{p.payerName}</div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-right font-semibold text-gray-800">
                          {p.requestedAmount > 0 ? `₹${p.requestedAmount.toLocaleString('en-IN')}` : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <PreAuthStatusBadge state={p.currentState} size="xs" />
                        </td>
                        <td className={`px-4 py-2.5 text-xs text-right ${ageClass}`}>
                          {ageHours >= 24 ? `${Math.floor(ageHours / 24)}d` : `${ageHours}h`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
