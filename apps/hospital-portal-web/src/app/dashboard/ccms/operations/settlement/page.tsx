'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Landmark, RefreshCw, CheckCircle2, AlertCircle,
  ChevronRight, Search, TrendingDown,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  getSettlementQueue,
  type SettlementQueueItem,
} from '@/lib/api/ccms/ccms-operations.api';
import { getSettlementsByCaseId } from '@/lib/api/ccms/ccms-settlements.api';
import { RecordSettlementModal } from '@/components/ccms/modals/RecordSettlementModal';
import { ReconcileCaseModal } from '@/components/ccms/modals/ReconcileCaseModal';

// ── Helpers ───────────────────────────────────────────────────────────────────

function inr(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function pct(settled: number, claimed: number) {
  if (!claimed) return 0;
  return Math.min(Math.round((settled / claimed) * 100), 100);
}

function ageColor(days: number) {
  if (days >= 30) return 'text-red-600 font-bold';
  if (days >= 14) return 'text-amber-600 font-semibold';
  return 'text-gray-500';
}

function stateLabel(state: string) {
  const MAP: Record<string, string> = {
    CLAIM_IN_PROCESS: 'Claim in Process',
    SETTLEMENT_PENDING: 'Settlement Pending',
    PARTIAL_SETTLEMENT: 'Partial Settlement',
  };
  return MAP[state] ?? state;
}

function stateClass(state: string) {
  if (state === 'PARTIAL_SETTLEMENT') return 'bg-purple-50 text-purple-700';
  if (state === 'SETTLEMENT_PENDING') return 'bg-amber-50 text-amber-700';
  return 'bg-blue-50 text-blue-700';
}

function Skeleton() {
  return <div className="h-16 rounded-xl bg-gray-100 animate-pulse" />;
}

function SummaryCard({
  icon, label, value, sub, cls,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  cls?: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 flex items-start gap-3 ${cls ?? 'bg-white border-gray-200'}`}>
      <div className="p-2 rounded-xl bg-gray-50">{icon}</div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
        <p className="text-xl font-extrabold text-gray-900">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Row actions cell ──────────────────────────────────────────────────────────

interface RowActionsProps {
  item: SettlementQueueItem;
  onRecord: (item: SettlementQueueItem) => void;
  onReconcile: (item: SettlementQueueItem) => void;
}

function RowActions({ item, onRecord, onReconcile }: RowActionsProps) {
  const canReconcile = item.outstanding === 0 || item.caseState === 'PARTIAL_SETTLEMENT';
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onRecord(item)}
        className="px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
      >
        Record Payment
      </button>
      {canReconcile && (
        <button
          onClick={() => onReconcile(item)}
          className="px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
        >
          Reconcile
        </button>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SettlementDeskPage() {
  const router = useRouter();
  const [items,    setItems]    = useState<SettlementQueueItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState<'all' | 'pending' | 'partial'>('all');
  const [busy,     setBusy]     = useState(false);

  // Modal state
  const [recordItem, setRecordItem] = useState<SettlementQueueItem | null>(null);
  const [reconcileItem, setReconcileItem] = useState<SettlementQueueItem | null>(null);
  const [recordAlreadySettled, setRecordAlreadySettled] = useState(0);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const data = await getSettlementQueue();
      setItems(data);
    } catch {
      toast.error('Failed to load settlement queue');
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRecord = async (item: SettlementQueueItem) => {
    // Fetch actual settled amount for this case before opening modal
    try {
      const settlements = await getSettlementsByCaseId(item.caseId);
      const totalSettled = settlements.reduce((s, x) => s + x.settledAmount, 0);
      setRecordAlreadySettled(totalSettled);
    } catch {
      setRecordAlreadySettled(item.settledAmount);
    }
    setRecordItem(item);
  };

  const filtered = items.filter(item => {
    const matchSearch =
      !search ||
      item.caseNumber?.toLowerCase().includes(search.toLowerCase()) ||
      item.patientName?.toLowerCase().includes(search.toLowerCase()) ||
      item.insurerName?.toLowerCase().includes(search.toLowerCase()) ||
      item.claimNumber?.toLowerCase().includes(search.toLowerCase());

    const matchFilter =
      filter === 'all' ||
      (filter === 'partial' && item.caseState === 'PARTIAL_SETTLEMENT') ||
      (filter === 'pending' && item.caseState === 'SETTLEMENT_PENDING');

    return matchSearch && matchFilter;
  });

  const totalOutstanding = items.reduce((s, x) => s + x.outstanding, 0);
  const totalClaimed     = items.reduce((s, x) => s + x.claimedAmount, 0);
  const totalSettled     = items.reduce((s, x) => s + x.settledAmount, 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <Landmark className="w-5 h-5 text-indigo-500" />
            Settlement Desk
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Track and record payments for submitted insurance claims</p>
        </div>
        <button
          onClick={load}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={<Landmark className="w-4 h-4 text-gray-500" />}
          label="Cases in Queue" value={items.length} />
        <SummaryCard icon={<TrendingDown className="w-4 h-4 text-amber-500" />}
          label="Total Outstanding" value={inr(totalOutstanding)}
          cls="bg-amber-50 border-amber-200" />
        <SummaryCard icon={<CheckCircle2 className="w-4 h-4 text-green-500" />}
          label="Total Settled" value={inr(totalSettled)}
          cls="bg-green-50 border-green-200" />
        <SummaryCard icon={<AlertCircle className="w-4 h-4 text-indigo-500" />}
          label="Total Claimed" value={inr(totalClaimed)} />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search case #, patient, insurer, claim #…"
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'pending', 'partial'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
                filter === f ? 'bg-indigo-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f === 'all' ? 'All' : f === 'pending' ? 'Pending' : 'Partial'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Case #', 'Patient', 'Insurer', 'Claim #', 'State', 'Claimed', 'Settled', 'Outstanding', 'Age', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={10} className="px-4 py-3"><Skeleton /></td></tr>
                  ))
                : filtered.length === 0
                  ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center">
                        <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-gray-700">No cases in settlement queue</p>
                        <p className="text-xs text-gray-400 mt-1">All claims are settled or no pending cases match your filter.</p>
                      </td>
                    </tr>
                  )
                  : filtered.map(item => {
                    const settlePct = pct(item.settledAmount, item.claimedAmount);
                    return (
                      <tr key={item.caseId} className="hover:bg-gray-50/80 group transition-colors">
                        {/* Case # */}
                        <td className="px-4 py-3">
                          <button
                            onClick={() => router.push(`/dashboard/ccms/cases/${item.caseId}`)}
                            className="font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                          >
                            {item.caseNumber ?? '—'}
                            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        </td>
                        {/* Patient */}
                        <td className="px-4 py-3 text-gray-700">{item.patientName ?? '—'}</td>
                        {/* Insurer */}
                        <td className="px-4 py-3 text-gray-500">{item.insurerName ?? '—'}</td>
                        {/* Claim # */}
                        <td className="px-4 py-3 font-mono text-gray-600">{item.claimNumber ?? '—'}</td>
                        {/* State */}
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${stateClass(item.caseState ?? '')}`}>
                            {stateLabel(item.caseState ?? '')}
                          </span>
                        </td>
                        {/* Claimed */}
                        <td className="px-4 py-3 text-right text-gray-700">{inr(item.claimedAmount)}</td>
                        {/* Settled */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-green-700 font-semibold">{inr(item.settledAmount)}</span>
                            {item.claimedAmount > 0 && (
                              <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${settlePct}%` }} />
                              </div>
                            )}
                          </div>
                        </td>
                        {/* Outstanding */}
                        <td className="px-4 py-3 text-right">
                          <span className={item.outstanding > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-semibold'}>
                            {item.outstanding > 0 ? inr(item.outstanding) : 'Fully Settled'}
                          </span>
                        </td>
                        {/* Age */}
                        <td className={`px-4 py-3 text-right ${ageColor(item.ageInDays)}`}>
                          {item.ageInDays}d
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3">
                          <RowActions item={item} onRecord={handleRecord} onReconcile={setReconcileItem} />
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 text-[10px] text-gray-400">
            Showing {filtered.length} of {items.length} cases
          </div>
        )}
      </div>

      {/* Record Settlement Modal */}
      {recordItem && (
        <RecordSettlementModal
          caseId={recordItem.caseId}
          claimAmount={recordItem.claimedAmount}
          alreadySettled={recordAlreadySettled}
          claimPacketId={recordItem.claimId}
          open={!!recordItem}
          onClose={() => setRecordItem(null)}
          onRecorded={() => {
            setRecordItem(null);
            load();
          }}
        />
      )}

      {/* Reconcile Modal */}
      {reconcileItem && (
        <ReconcileCaseModal
          caseId={reconcileItem.caseId}
          caseNumber={reconcileItem.caseNumber ?? reconcileItem.caseId}
          totalClaimed={reconcileItem.claimedAmount}
          totalSettled={reconcileItem.settledAmount}
          open={!!reconcileItem}
          onClose={() => setReconcileItem(null)}
          onReconciled={() => {
            setReconcileItem(null);
            load();
          }}
        />
      )}
    </div>
  );
}
