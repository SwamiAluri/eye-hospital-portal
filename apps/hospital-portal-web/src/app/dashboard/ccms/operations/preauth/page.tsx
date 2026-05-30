'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck, RefreshCw, AlertTriangle, Clock, CheckCircle,
  MessageSquare, ChevronRight, Search, Filter, ExternalLink,
  AlertCircle, Hourglass,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  getPreAuthQueue, getPreAuthQueueSummary, enrichPreAuthQueueWithSessions,
  type PreAuthQueueItem, type PreAuthQueueSummary,
} from '@/lib/api/ccms/ccms-operations.api';
import { PreAuthWorkspace } from '@/components/ccms/workspace/PreAuthWorkspace';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function inr(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

function statusConfig(status: string) {
  const cfg: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    PREAUTH_SENT:             { label: 'Sent to TPA',         cls: 'bg-blue-50 text-blue-700',   icon: <ShieldCheck className="w-3 h-3" /> },
    WAITING_APPROVAL:         { label: 'Awaiting Approval',   cls: 'bg-amber-50 text-amber-700', icon: <Clock className="w-3 h-3" /> },
    CLARIFICATION_REQUIRED:   { label: 'Clarification Due',   cls: 'bg-red-50 text-red-700',     icon: <MessageSquare className="w-3 h-3" /> },
    PARTIAL_APPROVAL:         { label: 'Partial Approval',    cls: 'bg-purple-50 text-purple-700', icon: <CheckCircle className="w-3 h-3" /> },
  };
  return cfg[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600', icon: null };
}

function urgencyColor(days: number) {
  if (days >= 7)  return 'text-red-600 font-bold';
  if (days >= 3)  return 'text-amber-600 font-semibold';
  return 'text-gray-500';
}

function Skeleton({ h = 'h-16' }: { h?: string }) {
  return <div className={`${h} rounded-2xl bg-gray-100 animate-pulse`} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary cards
// ─────────────────────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, accent = 'border-l-gray-300', iconBg = 'bg-gray-100', iconColor = 'text-gray-500', icon: Icon }: {
  label: string; value: number | string; sub?: string;
  accent?: string; iconBg?: string; iconColor?: string;
  icon?: React.ElementType;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 border-l-4 ${accent} p-4 flex items-start gap-3 hover:shadow-md transition-all`}>
      {Icon && (
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
        <p className="text-2xl font-extrabold text-gray-900 leading-none">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue row
// ─────────────────────────────────────────────────────────────────────────────

function QueueRow({
  item,
  selected,
  onSelect,
  onOpenCase,
}: {
  item: PreAuthQueueItem;
  selected: boolean;
  onSelect: () => void;
  onOpenCase: () => void;
}) {
  const s = statusConfig(item.status);
  return (
    <tr
      className={`border-b border-gray-100 cursor-pointer transition-colors border-l-2 ${
        selected ? 'bg-indigo-50 border-l-indigo-400'
        : item.daysWaiting >= 7  ? 'bg-red-50/40 border-l-red-400 hover:bg-red-50'
        : item.daysWaiting >= 3  ? 'bg-amber-50/30 border-l-amber-400 hover:bg-amber-50'
        : 'border-l-gray-200 hover:bg-gray-50'
      }`}
      onClick={onSelect}
    >
      <td className="px-4 py-3">
        <div className="font-semibold text-xs text-gray-800">{item.caseNumber ?? '—'}</div>
        <div className="text-[11px] text-gray-400 truncate max-w-[140px]">{item.patientName ?? '—'}</div>
        {item.mobileNumber && (
          <div className="text-[10px] text-gray-400 tabular-nums">{item.mobileNumber}</div>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-gray-600 truncate max-w-[120px]">{item.insurerName ?? '—'}</td>
      <td className="px-4 py-3 text-xs text-gray-700 truncate max-w-[130px]">
        {item.procedureName ?? <span className="text-gray-300 italic text-[11px]">—</span>}
      </td>
      <td className="px-4 py-3 text-xs text-gray-700 truncate max-w-[110px]">
        {item.counsellorName ?? <span className="text-gray-300 italic text-[11px]">—</span>}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>
          {s.icon}{s.label}
        </span>
        {item.processStatus && (
          <div className="text-[10px] text-gray-400 mt-0.5">{item.processStatus.replace(/_/g, ' ')}</div>
        )}
        {item.hasInboundDraft && (
          <span className="inline-flex items-center gap-0.5 mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
            Draft ready
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-xs font-semibold text-gray-800 tabular-nums">
        {inr(item.requestedAmount)}
        {item.approvedAmount != null && item.approvedAmount > 0 && (
          <div className="text-[11px] text-emerald-600 font-normal">{inr(item.approvedAmount)} approved</div>
        )}
      </td>
      <td className="px-4 py-3">
        {item.preAuthNumber
          ? <span className="text-[11px] font-semibold text-indigo-700">{item.preAuthNumber}</span>
          : <span className="text-[11px] text-gray-400 italic">Pending</span>}
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs ${urgencyColor(item.daysWaiting)}`}>
          {item.daysWaiting}d
        </span>
        {item.submittedAt && (
          <div className="text-[10px] text-gray-400">
            {new Date(item.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <ChevronRight className={`w-4 h-4 transition-colors ${selected ? 'text-indigo-500' : 'text-gray-300'}`} />
          <button
            onClick={e => { e.stopPropagation(); onOpenCase(); }}
            className="p-1 text-gray-300 hover:text-indigo-500 rounded"
            title="Open full case"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function OperationsPreAuthQueuePage() {
  const router = useRouter();
  const [queue,    setQueue]    = useState<PreAuthQueueItem[]>([]);
  const [summary,  setSummary]  = useState<PreAuthQueueSummary | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState<string>('all');
  const [selected, setSelected] = useState<PreAuthQueueItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [raw, s] = await Promise.all([getPreAuthQueue(), getPreAuthQueueSummary()]);
      const enriched = await enrichPreAuthQueueWithSessions(raw);
      setQueue(enriched);
      setSummary(s);
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? 'Failed to load queue';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = queue.filter(item => {
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      item.caseNumber?.toLowerCase().includes(q) ||
      item.patientName?.toLowerCase().includes(q) ||
      item.insurerName?.toLowerCase().includes(q) ||
      item.preAuthNumber?.toLowerCase().includes(q);
    const matchesFilter =
      filter === 'all' ? true
      : filter === 'INBOUND_TO_REVIEW' ? Boolean(item.hasInboundDraft)
      : item.status === filter;
    return matchesSearch && matchesFilter;
  });

  const inboundDraftCount = queue.filter(q => q.hasInboundDraft).length;

  const FILTER_OPTIONS = [
    { value: 'all',                   label: 'All' },
    { value: 'INBOUND_TO_REVIEW',     label: 'Inbound to review', count: inboundDraftCount },
    { value: 'WAITING_APPROVAL',      label: 'Awaiting Approval' },
    { value: 'CLARIFICATION_REQUIRED', label: 'Clarification Due' },
    { value: 'PREAUTH_SENT',          label: 'Sent to TPA' },
    { value: 'PARTIAL_APPROVAL',      label: 'Partial Approval' },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] text-gray-400 font-medium">CCMS</span>
            <span className="text-gray-300">/</span>
            <span className="text-[11px] text-gray-600 font-semibold">Pre-Auth Queue</span>
          </div>
          <h1 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-500" />
            Pre-Auth Queue
          </h1>
          <p className="text-[11px] text-gray-400 mt-0.5">Pending TPA authorizations · Operations desk</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 rounded-xl px-3 py-2 hover:border-indigo-300 hover:bg-indigo-50 transition-all disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* ── Summary strip ──────────────────────────────────────────────────── */}
        {summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="Total Pending"      value={summary.total}             accent="border-l-amber-400"  iconBg="bg-amber-50"  iconColor="text-amber-600"  icon={ShieldCheck} />
            <SummaryCard label="Awaiting Approval"  value={summary.waitingApproval}   accent="border-l-indigo-400" iconBg="bg-indigo-50" iconColor="text-indigo-600" icon={Hourglass} />
            <SummaryCard label="Clarification Due"  value={summary.clarificationDue}  accent="border-l-red-400"    iconBg="bg-red-50"    iconColor="text-red-600"    icon={AlertCircle} />
            {(summary.inboundToReview ?? inboundDraftCount) > 0 && (
              <SummaryCard
                label="Inbound to review"
                value={summary.inboundToReview ?? inboundDraftCount}
                sub="parsed email drafts"
                accent="border-l-violet-400"
                iconBg="bg-violet-50"
                iconColor="text-violet-600"
                icon={MessageSquare}
              />
            )}
            <SummaryCard
              label="Longest Waiting"
              value={queue.length ? `${Math.max(...queue.map(q => q.daysWaiting))}d` : '—'}
              sub="days in queue"
              accent={queue.some(q => q.daysWaiting >= 7) ? 'border-l-red-400' : 'border-l-gray-200'}
              iconBg={queue.some(q => q.daysWaiting >= 7) ? 'bg-red-50' : 'bg-gray-100'}
              iconColor={queue.some(q => q.daysWaiting >= 7) ? 'text-red-600' : 'text-gray-500'}
              icon={Clock}
            />
          </div>
        )}

        {/* ── Search + filter ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search case, patient, insurer…"
              className="w-full pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40 bg-white"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <div className="flex gap-1 flex-wrap">
              {FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={`text-[11px] font-semibold px-3 py-1.5 rounded-full transition-colors ${
                    filter === opt.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
                  }`}
                >
                  {opt.label}
                  {'count' in opt && opt.count != null && opt.count > 0 ? ` (${opt.count})` : ''}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Table ──────────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-700">{error}</p>
            <button onClick={load} className="ml-auto text-xs font-semibold text-red-600 hover:underline">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-400 mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-gray-500">
              {search || filter !== 'all' ? 'No results match your filter' : 'No pending pre-authorizations'}
            </p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">
              {!search && filter === 'all'
                ? 'All pre-authorization requests have been processed. Check back when new cases are submitted.'
                : 'Try adjusting your search or filter.'}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50/80 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Case / Patient</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Insurer</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Procedure</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Counsellor</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Amount</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Pre-Auth #</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Waiting</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <QueueRow
                    key={item.authId}
                    item={item}
                    selected={selected?.authId === item.authId}
                    onSelect={() => setSelected(prev => prev?.authId === item.authId ? null : item)}
                    onOpenCase={() => router.push(`/dashboard/ccms/cases/${item.caseCaseId}?tab=authorization`)}
                  />
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-[11px] text-gray-400">
                {filtered.length} of {queue.length} record{queue.length !== 1 ? 's' : ''}
              </span>
              {queue.some(q => q.daysWaiting >= 7) && (
                <span className="text-[11px] font-semibold text-red-600">
                  ⚠ {queue.filter(q => q.daysWaiting >= 7).length} case{queue.filter(q => q.daysWaiting >= 7).length !== 1 ? 's' : ''} waiting 7+ days
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── PreAuth Workspace drawer ─────────────────────────────────────── */}
      {selected && (
        <PreAuthWorkspace
          item={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => { load(); setSelected(null); }}
        />
      )}
    </div>
  );
}
