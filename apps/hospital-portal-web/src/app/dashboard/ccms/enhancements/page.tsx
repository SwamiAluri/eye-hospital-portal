'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, RefreshCw, AlertCircle, CheckCircle2, XCircle,
  Clock, Plus, ChevronRight,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  getEnhancementsByCaseId,
  type Enhancement,
} from '@/lib/api/ccms/ccms-enhancements.api';
import { listCoverageCases, type CoverageCase } from '@/lib/api/ccms/ccms-coverage-cases.api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusConfig(status: string) {
  if (status === 'approved') return { cls: 'bg-green-50 text-green-700', label: 'Approved', icon: <CheckCircle2 className="w-3 h-3" /> };
  if (status === 'rejected') return { cls: 'bg-red-50 text-red-700',   label: 'Rejected', icon: <XCircle className="w-3 h-3" /> };
  return { cls: 'bg-amber-50 text-amber-700', label: 'Pending', icon: <Clock className="w-3 h-3" /> };
}

function inr(n: number | undefined) {
  if (!n) return '—';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function Skeleton() {
  return (
    <tr className="animate-pulse border-b border-gray-50">
      {Array.from({ length: 7 }).map((_, j) => (
        <td key={j} className="px-4 py-3"><div className="h-3 bg-gray-100 rounded-full" /></td>
      ))}
    </tr>
  );
}

// ── The enhancements page shows open enhancement requests across all cases ────

export default function EnhancementsPage() {
  const router = useRouter();
  // Load cases in APPROVED / PARTIAL_APPROVAL states that may have enhancements
  const [cases,        setCases]        = useState<CoverageCase[]>([]);
  const [enhancements, setEnhancements] = useState<Record<string, Enhancement[]>>({});
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [filter,       setFilter]       = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Load cases that are likely to have enhancements (approved track + in-progress)
      const result = await listCoverageCases({ pageSize: 100 });
      const allCases = result.cases ?? [];
      setCases(allCases);

      // Load enhancements for each case in parallel (cap to 20 cases for perf)
      const sample = allCases.slice(0, 20);
      const results = await Promise.allSettled(
        sample.map(c => getEnhancementsByCaseId(c.id))
      );
      const map: Record<string, Enhancement[]> = {};
      sample.forEach((c, i) => {
        const r = results[i];
        if (r.status === 'fulfilled' && r.value.length > 0) {
          map[c.id] = r.value;
        }
      });
      setEnhancements(map);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Failed to load enhancements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Flatten all enhancements with their case context
  const allRows = Object.entries(enhancements).flatMap(([caseId, list]) => {
    const c = cases.find(x => x.id === caseId);
    return list.map(e => ({ ...e, case_: c }));
  });

  const filtered = allRows.filter(e =>
    filter === 'all' || e.status === filter
  );

  const pending  = allRows.filter(e => e.status === 'active').length;
  const approved = allRows.filter(e => e.status === 'approved').length;
  const rejected = allRows.filter(e => e.status === 'rejected').length;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-500" />
          <div>
            <h1 className="text-base font-extrabold text-gray-900">Enhancement Requests</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Requests to extend approved coverage (amount, days, procedures)
            </p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Pending Decision', value: pending,  cls: 'bg-amber-50 border-amber-100 text-amber-800' },
            { label: 'Approved',         value: approved, cls: 'bg-green-50 border-green-100 text-green-800' },
            { label: 'Rejected',         value: rejected, cls: 'bg-red-50 border-red-100 text-red-800' },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.cls}`}>
              <p className="text-[10px] font-semibold uppercase tracking-widest opacity-70">{s.label}</p>
              <p className="text-2xl font-extrabold mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2">
          {(['all', 'active', 'approved', 'rejected'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f === 'active' ? 'pending' : f as typeof filter)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors border ${
                (filter === 'pending' && f === 'active') || filter === f
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f === 'active' ? 'Pending' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Case #', 'Patient', 'Type', 'Requested', 'Approved', 'Reason', 'Status', 'Date', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} />)
                  : filtered.length === 0
                    ? (
                      <tr>
                        <td colSpan={9} className="py-14 text-center">
                          <TrendingUp className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm font-semibold text-gray-500">No enhancement requests found</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Enhancement requests are created from a case's Pre-Auth tab.
                          </p>
                        </td>
                      </tr>
                    )
                    : filtered.map(e => {
                      const sc = statusConfig(e.status === 'active' ? 'pending' : e.status);
                      return (
                        <tr key={e.id} className="hover:bg-gray-50/80 group transition-colors">
                          <td className="px-4 py-3">
                            <Link href={`/dashboard/ccms/cases/${e.coverageCase_Id}`}
                              className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5">
                              {e.case_?.caseNumber ?? e.coverageCase_Id.slice(0, 8)}
                              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{e.case_?.patientName ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{e.enhancementType?.replace(/_/g, ' ')}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-800">{inr(e.requestedAmount)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={e.approvedAmount ? 'font-semibold text-green-700' : 'text-gray-400'}>
                              {inr(e.approvedAmount)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate">{e.reason ?? '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.cls}`}>
                              {sc.icon}{sc.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                            {new Date(e.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </td>
                          <td className="px-4 py-3">
                            <Link href={`/dashboard/ccms/cases/${e.coverageCase_Id}?tab=authorization`}
                              className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold whitespace-nowrap">
                              View →
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                }
              </tbody>
            </table>
          </div>
          {!loading && (
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-[11px] text-gray-400">
              {filtered.length} enhancement{filtered.length !== 1 ? 's' : ''} · across {Object.keys(enhancements).length} cases loaded
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
