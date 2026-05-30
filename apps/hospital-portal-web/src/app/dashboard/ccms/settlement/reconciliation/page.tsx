'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, GitMerge, RefreshCw, CheckCircle2,
  AlertCircle, Search, ChevronRight,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getSettlementQueue, type SettlementQueueItem } from '@/lib/api/ccms/ccms-operations.api';
import { getSettlementsByCaseId } from '@/lib/api/ccms/ccms-settlements.api';
import { ReconcileCaseModal } from '@/components/ccms/modals/ReconcileCaseModal';

// ── Helpers ───────────────────────────────────────────────────────────────────

function inr(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function discrepancyColor(d: number) {
  if (Math.abs(d) < 0.01) return 'text-green-600';
  return 'text-amber-600';
}

function Skeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 animate-pulse space-y-2">
      <div className="h-4 bg-gray-100 rounded w-1/3" />
      <div className="h-3 bg-gray-100 rounded w-1/2" />
      <div className="h-3 bg-gray-100 rounded w-2/3" />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ReconciliationWorkbenchPage() {
  const router = useRouter();
  const [items,    setItems]    = useState<SettlementQueueItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [search,   setSearch]   = useState('');
  const [showOnly, setShowOnly] = useState<'all' | 'ready' | 'discrepancy'>('all');
  const [reconcileTarget, setReconcileTarget] = useState<SettlementQueueItem | null>(null);
  const [reconcileSettled, setReconcileSettled] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSettlementQueue();
      setItems(data);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleReconcile = async (item: SettlementQueueItem) => {
    try {
      const settlements = await getSettlementsByCaseId(item.caseId);
      setReconcileSettled(settlements.reduce((s, x) => s + x.settledAmount, 0));
    } catch {
      setReconcileSettled(item.settledAmount);
    }
    setReconcileTarget(item);
  };

  const filtered = items.filter(item => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      item.caseNumber?.toLowerCase().includes(q) ||
      item.patientName?.toLowerCase().includes(q) ||
      item.claimNumber?.toLowerCase().includes(q) ||
      item.insurerName?.toLowerCase().includes(q);

    const discrepancy = Math.abs(item.claimedAmount - item.settledAmount);
    const isReady     = item.outstanding === 0;

    const matchFilter =
      showOnly === 'all' ||
      (showOnly === 'ready' && isReady) ||
      (showOnly === 'discrepancy' && discrepancy > 0.01 && !isReady);

    return matchSearch && matchFilter;
  });

  const readyCount       = items.filter(x => x.outstanding === 0).length;
  const discrepancyCount = items.filter(x => Math.abs(x.claimedAmount - x.settledAmount) > 0.01 && x.outstanding > 0).length;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center gap-3 px-6 py-4 bg-white border-b border-gray-100 shadow-sm">
        <Link href="/dashboard/ccms/settlement"
          className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2 flex-1">
          <GitMerge className="w-4 h-4 text-green-600" />
          <div>
            <h1 className="text-base font-extrabold text-gray-900">Reconciliation Workbench</h1>
            <p className="text-[11px] text-gray-400">Review discrepancies and close settled cases</p>
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
            <button onClick={load} className="ml-auto font-semibold hover:underline">Retry</button>
          </div>
        )}

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total in Queue', value: items.length,    cls: 'bg-white border-gray-200' },
            { label: 'Ready to Close',  value: readyCount,     cls: 'bg-green-50 border-green-200' },
            { label: 'Discrepancies',   value: discrepancyCount, cls: discrepancyCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200' },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.cls}`}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">{s.label}</p>
              <p className="text-2xl font-extrabold text-gray-900">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex gap-3 items-center flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search case, patient, claim, insurer…"
              className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400/40"
            />
          </div>
          {(['all', 'ready', 'discrepancy'] as const).map(f => (
            <button key={f} onClick={() => setShowOnly(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
                showOnly === f ? 'bg-green-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f === 'all' ? 'All' : f === 'ready' ? `Ready (${readyCount})` : `With Discrepancy (${discrepancyCount})`}
            </button>
          ))}
        </div>

        {/* Case cards */}
        <div className="space-y-3">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} />)
            : filtered.length === 0
              ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                  <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-gray-600">
                    {search || showOnly !== 'all' ? 'No cases match filter' : 'Nothing to reconcile'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    All settlement cases are either fully processed or pending payment.
                  </p>
                </div>
              )
              : filtered.map(item => {
                const discrepancy = item.claimedAmount - item.settledAmount;
                const hasDiscrep  = Math.abs(discrepancy) > 0.01;
                const isReady     = item.outstanding === 0;

                return (
                  <div key={item.caseId}
                    className={`bg-white rounded-2xl border p-4 space-y-3 ${
                      isReady ? 'border-green-200' : hasDiscrep ? 'border-amber-200' : 'border-gray-200'
                    }`}
                  >
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <button onClick={() => router.push(`/dashboard/ccms/cases/${item.caseId}?tab=settlement`)}
                          className="font-bold text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5">
                          {item.caseNumber ?? item.caseId.slice(0, 8)}
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs text-gray-500">{item.patientName ?? '—'}</span>
                        <span className="text-[10px] text-gray-400">· {item.insurerName ?? '—'}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        isReady   ? 'bg-green-100 text-green-700'
                        : hasDiscrep ? 'bg-amber-100 text-amber-700'
                        :            'bg-gray-100 text-gray-600'
                      }`}>
                        {isReady ? 'Ready to Close' : hasDiscrep ? 'Discrepancy' : item.caseState?.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Financial summary */}
                    <div className="grid grid-cols-4 gap-3 text-center">
                      {[
                        { label: 'Claimed',      value: inr(item.claimedAmount),  cls: 'text-gray-700' },
                        { label: 'Settled',      value: inr(item.settledAmount),  cls: 'text-green-700 font-bold' },
                        { label: 'Outstanding',  value: inr(item.outstanding),    cls: item.outstanding > 0 ? 'text-red-600 font-bold' : 'text-green-600' },
                        { label: 'Discrepancy',  value: hasDiscrep ? inr(Math.abs(discrepancy)) : '—', cls: discrepancyColor(discrepancy) },
                      ].map(({ label, value, cls }) => (
                        <div key={label} className="bg-gray-50 rounded-xl p-2">
                          <p className="text-[9px] uppercase tracking-widest text-gray-400">{label}</p>
                          <p className={`text-xs font-semibold mt-0.5 ${cls}`}>{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Claim reference */}
                    {item.claimNumber && (
                      <p className="text-[11px] text-gray-400">
                        Claim #{item.claimNumber}
                        {item.submittedAt && ` · submitted ${new Date(item.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}`}
                        {item.ageInDays > 0 && ` · ${item.ageInDays} days`}
                      </p>
                    )}

                    {/* Action */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
                      <button onClick={() => router.push(`/dashboard/ccms/cases/${item.caseId}?tab=settlement`)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                        View Settlement
                      </button>
                      <button onClick={() => handleReconcile(item)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 ${
                          isReady
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        }`}
                      >
                        <GitMerge className="w-3 h-3" />
                        {isReady ? 'Reconcile & Close' : 'Reconcile with Discrepancy'}
                      </button>
                    </div>
                  </div>
                );
              })
          }
        </div>
      </div>

      {reconcileTarget && (
        <ReconcileCaseModal
          caseId={reconcileTarget.caseId}
          caseNumber={reconcileTarget.caseNumber ?? reconcileTarget.caseId}
          totalClaimed={reconcileTarget.claimedAmount}
          totalSettled={reconcileSettled}
          open={!!reconcileTarget}
          onClose={() => setReconcileTarget(null)}
          onReconciled={() => { setReconcileTarget(null); load(); }}
        />
      )}
    </div>
  );
}
