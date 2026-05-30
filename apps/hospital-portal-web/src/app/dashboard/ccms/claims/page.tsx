'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileBarChart2, RefreshCw, AlertCircle, Search,
  ChevronRight, CheckCircle2, Clock, Send, Filter,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getClaimsQueue, type ClaimsQueueItem } from '@/lib/api/ccms/ccms-operations.api';
import { acknowledgeClaim } from '@/lib/api/ccms/ccms-claims.api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function inr(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function ageColor(days: number) {
  if (days >= 30) return 'text-red-600 font-bold';
  if (days >= 14) return 'text-amber-600 font-semibold';
  return 'text-gray-500';
}

function statusConfig(status: string) {
  const map: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
    CLAIM_SUBMITTED:  { cls: 'bg-blue-50 text-blue-700',   label: 'Submitted',    icon: <Send className="w-3 h-3" /> },
    CLAIM_IN_PROCESS: { cls: 'bg-amber-50 text-amber-700', label: 'In Process',   icon: <Clock className="w-3 h-3" /> },
    CLAIM_READY:      { cls: 'bg-indigo-50 text-indigo-700', label: 'Ready',      icon: <CheckCircle2 className="w-3 h-3" /> },
  };
  return map[status] ?? { cls: 'bg-gray-100 text-gray-600', label: status.replace(/_/g, ' '), icon: null };
}

function Skeleton() {
  return (
    <tr className="animate-pulse border-b border-gray-50">
      {Array.from({ length: 8 }).map((_, j) => (
        <td key={j} className="px-4 py-3"><div className="h-3 bg-gray-100 rounded-full" /></td>
      ))}
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClaimsQueuePage() {
  const router = useRouter();
  const [queue,   setQueue]   = useState<ClaimsQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('all');
  const [acking,  setAcking]  = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClaimsQueue();
      setQueue(data);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Failed to load claims queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAck = async (item: ClaimsQueueItem) => {
    setAcking(item.claimId);
    try {
      await acknowledgeClaim(item.claimId, {});
      toast.success(`Claim ${item.claimNumber} acknowledged`);
      load();
    } catch {
      toast.error('Failed to acknowledge claim');
    } finally {
      setAcking(null);
    }
  };

  const filtered = queue.filter(item => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      item.claimNumber?.toLowerCase().includes(q) ||
      item.caseNumber?.toLowerCase().includes(q) ||
      item.patientName?.toLowerCase().includes(q) ||
      item.insurerName?.toLowerCase().includes(q);
    const matchFilter = filter === 'all' || item.status === filter;
    return matchSearch && matchFilter;
  });

  const totalClaimed = queue.reduce((s, x) => s + x.claimedAmount, 0);
  const submitted    = queue.filter(x => x.status === 'CLAIM_SUBMITTED').length;
  const inProcess    = queue.filter(x => x.status === 'CLAIM_IN_PROCESS').length;

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] text-gray-400 font-medium">CCMS</span>
            <span className="text-gray-300">/</span>
            <span className="text-[11px] text-gray-600 font-semibold">Claims Queue</span>
          </div>
          <h1 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
            <FileBarChart2 className="w-4 h-4 text-blue-500" />
            Claims Queue
          </h1>
          <p className="text-[11px] text-gray-400 mt-0.5">Submitted claims awaiting TPA processing or acknowledgment</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 rounded-xl px-3 py-2 hover:border-indigo-300 hover:bg-indigo-50 transition-all disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">

        {/* ── Summary ─────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total in Queue', value: queue.length,      accent: 'border-l-blue-400',   iconBg: 'bg-blue-50',   iconColor: 'text-blue-600',   icon: FileBarChart2 },
            { label: 'Total Claimed',  value: inr(totalClaimed), accent: 'border-l-indigo-400', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', icon: null },
            { label: 'Awaiting Ack',   value: submitted,         accent: 'border-l-amber-400',  iconBg: 'bg-amber-50',  iconColor: 'text-amber-600',  icon: Send },
            { label: 'In Process',     value: inProcess,         accent: 'border-l-teal-400',   iconBg: 'bg-teal-50',   iconColor: 'text-teal-600',   icon: Clock },
          ].map(s => (
            <div key={s.label} className={`bg-white rounded-2xl border border-gray-200 border-l-4 ${s.accent} p-4 flex items-start gap-3 hover:shadow-md transition-all`}>
              {s.icon && (
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${s.iconBg}`}>
                  <s.icon className={`w-4 h-4 ${s.iconColor}`} />
                </div>
              )}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{s.label}</p>
                <p className="text-2xl font-extrabold text-gray-900 leading-none">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            <button onClick={load} className="ml-auto font-semibold hover:underline">Retry</button>
          </div>
        )}

        {/* ── Search + Filters ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search claim #, case #, patient, insurer…"
              className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <div className="flex gap-1">
              {[
                { val: 'all',              label: 'All' },
                { val: 'CLAIM_READY',      label: 'Ready' },
                { val: 'CLAIM_SUBMITTED',  label: 'Submitted' },
                { val: 'CLAIM_IN_PROCESS', label: 'In Process' },
              ].map(f => (
                <button key={f.val} onClick={() => setFilter(f.val)}
                  className={`text-[11px] font-semibold px-3 py-1.5 rounded-full transition-colors ${
                    filter === f.val ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
                  }`}
                >{f.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Table ──────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  {['Claim #', 'Case #', 'Patient', 'Insurer', 'State', 'Claimed', 'Submitted', 'Age', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)
                  : filtered.length === 0
                    ? (
                      <tr><td colSpan={9} className="py-16 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-3">
                          <CheckCircle2 className="w-6 h-6 text-green-400" />
                        </div>
                        <p className="text-sm font-semibold text-gray-500">No claims in queue</p>
                        <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                          {search || filter !== 'all' ? 'Try adjusting your filters.' : 'All claims have been processed.'}
                        </p>
                      </td></tr>
                    )
                    : filtered.map((item) => {
                      const sc = statusConfig(item.status);
                      return (
                        <tr key={item.claimId}
                          className={`group transition-colors border-l-2 ${
                            item.ageInDays >= 30 ? 'border-l-red-400 bg-red-50/20 hover:bg-red-50/40'
                            : item.ageInDays >= 14 ? 'border-l-amber-400 bg-amber-50/20 hover:bg-amber-50/40'
                            : 'border-l-blue-300 hover:bg-indigo-50/30'
                          }`}>
                          <td className="px-4 py-3 font-mono font-semibold text-gray-800 text-[11px]">{item.claimNumber}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => router.push(`/dashboard/ccms/cases/${item.caseId}?tab=claims`)}
                              className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 text-[11px]">
                              {item.caseNumber ?? item.caseId.slice(0, 8)}
                              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          </td>
                          <td className="px-4 py-3 text-gray-700 max-w-[120px] truncate">{item.patientName ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-500 max-w-[120px] truncate">{item.insurerName ?? '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full ${sc.cls}`}>
                              {sc.icon}{sc.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-gray-800 tabular-nums">{inr(item.claimedAmount)}</td>
                          <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                            {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                          </td>
                          <td className={`px-4 py-3 text-right tabular-nums ${ageColor(item.ageInDays)}`}>{item.ageInDays}d</td>
                          <td className="px-4 py-3">
                            {item.status === 'CLAIM_SUBMITTED' && (
                              <button
                                onClick={() => handleAck(item)}
                                disabled={acking === item.claimId}
                                className="px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 flex items-center gap-1 border border-green-200"
                              >
                                {acking === item.claimId
                                  ? <RefreshCw className="w-3 h-3 animate-spin" />
                                  : <CheckCircle2 className="w-3 h-3" />
                                }
                                Acknowledge
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                }
              </tbody>
            </table>
          </div>
          {!loading && filtered.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between">
              <span className="text-[11px] text-gray-400">Showing {filtered.length} of {queue.length} claims</span>
              {queue.some(x => x.ageInDays >= 30) && (
                <span className="text-[11px] font-semibold text-red-600">
                  ⚠ {queue.filter(x => x.ageInDays >= 30).length} claim(s) aged 30+ days
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
