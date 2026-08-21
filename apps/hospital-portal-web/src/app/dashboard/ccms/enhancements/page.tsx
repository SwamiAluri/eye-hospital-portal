'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, RefreshCw, AlertCircle, CheckCircle2, XCircle,
  Clock, ChevronRight, Send,
} from 'lucide-react';
import {
  listEnhancements,
  decideEnhancement,
  submitEnhancement,
  type EnhancementListItem,
} from '@/lib/api/ccms/ccms-enhancements.api';

function statusConfig(status: string) {
  if (status === 'approved') return { cls: 'bg-green-50 text-green-700', label: 'Approved', icon: <CheckCircle2 className="w-3 h-3" /> };
  if (status === 'rejected') return { cls: 'bg-red-50 text-red-700',   label: 'Rejected', icon: <XCircle className="w-3 h-3" /> };
  if (status === 'submitted') return { cls: 'bg-indigo-50 text-indigo-700', label: 'Awaiting TPA', icon: <Send className="w-3 h-3" /> };
  return { cls: 'bg-amber-50 text-amber-700', label: 'Draft', icon: <Clock className="w-3 h-3" /> };
}

function inr(n: number | undefined) {
  if (n == null) return '—';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
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

export default function EnhancementsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<EnhancementListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'awaiting_tpa' | 'approved' | 'rejected'>('pending');
  const [deciding, setDeciding] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status =
        filter === 'pending' ? 'active'
          : filter === 'awaiting_tpa' ? 'submitted'
            : filter;
      const list = await listEnhancements({ status, take: 200 });
      setRows(list);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Failed to load enhancements');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const drafts = rows.filter(r => r.enhancement.status === 'active').length;
  const awaiting = rows.filter(r => r.enhancement.status === 'submitted').length;
  const approved = rows.filter(r => r.enhancement.status === 'approved').length;
  const rejected = rows.filter(r => r.enhancement.status === 'rejected').length;

  async function onSubmit(id: string) {
    const ref = window.prompt('TPA reference (optional)') ?? undefined;
    setDeciding(id);
    try {
      await submitEnhancement(id, { tpaReferenceNumber: ref || undefined });
      await load();
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Submit failed');
    } finally {
      setDeciding(null);
    }
  }

  async function onDecide(id: string, approved: boolean, requested: number, fromSubmitted: boolean) {
    const amount = approved
      ? Number(window.prompt('Additional approved amount (INR)', String(requested)) ?? '')
      : 0;
    if (approved && !(amount >= 0)) return;

    let hospitalOverride = false;
    let overrideReason: string | undefined;
    if (!fromSubmitted) {
      const ok = window.confirm('Draft was not sent to TPA. Record as hospital override?');
      if (!ok) return;
      overrideReason = window.prompt('Override reason (required)') ?? '';
      if (!overrideReason.trim()) {
        setError('Override reason required');
        return;
      }
      hospitalOverride = true;
    }

    const tpaRef = fromSubmitted
      ? (window.prompt('TPA outcome reference (optional)') ?? undefined)
      : undefined;

    setDeciding(id);
    try {
      await decideEnhancement(id, {
        approved,
        approvedAmount: amount,
        tpaReferenceNumber: tpaRef || undefined,
        hospitalOverride,
        overrideReason,
      });
      await load();
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Decision failed');
    } finally {
      setDeciding(null);
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-500" />
          <div>
            <h1 className="text-base font-extrabold text-gray-900">Enhancement Requests</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Draft → Submit to TPA → Record outcome. Coverage projection updates only after outcome (or audited override).
            </p>
          </div>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}
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

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Drafts', value: drafts, cls: 'bg-amber-50 border-amber-100 text-amber-800', f: 'pending' as const },
            { label: 'Awaiting TPA', value: awaiting, cls: 'bg-indigo-50 border-indigo-100 text-indigo-800', f: 'awaiting_tpa' as const },
            { label: 'Approved', value: approved, cls: 'bg-green-50 border-green-100 text-green-800', f: 'approved' as const },
            { label: 'Rejected', value: rejected, cls: 'bg-red-50 border-red-100 text-red-800', f: 'rejected' as const },
          ].map(s => (
            <button
              key={s.label}
              type="button"
              onClick={() => setFilter(s.f)}
              className={`rounded-2xl border p-4 text-left ${s.cls} ${filter === s.f ? 'ring-2 ring-indigo-400' : ''}`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest opacity-70">{s.label}</p>
              <p className="text-2xl font-extrabold mt-0.5">{loading && filter === s.f ? '…' : s.value}</p>
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          {(['all', 'pending', 'awaiting_tpa', 'approved', 'rejected'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors border ${
                filter === f
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Case #', 'Patient', 'Type', 'Requested', 'Case approved', 'Reason', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} />)
                  : rows.length === 0
                    ? (
                      <tr>
                        <td colSpan={8} className="py-14 text-center">
                          <TrendingUp className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm font-semibold text-gray-500">No enhancement requests</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Gaps are drafted when a finalized bill exceeds approved coverage, or created from a case.
                          </p>
                        </td>
                      </tr>
                    )
                    : rows.map(({ enhancement: e, caseNumber, patientName, caseApprovedAmount }) => {
                      const sc = statusConfig(e.status);
                      return (
                        <tr key={e.id} className="hover:bg-gray-50/80 group transition-colors">
                          <td className="px-4 py-3 font-semibold text-gray-900">{caseNumber || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{patientName || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{e.enhancementType?.replace(/_/g, ' ')}</td>
                          <td className="px-4 py-3 font-medium">{inr(e.requestedAmount)}</td>
                          <td className="px-4 py-3 text-gray-600">{inr(caseApprovedAmount)}</td>
                          <td className="px-4 py-3 text-gray-500 max-w-[220px] truncate" title={e.reason}>{e.reason || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.cls}`}>
                              {sc.icon}{sc.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {e.status === 'active' && (
                                <button
                                  type="button"
                                  disabled={deciding === e.id}
                                  onClick={() => void onSubmit(e.id)}
                                  className="text-[10px] font-semibold text-indigo-700 hover:underline disabled:opacity-50"
                                >
                                  Submit to TPA
                                </button>
                              )}
                              {(e.status === 'active' || e.status === 'submitted') && (
                                <>
                                  <button
                                    type="button"
                                    disabled={deciding === e.id}
                                    onClick={() => void onDecide(e.id, true, e.requestedAmount, e.status === 'submitted')}
                                    className="text-[10px] font-semibold text-emerald-700 hover:underline disabled:opacity-50"
                                  >
                                    {e.status === 'submitted' ? 'TPA approve' : 'Override'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={deciding === e.id}
                                    onClick={() => void onDecide(e.id, false, 0, e.status === 'submitted')}
                                    className="text-[10px] font-semibold text-red-600 hover:underline disabled:opacity-50"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => router.push(`/dashboard/ccms/cases/${e.coverageCase_Id}`)}
                                className="text-indigo-600 hover:text-indigo-800"
                                title="Open case"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
