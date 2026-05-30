'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { ClipboardList, LockKeyhole, AlertCircle, X, Printer, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { counsellorsDeskApi, mapOtRecord } from '@/lib/api/counsellors-desk.api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  useFinalizeListQuery,
  useInvalidateCounsellorsDesk,
  type FinalizeListFilters,
} from '@/hooks/use-counsellors-desk-queries';
import { StatusBadge } from '@/components/counsellors-desk/StatusBadge';
import { FinalizeOtModal } from '@/components/counsellors-desk/FinalizeOtModal';
import type {
  FinalizeSurgeryRecord,
  FinalizeStatus,
  PrepareOtListItem,
} from '@/types/counsellors-desk';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: 'All',          label: 'All',           color: 'bg-slate-500',   activeClass: 'bg-slate-600 border-slate-600 text-white'   },
  { key: 'NotConfirmed', label: 'Not Confirmed',  color: 'bg-amber-500',   activeClass: 'bg-amber-500 border-amber-500 text-white'   },
  { key: 'Confirmed',    label: 'Confirmed',      color: 'bg-blue-500',    activeClass: 'bg-blue-500 border-blue-500 text-white'     },
  { key: 'Finalised',    label: 'Finalised',      color: 'bg-indigo-500',  activeClass: 'bg-indigo-500 border-indigo-500 text-white' },
  { key: 'OTPrepared',   label: 'OT Prepared',    color: 'bg-emerald-500', activeClass: 'bg-emerald-500 border-emerald-500 text-white' },
  { key: 'Cancelled',    label: 'Cancelled',      color: 'bg-red-500',     activeClass: 'bg-red-500 border-red-500 text-white'       },
  { key: 'SurgeryDone',  label: 'Surgery Done',   color: 'bg-teal-500',    activeClass: 'bg-teal-500 border-teal-500 text-white'     },
];

type ActionKey = 'confirm' | 'finalise' | 'cancel' | 'reopen';

// ─── Prepare OT List Modal ────────────────────────────────────────────────────

interface PrepareModalProps {
  finalisedRecords: FinalizeSurgeryRecord[];
  prepareDate: string;
  onClose: () => void;
  onSubmit: (items: PrepareOtListItem[]) => Promise<void>;
}

function PrepareOtListModal({ finalisedRecords, prepareDate, onClose, onSubmit }: PrepareModalProps) {
  const [sequences, setSequences] = useState<Record<string, string>>(
    Object.fromEntries(finalisedRecords.map((r, i) => [r.id, String(i + 1)]))
  );
  const [submitting, setSubmitting] = useState(false);
  const [conflictingIds, setConflictingIds] = useState<string[]>([]);
  const [editedTimes, setEditedTimes] = useState<Record<string, string>>({});

  const handleSubmit = async () => {
    const items: PrepareOtListItem[] = finalisedRecords.map(r => ({
      scheduleId: r.id,
      sequence: parseInt(sequences[r.id] ?? '0', 10) || 0,
      ...(editedTimes[r.id] ? { newStartTime: editedTimes[r.id] } : {}),
    }));

    const hasDuplicates = items.some(
      (a, i) => items.slice(i + 1).some(b => b.sequence === a.sequence && a.sequence !== 0)
    );
    if (hasDuplicates) {
      toast.error('Duplicate sequence numbers — each row must have a unique number.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(items);
      // success — modal will close from parent; reset conflict state just in case
      setConflictingIds([]);
    } catch (err: unknown) {
      const response = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number; data?: { message?: string; conflictingScheduleIds?: string[] } } }).response
        : undefined;
      if (response?.status === 409) {
        const ids = response.data?.conflictingScheduleIds;
        if (Array.isArray(ids) && ids.length > 0) {
          // New backend: time-slot conflict — highlight specific rows
          setConflictingIds(ids);
          setEditedTimes(t => {
            const next = { ...t };
            Object.keys(next).forEach(id => { if (!ids.includes(id)) delete next[id]; });
            return next;
          });
        } else {
          // Fallback: backend returned 409 without specific IDs — highlight all rows
          setConflictingIds(finalisedRecords.map(r => r.id));
          setEditedTimes({});
        }
      } else {
        throw err;
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Prepare OT List</h3>
            <p className="text-xs text-gray-500 mt-0.5">Assign sequence numbers. Records will be locked once submitted.</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-96 px-6 py-4">
          {conflictingIds.length > 0 && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                <span className="font-semibold">Start-time conflict detected.</span>
                {' '}The highlighted records share a time slot with an already-prepared surgery. Update the start time on each highlighted row, then click Lock &amp; Prepare.
              </p>
            </div>
          )}
          {finalisedRecords.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No Finalised records found for this date.</p>
              <p className="text-xs mt-1 text-gray-400">Apply a date filter or finalise some records first.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="pb-2 text-left font-semibold w-20">Seq #</th>
                  <th className="pb-2 text-left font-semibold">Patient</th>
                  <th className="pb-2 text-left font-semibold">Surgery</th>
                  <th className="pb-2 text-left font-semibold">Start Time</th>
                  <th className="pb-2 text-left font-semibold">Surgeon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {finalisedRecords.map(r => (
                  <tr key={r.id}>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        min={1}
                        value={sequences[r.id] ?? ''}
                        onChange={e => setSequences(s => ({ ...s, [r.id]: e.target.value }))}
                        className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <p className="font-medium text-gray-900">{r.patientName}</p>
                      <p className="text-xs text-gray-500 font-mono">{r.uhid}</p>
                    </td>
                    <td className="py-2 pr-3 text-gray-700">{r.surgeryName}</td>
                    <td className="py-2 pr-3 text-gray-600 text-xs whitespace-nowrap">
                      {conflictingIds.includes(r.id) ? (
                        <div>
                          <input
                            type="time"
                            value={editedTimes[r.id] ?? ''}
                            onChange={e => setEditedTimes(t => ({ ...t, [r.id]: e.target.value }))}
                            className="border border-amber-400 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50 w-28"
                          />
                          <p className="text-amber-600 text-[10px] mt-0.5 font-medium">Time conflict — choose a new time</p>
                        </div>
                      ) : (
                        r.startTime || '—'
                      )}
                    </td>
                    <td className="py-2 text-gray-600 text-xs">{r.surgeon}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || finalisedRecords.length === 0 || (conflictingIds.length > 0 && !conflictingIds.every(id => editedTimes[id]))}
            className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {submitting && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            Lock & Prepare
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-3 bg-gray-200 rounded animate-pulse" style={{ width: `${40 + (i * 13) % 45}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FinalizeSurgeryPage() {
  const { invalidateFinalizeList, patchFinalizeRecord } = useInvalidateCounsellorsDesk();
  const [activeTab, setActiveTab] = useState('All');
  const [filters, setFilters] = useState<FinalizeListFilters>({ date: '', uhid: '', name: '' });
  const debouncedFilters = useDebouncedValue(filters, 300);

  const finalizeQuery = useFinalizeListQuery(debouncedFilters);
  const records = finalizeQuery.data ?? [];
  const isLoading = finalizeQuery.isLoading && records.length === 0;
  const isRefreshing = finalizeQuery.isFetching && records.length > 0;

  // Finalize OT detail modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Prepare OT List modal
  const [prepareModalOpen, setPrepareModalOpen] = useState(false);
  const [prepareDate, setPrepareDate] = useState('');

  // Locked OT list (bottom section)
  const [otListDate, setOtListDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [otList, setOtList] = useState<FinalizeSurgeryRecord[]>([]);
  const [otLoading, setOtLoading] = useState(false);
  const preparedListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (finalizeQuery.isError) toast.error('Failed to load finalize list');
  }, [finalizeQuery.isError]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void finalizeQuery.refetch();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [finalizeQuery]);

  const filtered = useMemo(() => {
    if (activeTab === 'All') return records;
    return records.filter(r => r.status === activeTab);
  }, [records, activeTab]);

  const tabCounts = useMemo(() => {
    const map: Record<string, number> = { All: records.length };
    STATUS_TABS.slice(1).forEach(({ key }) => {
      map[key] = records.filter(r => r.status === key).length;
    });
    return map;
  }, [records]);

  const finalisedForDate = useMemo(() => {
    return records.filter(r => r.status === 'Finalised');
  }, [records]);

  // ── Stats bar ─────────────────────────────────────────────────────────────
  const statsBar = useMemo(() => {
    const pendingActions = records.filter(r => r.status === 'NotConfirmed' || r.status === 'Confirmed').length;
    const surgeryDone    = records.filter(r => r.status === 'SurgeryDone').length;
    const waitTimes      = records
      .filter(r => r.counsellingDate && r.scheduleDate)
      .map(r => Math.round(
        (new Date(r.scheduleDate!).getTime() - new Date(r.counsellingDate!).getTime()) / 86_400_000
      ))
      .filter(d => d >= 0);
    const avgWait = waitTimes.length > 0
      ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length)
      : 0;
    return { total: records.length, pendingActions, surgeryDone, avgWait };
  }, [records]);

  // ── Duplicate booking detection ───────────────────────────────────────────
  const duplicateIds = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const r of records) {
      const date = r.scheduleDate?.slice(0, 10) ?? '_nodate_';
      const key  = `${r.uhid}_${date}`;
      (groups[key] ??= []).push(r.id);
    }
    const result = new Set<string>();
    Object.values(groups).forEach(ids => { if (ids.length > 1) ids.forEach(id => result.add(id)); });
    return result;
  }, [records]);

  // ── Print OT Slip ─────────────────────────────────────────────────────────
  const printOtSlip = (rec: FinalizeSurgeryRecord) => {
    const w = window.open('', '_blank', 'width=620,height=540');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>OT Slip – ${rec.patientName}</title><style>
body{font-family:Arial,sans-serif;padding:20px;font-size:13px;}
h1{font-size:15px;text-align:center;color:#1e40af;margin:0 0 14px;}
table{width:100%;border-collapse:collapse;}
td{padding:7px 10px;border:1px solid #e2e8f0;}
td:first-child{font-weight:600;background:#f8fafc;width:42%;}
.footer{font-size:10px;color:#94a3b8;text-align:center;margin-top:14px;}
</style></head><body>
<h1>OT Slip</h1>
<table>
<tr><td>Patient Name</td><td>${rec.patientName}</td></tr>
<tr><td>UHID</td><td>${rec.uhid}</td></tr>
<tr><td>Surgery</td><td>${rec.surgeryName || '—'}</td></tr>
<tr><td>Eye</td><td>${rec.eyes || '—'}</td></tr>
<tr><td>Surgeon</td><td>${rec.surgeon || '—'}</td></tr>
<tr><td>Theatre</td><td>${rec.theaterName || '—'}</td></tr>
<tr><td>Surgery Date</td><td>${rec.scheduleDate ? new Date(rec.scheduleDate).toLocaleDateString('en-IN') : '—'}</td></tr>
<tr><td>Start Time</td><td>${rec.startTime || '—'}</td></tr>
<tr><td>Reporting Time</td><td>${rec.reportingTime || '—'}</td></tr>
<tr><td>Anesthesia</td><td>${rec.anesthesiaType || '—'}</td></tr>
<tr><td>Package</td><td>${rec.packageName || '—'}</td></tr>
<tr><td>Package Amount</td><td>${rec.packageRate != null ? '₹' + Number(rec.packageRate).toLocaleString('en-IN') : '—'}</td></tr>
<tr><td>Patient Type</td><td>${rec.patientType || '—'}</td></tr>
<tr><td>Payment Mode</td><td>${rec.paymentMode || '—'}</td></tr>
<tr><td>Status</td><td>${rec.status}</td></tr>
</table>
<p class="footer">Generated: ${new Date().toLocaleString('en-IN')}</p>
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script>
</body></html>`);
    w.document.close();
  };

  const handleAction = async (action: ActionKey, rec: FinalizeSurgeryRecord) => {
    const patch = (p: Partial<FinalizeSurgeryRecord>) =>
      patchFinalizeRecord(debouncedFilters, rec.id, p);

    try {
      if (action === 'confirm') {
        const u = await counsellorsDeskApi.confirmOtSchedule(rec.id);
        patch({ status: u.status, version: u.version });
        toast.success(`${rec.patientName} confirmed`);
      } else if (action === 'finalise') {
        const u = await counsellorsDeskApi.finaliseOtSchedule(rec.id);
        patch({ status: u.status, version: u.version });
        toast.success(`${rec.patientName} finalised`);
      } else if (action === 'cancel') {
        const u = await counsellorsDeskApi.cancelOtSchedule(rec.id);
        patch({ status: u.status, version: u.version });
        toast.success(`${rec.patientName} cancelled — counselling session re-queued`);
      } else if (action === 'reopen') {
        const u = await counsellorsDeskApi.reopenOtCase(rec.id);
        patch({ status: u.status, version: u.version, isLocked: false });
        // Refresh OT list if loaded
        if (otList.find(r => r.id === rec.id)) {
          setOtList(l => l.filter(r => r.id !== rec.id));
        }
        toast.success(`${rec.patientName} reopened for editing`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const handleSubmitPrepareOtList = async (items: PrepareOtListItem[]) => {
    await counsellorsDeskApi.submitPrepareOtList({
      date: prepareDate || new Date().toISOString().slice(0, 10),
      items,
    });
    toast.success('OT list locked and prepared');
    setPrepareModalOpen(false);
    invalidateFinalizeList();
  };

  const handleLoadOtList = async () => {
    setOtLoading(true);
    try {
      const data = await counsellorsDeskApi.getOtList(
        otListDate || new Date().toISOString().slice(0, 10)
      );
      setOtList(data);
    } catch {
      toast.error('Failed to load OT list');
    } finally {
      setOtLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <FinalizeOtModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        scheduleId={selectedId}
        onStatusChange={(updated) => {
          patchFinalizeRecord(debouncedFilters, updated.id, mapOtRecord(updated));
          setModalOpen(false);
        }}
      />
      {prepareModalOpen && (
        <PrepareOtListModal
          finalisedRecords={finalisedForDate}
          prepareDate={prepareDate}
          onClose={() => setPrepareModalOpen(false)}
          onSubmit={handleSubmitPrepareOtList}
        />
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Schedule Date</label>
            <input type="date" value={filters.date}
              onChange={e => setFilters(f => ({ ...f, date: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">UHID</label>
            <input type="text" placeholder="Search UHID…" value={filters.uhid}
              onChange={e => setFilters(f => ({ ...f, uhid: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Patient Name</label>
            <input type="text" placeholder="Search name…" value={filters.name}
              onChange={e => setFilters(f => ({ ...f, name: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {isRefreshing && (
            <RefreshCw className="h-4 w-4 text-blue-500 animate-spin mb-2" aria-label="Refreshing" />
          )}
          <div className="ml-auto">
            <button
              disabled={(tabCounts['Finalised'] ?? 0) === 0}
              title={(tabCounts['Finalised'] ?? 0) === 0 ? 'No Finalised records — finalise some records first' : 'Prepare OT List'}
              onClick={() => { setPrepareDate(filters.date); setPrepareModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <ClipboardList className="h-4 w-4" />
              Prepare OT List
            </button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Scheduled',  value: statsBar.total,          color: 'bg-blue-50 border-blue-200',     text: 'text-blue-700'    },
          { label: 'Pending Actions',  value: statsBar.pendingActions,  color: 'bg-amber-50 border-amber-200',   text: 'text-amber-700'   },
          { label: 'Surgery Done',     value: statsBar.surgeryDone,     color: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
          { label: 'Avg. Wait (days)', value: statsBar.avgWait,         color: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700'  },
        ].map(card => (
          <div key={card.label} className={`rounded-xl border p-4 ${card.color}`}>
            <p className={`text-2xl font-bold ${card.text}`}>{card.value}</p>
            <p className="text-xs text-gray-500 mt-1 font-medium">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center px-4 pt-4 pb-3 overflow-x-auto gap-1.5">
          {STATUS_TABS.map(({ key, label, color, activeClass }) => {
            const count = tabCounts[key] ?? 0;
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                  isActive
                    ? `${activeClass} shadow-sm`
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-white/80' : color}`} />
                {label}
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                  isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                }`}>{count}</span>
              </button>
            );
          })}
        </div>

        {duplicateIds.size > 0 && (
          <div className="mx-4 mb-3 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-500" />
            <span>
              <strong>{duplicateIds.size} record{duplicateIds.size > 1 ? 's' : ''}</strong> flagged as possible duplicate bookings — same patient scheduled on the same date.
            </span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-y border-gray-100">
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Status</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">UHID</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Patient</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Surgery</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide whitespace-nowrap">Surgery Date</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Eyes</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Type</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Surgeon</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Start Time</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Theatre</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Package</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Pkg. Amount</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Reporting</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Anesthesia</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Payment</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide">Checklist</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && records.length === 0
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={17} />)
                : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={17} className="py-14 text-center text-gray-400">
                      <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No records found</p>
                    </td>
                  </tr>
                ) : filtered.map(rec => (
                  <tr
                    key={rec.id}
                    className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${rec.isLocked ? 'bg-indigo-50/30' : ''}`}
                    onClick={() => { setSelectedId(rec.id); setModalOpen(true); }}
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={rec.status} size="sm" />
                        {rec.isLocked && (
                          <span title="Record locked — use Reopen to edit">
                            <LockKeyhole className="h-3 w-3 text-indigo-500" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-blue-700 font-medium whitespace-nowrap">{rec.uhid}</td>
                    <td className="px-3 py-3 font-medium text-gray-900">{rec.patientName}</td>
                    <td className="px-3 py-3 text-gray-700">{rec.surgeryName}</td>
                    <td className="px-3 py-3 text-gray-600 text-xs whitespace-nowrap">{rec.scheduleDate || '—'}</td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">{rec.eyes}</span>
                    </td>
                    <td className="px-3 py-3 text-gray-600 text-xs">{rec.patientType === 'Insurance' ? 'Insurance / TPA' : (rec.patientType || '—')}</td>
                    <td className="px-3 py-3 text-gray-700 text-xs">{rec.surgeon}</td>
                    <td className="px-3 py-3 text-gray-600 text-xs whitespace-nowrap">{rec.startTime || '—'}</td>
                    <td className="px-3 py-3 text-gray-600 text-xs">{rec.theaterName}</td>
                    <td className="px-3 py-3 text-gray-700 text-xs max-w-[120px]">
                      <span className="truncate block" title={rec.packageName ?? ''}>{rec.packageName || '—'}</span>
                    </td>
                    <td className="px-3 py-3 text-gray-700 text-xs whitespace-nowrap">
                      {rec.packageRate != null ? `₹${Number(rec.packageRate).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-3 py-3 text-gray-600 text-xs whitespace-nowrap">{rec.reportingTime || '—'}</td>
                    <td className="px-3 py-3 text-xs">
                      {rec.anesthesiaType
                        ? <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs font-medium">{rec.anesthesiaType}</span>
                        : <span className="text-gray-400">—</span>
                      }
                    </td>
                    <td className="px-3 py-3 text-gray-600 text-xs">{rec.paymentMode || '—'}</td>
                    <td className="px-3 py-3 text-xs">
                      {rec.checklistSummary
                        ? <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            rec.checklistSummary === 'AllClear' ? 'bg-green-100 text-green-700'
                            : rec.checklistSummary === 'Pending' ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-600'
                          }`}>
                            {rec.checklistSummary === 'AllClear' ? '✓ Clear'
                              : rec.checklistSummary === 'Pending' ? '⏳ Pending'
                              : '✗ Missing'}
                          </span>
                        : <span className="text-gray-400">—</span>
                      }
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          title="Print OT Slip"
                          onClick={() => printOtSlip(rec)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        {duplicateIds.has(rec.id) && (
                          <span title="Possible duplicate booking — patient already scheduled on this date">
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>

        {!isLoading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 flex items-center gap-2">
              {isRefreshing && (
                <RefreshCw className="h-3 w-3 animate-spin text-blue-500" aria-hidden />
              )}
              Showing <span className="font-medium">{filtered.length}</span> of{' '}
              <span className="font-medium">{records.length}</span> records
            </p>
          </div>
        )}
      </div>

      {/* ── Locked OT List Section ── */}
      <div ref={preparedListRef} className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <LockKeyhole className="h-4 w-4 text-indigo-500" />
            Prepared OT List
          </h2>
          {otList.length > 0 && (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-600 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
          )}
        </div>
        <div className="p-5">
          <div className="flex items-end gap-3 mb-4 flex-wrap">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input type="date" value={otListDate}
                onChange={e => setOtListDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button onClick={handleLoadOtList} disabled={otLoading}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {otLoading ? (
                <><svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>Loading…</>
              ) : (
                <><ClipboardList className="h-4 w-4" />Load OT List</>
              )}
            </button>
            <button
              onClick={() => { setPrepareDate(otListDate); setPrepareModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 border border-indigo-300 text-indigo-700 hover:bg-indigo-50 rounded-lg text-sm font-medium transition-colors"
            >
              + Prepare New List
            </button>
          </div>

          {otList.length === 0 && !otLoading ? (
            <div className="py-10 text-center text-gray-400">
              <ClipboardList className="h-7 w-7 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Select a date and click "Load OT List" to view the locked schedule.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-indigo-50 text-indigo-700">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold">#</th>
                    <th className="px-3 py-2.5 text-left font-semibold">UHID</th>
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Patient Name</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Surgery</th>
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Surgery Date</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Eyes</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Surgeon</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Theatre</th>
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Start Time</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Type</th>
                    <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Prepared At</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {otList.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-indigo-50/20 transition-colors">
                      <td className="px-3 py-2.5 text-indigo-600 font-bold">{row.sequenceNo ?? idx + 1}</td>
                      <td className="px-3 py-2.5 font-mono text-blue-700 font-medium">{row.uhid}</td>
                      <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">{row.patientName}</td>
                      <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{row.surgeryName}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{row.scheduleDate || '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">{row.eyes}</span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{row.surgeon}</td>
                      <td className="px-3 py-2.5 text-gray-600">{row.theaterName}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{row.startTime || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-500">{row.patientType}</td>
                      <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">
                        {row.preparedAt ? new Date(row.preparedAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => handleAction('reopen', row)}
                          className="px-2 py-1 text-amber-700 border border-amber-300 hover:bg-amber-50 rounded-lg text-xs font-medium transition-colors"
                        >
                          Reopen
                        </button>
                      </td>
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
