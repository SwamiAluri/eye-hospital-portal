'use client';

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import {
  ClipboardList,
  LockKeyhole,
  AlertCircle,
  X,
  Printer,
  ChevronRight,
  Calendar,
  Search,
  Users,
} from 'lucide-react';
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
import { WaitingListQueuePagination } from '@/components/counsellors-desk/waiting-list/WaitingListQueuePagination';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives/CounsellingButton';
import { CounsellingInput } from '@/components/counsellors-desk/session/primitives/CounsellingInput';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { formatWaitingListDoctorDisplay } from '@/lib/counsellors-desk/waiting-list-layout';
import {
  WAITING_LIST_DEFAULT_PAGE_SIZE,
  getWaitingListTotalPages,
  sliceWaitingListPage,
  type WaitingListPageSize,
} from '@/lib/counsellors-desk/waiting-list-pagination';
import type {
  FinalizeSurgeryRecord,
  FinalizeStatus,
  PrepareOtListItem,
} from '@/types/counsellors-desk';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: 'All', label: 'All' },
  { key: 'NotConfirmed', label: 'Not Confirmed' },
  { key: 'Confirmed', label: 'Confirmed' },
  { key: 'Finalised', label: 'Finalised' },
  { key: 'OTPrepared', label: 'OT Prepared' },
  { key: 'Cancelled', label: 'Cancelled' },
  { key: 'SurgeryDone', label: 'Surgery Done' },
] as const;

type ActionKey = 'confirm' | 'finalise' | 'cancel' | 'reopen';

const denseBtn = 'min-h-8 !min-h-8 h-8 text-xs';
const WORK_GRID = 'finalize-surgery-work-grid';
const COLUMN_CUES = ['Patient', 'Surgery', 'Status', 'Schedule', 'Action'] as const;

function formatScheduleDate(raw?: string): string {
  if (!raw) return '—';
  const d = new Date(`${raw.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function primaryActionForStatus(status: FinalizeStatus): {
  label: string;
  action?: ActionKey;
  openModal?: boolean;
  variant?: 'primary' | 'outline' | 'ghost';
} {
  switch (status) {
    case 'NotConfirmed':
      return { label: 'Confirm', action: 'confirm', variant: 'primary' };
    case 'Confirmed':
      return { label: 'Finalise', action: 'finalise', variant: 'primary' };
    case 'Cancelled':
      return { label: 'Reopen', action: 'reopen', variant: 'outline' };
    case 'OTPrepared':
      return { label: 'Reopen', action: 'reopen', variant: 'outline' };
    case 'Finalised':
    case 'SurgeryDone':
    default:
      return { label: 'Open', openModal: true, variant: 'ghost' };
  }
}

// ─── Prepare OT List Modal ────────────────────────────────────────────────────

interface PrepareModalProps {
  finalisedRecords: FinalizeSurgeryRecord[];
  prepareDate: string;
  onClose: () => void;
  onSubmit: (items: PrepareOtListItem[]) => Promise<void>;
}

function PrepareOtListModal({ finalisedRecords, prepareDate, onClose, onSubmit }: PrepareModalProps) {
  const [sequences, setSequences] = useState<Record<string, string>>(
    Object.fromEntries(finalisedRecords.map((r, i) => [r.id, String(i + 1)])),
  );
  const [submitting, setSubmitting] = useState(false);
  const [conflictingIds, setConflictingIds] = useState<string[]>([]);
  const [editedTimes, setEditedTimes] = useState<Record<string, string>>({});

  const dateLabel = (() => {
    const raw = prepareDate || new Date().toISOString().slice(0, 10);
    const d = new Date(`${raw.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  })();

  const handleSubmit = async () => {
    const items: PrepareOtListItem[] = finalisedRecords.map((r) => ({
      scheduleId: r.id,
      sequence: parseInt(sequences[r.id] ?? '0', 10) || 0,
      ...(editedTimes[r.id] ? { newStartTime: editedTimes[r.id] } : {}),
    }));

    const hasDuplicates = items.some(
      (a, i) => items.slice(i + 1).some((b) => b.sequence === a.sequence && a.sequence !== 0),
    );
    if (hasDuplicates) {
      toast.error('Duplicate sequence numbers — each row must have a unique number.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(items);
      setConflictingIds([]);
    } catch (err: unknown) {
      const response =
        err && typeof err === 'object' && 'response' in err
          ? (
              err as {
                response?: {
                  status?: number;
                  data?: { message?: string; conflictingScheduleIds?: string[] };
                };
              }
            ).response
          : undefined;
      if (response?.status === 409) {
        const ids = response.data?.conflictingScheduleIds;
        if (Array.isArray(ids) && ids.length > 0) {
          setConflictingIds(ids);
          setEditedTimes((t) => {
            const next = { ...t };
            Object.keys(next).forEach((id) => {
              if (!ids.includes(id)) delete next[id];
            });
            return next;
          });
        } else {
          setConflictingIds(finalisedRecords.map((r) => r.id));
          setEditedTimes({});
        }
      } else {
        throw err;
      }
    } finally {
      setSubmitting(false);
    }
  };

  const lockDisabled =
    submitting ||
    finalisedRecords.length === 0 ||
    (conflictingIds.length > 0 && conflictingIds.some((id) => !editedTimes[id]));

  return (
    <div className="counselling-session fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className={cn(
          counsellingSessionTokens.sessionWidget,
          'flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden shadow-xl',
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prepare-ot-list-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-counselling-border/60 px-5 py-3.5">
          <div>
            <h2
              id="prepare-ot-list-title"
              className="text-lg font-semibold text-counselling-foreground"
            >
              Prepare OT List
            </h2>
            <p className="mt-0.5 text-[13px] text-counselling-muted-foreground">
              {finalisedRecords.length} Finalised · {dateLabel}
            </p>
          </div>
          <CounsellingButton
            type="button"
            variant="ghost"
            size="sm"
            className="!min-h-8 h-8 w-8 px-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </CounsellingButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-3">
          {finalisedRecords.length === 0 ? (
            <p className="py-8 text-center text-sm text-counselling-muted-foreground">
              No Finalised records for this date.
            </p>
          ) : (
            <div className="divide-y divide-counselling-border/40">
              {finalisedRecords.map((r) => {
                const conflict = conflictingIds.includes(r.id);
                return (
                  <div
                    key={r.id}
                    className={cn(
                      'flex flex-wrap items-center gap-3 py-3',
                      conflict && 'rounded-lg bg-amber-50/80 px-2',
                    )}
                  >
                    <div className="w-14 shrink-0">
                      <label className="mb-0.5 block text-[11px] font-medium text-counselling-muted-foreground">
                        Seq #
                      </label>
                      <CounsellingInput
                        type="number"
                        min={1}
                        value={sequences[r.id] ?? ''}
                        onChange={(e) =>
                          setSequences((s) => ({ ...s, [r.id]: e.target.value }))
                        }
                        className="h-8"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-counselling-foreground">
                        {r.patientName}
                      </p>
                      <p className="truncate text-[13px] text-counselling-muted-foreground">
                        {[r.uhid, r.surgeryName, r.eyes].filter(Boolean).join(' · ')}
                      </p>
                      <p className="truncate text-xs text-counselling-muted-foreground">
                        {[r.startTime, r.theaterName].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    {conflict ? (
                      <div className="w-28 shrink-0">
                        <label className="mb-0.5 block text-[11px] font-medium text-amber-800">
                          New start
                        </label>
                        <CounsellingInput
                          type="time"
                          value={editedTimes[r.id] ?? ''}
                          onChange={(e) =>
                            setEditedTimes((t) => ({ ...t, [r.id]: e.target.value }))
                          }
                          className="h-8"
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-counselling-border/60 px-5 py-3">
          <CounsellingButton
            type="button"
            variant="outline"
            size="sm"
            className={denseBtn}
            onClick={onClose}
          >
            Cancel
          </CounsellingButton>
          <CounsellingButton
            type="button"
            size="sm"
            className={cn(denseBtn, 'bg-counselling-primary text-white hover:bg-counselling-primary/90')}
            onClick={() => void handleSubmit()}
            disabled={lockDisabled}
            loading={submitting}
          >
            Lock &amp; Prepare
          </CounsellingButton>
        </div>
      </div>
    </div>
  );
}

// ─── Work row ─────────────────────────────────────────────────────────────────

function FinalizeWorkRow({
  rec,
  isDuplicate,
  isSelected,
  onOpen,
  onAction,
  onPrint,
}: {
  rec: FinalizeSurgeryRecord;
  isDuplicate: boolean;
  isSelected: boolean;
  onOpen: () => void;
  onAction: (action: ActionKey) => void;
  onPrint: () => void;
}) {
  const primary = primaryActionForStatus(rec.status);
  const doctor = formatWaitingListDoctorDisplay(rec.surgeon);
  const typeLabel =
    rec.patientType === 'Insurance' ? 'Insurance / TPA' : rec.patientType || null;
  const identityLine = [rec.uhid, typeLabel].filter(Boolean).join(' · ');
  const scheduleLine = [
    formatScheduleDate(rec.scheduleDate),
    rec.eyes || null,
    rec.startTime || null,
    rec.theaterName || null,
  ]
    .filter(Boolean)
    .join(' · ');
  const quietMeta = [
    doctor || null,
    rec.packageName || null,
    rec.paymentMode || null,
    rec.checklistSummary
      ? rec.checklistSummary === 'AllClear'
        ? 'Slot clear'
        : rec.checklistSummary === 'Pending'
          ? 'Slot pending'
          : 'Slot missing'
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
  };

  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="finalize-surgery-work-row"
      data-schedule-id={rec.id}
      aria-pressed={isSelected}
      aria-label={`${rec.patientName}, ${rec.status}. Activate to open surgery details.`}
      onClick={onOpen}
      onKeyDown={onKeyDown}
      className={cn(
        'group min-h-14 cursor-pointer bg-transparent px-1 py-2.5 transition-colors',
        'hover:bg-counselling-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-counselling-primary/40',
        isSelected && 'bg-counselling-accent/35',
        rec.isLocked && 'bg-counselling-accent/15',
      )}
    >
      <div className={WORK_GRID}>
        <div className="min-w-0">
          <div className="flex items-start gap-1.5">
            <p className="truncate text-sm font-semibold leading-5 text-counselling-foreground">
              {rec.patientName}
            </p>
            {rec.isLocked ? (
              <LockKeyhole
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-counselling-primary"
                aria-label="Locked"
              />
            ) : null}
            {isDuplicate ? (
              <AlertCircle
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500"
                aria-label="Possible duplicate booking"
              />
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[13px] font-medium leading-4 text-counselling-muted-foreground">
            {identityLine || '—'}
          </p>
          {quietMeta ? (
            <p className="mt-0.5 truncate text-xs leading-4 text-counselling-muted-foreground">
              {quietMeta}
            </p>
          ) : null}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-5 text-counselling-foreground">
            {rec.surgeryName || '—'}
          </p>
          {rec.anesthesiaType ? (
            <p className="mt-0.5 truncate text-xs text-counselling-muted-foreground">
              {rec.anesthesiaType}
              {rec.reportingTime ? ` · Report ${rec.reportingTime}` : ''}
            </p>
          ) : rec.reportingTime ? (
            <p className="mt-0.5 truncate text-xs text-counselling-muted-foreground">
              Report {rec.reportingTime}
            </p>
          ) : null}
        </div>

        <div className="min-w-0">
          <StatusBadge status={rec.status} size="sm" showDot />
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-5 text-counselling-foreground">
            {scheduleLine}
          </p>
          {rec.packageRate != null ? (
            <p className="mt-0.5 truncate text-xs tabular-nums text-counselling-muted-foreground">
              ₹{Number(rec.packageRate).toLocaleString('en-IN')}
            </p>
          ) : null}
        </div>

        <div className="flex min-w-0 items-center justify-end gap-0.5" onClick={stop}>
          <CounsellingButton
            type="button"
            variant="ghost"
            size="sm"
            className="!min-h-8 h-8 w-8 px-0 text-counselling-muted-foreground"
            title="Print OT Slip"
            aria-label="Print OT Slip"
            onClick={onPrint}
          >
            <Printer className="h-3.5 w-3.5" />
          </CounsellingButton>
          <CounsellingButton
            type="button"
            size="sm"
            variant={primary.variant === 'ghost' ? 'ghost' : primary.variant === 'outline' ? 'outline' : 'default'}
            className={cn(
              denseBtn,
              'px-2.5',
              primary.variant === 'primary' &&
                'bg-counselling-primary text-white hover:bg-counselling-primary/90',
              primary.variant === 'outline' &&
                'border-amber-300 text-amber-900 hover:bg-amber-50',
            )}
            onClick={() => {
              if (primary.openModal) onOpen();
              else if (primary.action) onAction(primary.action);
            }}
          >
            {primary.label}
          </CounsellingButton>
          <ChevronRight
            className="h-4 w-4 shrink-0 text-counselling-muted-foreground/50 transition-colors group-hover:text-counselling-muted-foreground"
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}

function WorklistSkeleton() {
  return (
    <div className="divide-y divide-counselling-border/40" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={cn(WORK_GRID, 'min-h-14 items-center px-1 py-2.5')}>
          <div className="h-3 max-w-[80%] animate-pulse rounded-full bg-counselling-muted" />
          <div className="hidden h-3 max-w-[70%] animate-pulse rounded-full bg-counselling-muted sm:block" />
          <div className="hidden h-3 w-16 animate-pulse rounded-full bg-counselling-muted sm:block" />
          <div className="hidden h-3 max-w-[60%] animate-pulse rounded-full bg-counselling-muted sm:block" />
          <div className="hidden h-7 w-16 justify-self-end animate-pulse rounded-md bg-counselling-muted sm:block" />
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FinalizeSurgeryPage() {
  const { invalidateFinalizeList, patchFinalizeRecord } = useInvalidateCounsellorsDesk();
  const [activeTab, setActiveTab] = useState('All');
  const [filters, setFilters] = useState<FinalizeListFilters>({ date: '', uhid: '', name: '' });
  const debouncedFilters = useDebouncedValue(filters, 300);

  const finalizeQuery = useFinalizeListQuery(debouncedFilters);
  const records = useMemo(() => finalizeQuery.data ?? [], [finalizeQuery.data]);
  const isLoading = finalizeQuery.isLoading && records.length === 0;
  const isRefreshing = finalizeQuery.isFetching && records.length > 0;

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [prepareModalOpen, setPrepareModalOpen] = useState(false);
  const [prepareDate, setPrepareDate] = useState('');

  const [otListDate, setOtListDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [otList, setOtList] = useState<FinalizeSurgeryRecord[]>([]);
  const [otLoading, setOtLoading] = useState(false);
  /** UI workspace only — not a backend status. */
  const [activeWorkspace, setActiveWorkspace] = useState<'finalization' | 'ot-preparation'>(
    'finalization',
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<WaitingListPageSize>(WAITING_LIST_DEFAULT_PAGE_SIZE);

  useEffect(() => {
    if (finalizeQuery.isError) toast.error('Failed to load finalize list');
  }, [finalizeQuery.isError]);

  useEffect(() => {
    if (!prepareModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [prepareModalOpen]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void finalizeQuery.refetch();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [finalizeQuery]);

  const filtered = useMemo(() => {
    if (activeTab === 'All') return records;
    return records.filter((r) => r.status === activeTab);
  }, [records, activeTab]);

  // Reset to page 1 when the visible queue scope changes (client-side pagination only).
  useEffect(() => {
    setPage(1);
  }, [
    activeTab,
    debouncedFilters.date,
    debouncedFilters.uhid,
    debouncedFilters.name,
    pageSize,
  ]);

  useEffect(() => {
    const totalPages = getWaitingListTotalPages(filtered.length, pageSize);
    if (page > totalPages) setPage(totalPages);
  }, [filtered.length, pageSize, page]);

  const pagedRecords = useMemo(
    () => sliceWaitingListPage(filtered, page, pageSize),
    [filtered, page, pageSize],
  );

  const handlePageSizeChange = useCallback((next: WaitingListPageSize) => {
    setPageSize(next);
    setPage(1);
  }, []);

  const tabCounts = useMemo(() => {
    const map: Record<string, number> = { All: records.length };
    STATUS_TABS.slice(1).forEach(({ key }) => {
      map[key] = records.filter((r) => r.status === key).length;
    });
    return map;
  }, [records]);

  const finalisedForDate = useMemo(() => {
    return records.filter((r) => r.status === 'Finalised');
  }, [records]);

  const statsBar = useMemo(() => {
    const pendingActions = records.filter(
      (r) => r.status === 'NotConfirmed' || r.status === 'Confirmed',
    ).length;
    const surgeryDone = records.filter((r) => r.status === 'SurgeryDone').length;
    const waitTimes = records
      .filter((r) => r.counsellingDate && r.scheduleDate)
      .map((r) =>
        Math.round(
          (new Date(r.scheduleDate!).getTime() - new Date(r.counsellingDate!).getTime()) /
            86_400_000,
        ),
      )
      .filter((d) => d >= 0);
    const avgWait =
      waitTimes.length > 0
        ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length)
        : 0;
    return { total: records.length, pendingActions, surgeryDone, avgWait };
  }, [records]);

  const duplicateIds = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const r of records) {
      const date = r.scheduleDate?.slice(0, 10) ?? '_nodate_';
      const key = `${r.uhid}_${date}`;
      (groups[key] ??= []).push(r.id);
    }
    const result = new Set<string>();
    Object.values(groups).forEach((ids) => {
      if (ids.length > 1) ids.forEach((id) => result.add(id));
    });
    return result;
  }, [records]);

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
        if (otList.find((r) => r.id === rec.id)) {
          setOtList((l) => l.filter((r) => r.id !== rec.id));
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
        otListDate || new Date().toISOString().slice(0, 10),
      );
      setOtList(data);
    } catch {
      toast.error('Failed to load OT list');
    } finally {
      setOtLoading(false);
    }
  };

  const otPrepDateLabel = useMemo(() => {
    const raw = otListDate || new Date().toISOString().slice(0, 10);
    const d = new Date(`${raw.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }, [otListDate]);
  const openRow = (id: string) => {
    setSelectedId(id);
    setModalOpen(true);
  };

  const openPrepareFlow = (dateSource: string) => {
    setActiveWorkspace('ot-preparation');
    setPrepareDate(dateSource || new Date().toISOString().slice(0, 10));
    setPrepareModalOpen(true);
  };

  return (
    <div
      className={cn(
        counsellingSessionTokens.shellPage,
        'gap-2 overflow-hidden px-4 pb-4 pt-2.5 sm:gap-2.5',
      )}
    >
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

      <header className="flex shrink-0 flex-col justify-center px-0.5 py-0.5">
        <h1 className="text-xl font-semibold tracking-tight text-counselling-foreground sm:text-[1.375rem]">
          Surgery Finalization
        </h1>
      </header>

      {/* ONE compact stats widget — counselling sessionStatusStrip */}
      <div
        className={cn(counsellingSessionTokens.sessionStatusStrip, 'shrink-0')}
        data-testid="finalize-surgery-summary"
        aria-label="Schedule summary"
      >
        <dl
          className={cn(
            counsellingSessionTokens.sessionStatusDetails,
            'grid-cols-2 sm:grid-cols-4',
          )}
        >
          <div className="min-w-0" data-testid="finalize-stat-scheduled">
            <dd className="text-lg font-semibold leading-6 tabular-nums text-counselling-foreground sm:text-xl">
              {statsBar.total}
            </dd>
            <dt className={counsellingSessionTokens.sessionStatusDetailLabel}>Scheduled</dt>
          </div>
          <div className="min-w-0" data-testid="finalize-stat-needs-attention">
            <dd className="text-lg font-semibold leading-6 tabular-nums text-counselling-foreground sm:text-xl">
              {statsBar.pendingActions}
            </dd>
            <dt className={counsellingSessionTokens.sessionStatusDetailLabel}>Needs Attention</dt>
          </div>
          <div className="min-w-0" data-testid="finalize-stat-surgery-done">
            <dd className="text-lg font-semibold leading-6 tabular-nums text-counselling-foreground sm:text-xl">
              {statsBar.surgeryDone}
            </dd>
            <dt className={counsellingSessionTokens.sessionStatusDetailLabel}>Surgery Done</dt>
          </div>
          <div className="min-w-0" data-testid="finalize-stat-avg-wait">
            <dd className="text-lg font-semibold leading-6 tabular-nums text-counselling-foreground sm:text-xl">
              {statsBar.avgWait}{' '}
              <span className="text-sm font-semibold text-counselling-muted-foreground">days</span>
            </dd>
            <dt className={counsellingSessionTokens.sessionStatusDetailLabel}>Avg. Wait</dt>
          </div>
        </dl>
      </div>

      {/* Primary workspace — journey pill tabs (approved Finalize Surgery treatment) */}
      <nav
        aria-label="Surgery finalization workspaces"
        data-testid="finalize-surgery-workspace-nav"
        className="flex min-w-0 shrink-0 flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain px-0.5"
      >
        <button
          type="button"
          aria-current={activeWorkspace === 'finalization' ? 'page' : undefined}
          data-testid="finalize-workspace-finalization"
          onClick={() => setActiveWorkspace('finalization')}
          className={cn(
            counsellingSessionTokens.journeyTab,
            'shrink-0 whitespace-nowrap',
            activeWorkspace === 'finalization'
              ? counsellingSessionTokens.journeyTabCurrent
              : 'border-transparent bg-transparent text-counselling-muted-foreground hover:bg-transparent hover:text-counselling-foreground',
          )}
        >
          Surgery Finalization
        </button>
        <button
          type="button"
          aria-current={activeWorkspace === 'ot-preparation' ? 'page' : undefined}
          data-testid="finalize-workspace-ot-preparation"
          onClick={() => setActiveWorkspace('ot-preparation')}
          className={cn(
            counsellingSessionTokens.journeyTab,
            'shrink-0 whitespace-nowrap',
            activeWorkspace === 'ot-preparation'
              ? counsellingSessionTokens.journeyTabCurrent
              : 'border-transparent bg-transparent text-counselling-muted-foreground hover:bg-transparent hover:text-counselling-foreground',
          )}
        >
          OT Preparation
        </button>
      </nav>

      {activeWorkspace === 'finalization' ? (
          <section
            data-testid="finalize-surgery-workspace"
            aria-label="Surgery queue workspace"
            className={cn(
              counsellingSessionTokens.sessionWidget,
              'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
            )}
          >
            <div
              className="shrink-0 border-b border-counselling-border/50 px-4 pt-3 sm:px-5"
              data-testid="finalize-surgery-status-nav"
              data-status-style="pill-tab"
              role="tablist"
              aria-label="Surgery status"
            >
              <div
                className={cn(
                  counsellingSessionTokens.pillTabTrack,
                  'flex-nowrap gap-1.5 overflow-x-auto overscroll-x-contain pb-3',
                )}
              >
                {STATUS_TABS.map(({ key, label }) => {
                  const count = tabCounts[key] ?? 0;
                  const isActive = activeTab === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      data-testid={`finalize-status-tab-${key}`}
                      onClick={() => setActiveTab(key)}
                      className={cn(
                        counsellingSessionTokens.pillTab,
                        'shrink-0 whitespace-nowrap',
                        isActive && counsellingSessionTokens.pillTabCurrent,
                      )}
                    >
                      <span>{label}</span>
                      <span
                        className={cn(
                          'tabular-nums',
                          isActive ? 'text-white/90' : 'text-counselling-muted-foreground',
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className="shrink-0 border-b border-counselling-border/50 px-4 py-3 sm:px-5"
              data-testid="finalize-surgery-toolbar"
            >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[9.5rem_8.5rem_minmax(0,1fr)_auto] lg:items-end lg:gap-3">
              <div className="min-w-0">
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-counselling-muted-foreground">
                  <Calendar className="h-3 w-3" aria-hidden />
                  Date
                </label>
                <CounsellingInput
                  type="date"
                  value={filters.date}
                  onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
                  className="h-8"
                  aria-label="Schedule date"
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-counselling-muted-foreground">
                  <Search className="h-3 w-3" aria-hidden />
                  UHID
                </label>
                <CounsellingInput
                  type="text"
                  placeholder="UHID…"
                  value={filters.uhid}
                  onChange={(e) => setFilters((f) => ({ ...f, uhid: e.target.value }))}
                  className="h-8"
                  aria-label="UHID"
                />
              </div>
              <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-counselling-muted-foreground">
                  <Users className="h-3 w-3" aria-hidden />
                  Patient Name
                </label>
                <CounsellingInput
                  type="text"
                  placeholder="Search by patient name…"
                  value={filters.name}
                  onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))}
                  className="h-8"
                  aria-label="Patient name"
                />
              </div>
              <div className="flex items-end justify-stretch sm:justify-end">
                <CounsellingButton
                  type="button"
                  size="sm"
                  className={cn(
                    denseBtn,
                    'h-8 w-full bg-counselling-primary text-white hover:bg-counselling-primary/90 sm:w-auto',
                  )}
                  disabled={finalisedForDate.length === 0}
                  onClick={() =>
                    openPrepareFlow(filters.date || new Date().toISOString().slice(0, 10))
                  }
                >
                  <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                  Prepare OT List
                </CounsellingButton>
              </div>
            </div>
            </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-3 pt-2.5 sm:px-5">
            <div className="mb-1.5 flex shrink-0 items-center justify-between gap-2">
              <h2 className={counsellingSessionTokens.sessionWidgetTitle}>Surgery Queue</h2>
              <span className="text-xs font-medium text-counselling-muted-foreground">
                <span className="tabular-nums text-counselling-foreground">{filtered.length}</span>{' '}
                records
                {isRefreshing ? (
                  <span className="ml-2 inline-flex items-center gap-1">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-counselling-border border-t-counselling-primary" />
                    Refreshing
                  </span>
                ) : null}
              </span>
            </div>

            {duplicateIds.size > 0 && (
              <div className="mb-2 flex shrink-0 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                <span>
                  <strong>
                    {duplicateIds.size} record{duplicateIds.size > 1 ? 's' : ''}
                  </strong>{' '}
                  flagged as possible duplicate bookings — same patient scheduled on the same date.
                </span>
              </div>
            )}

            {!isLoading && filtered.length > 0 ? (
              <div
                className={cn(
                  WORK_GRID,
                  'mb-0 shrink-0 border-b border-counselling-border/50 px-1 py-2 max-md:hidden',
                )}
                aria-hidden
              >
                {COLUMN_CUES.map((cue) => (
                  <p
                    key={cue}
                    className={cn(
                      'text-[11px] font-medium tracking-wide text-counselling-muted-foreground',
                      cue === 'Action' && 'text-right',
                    )}
                  >
                    {cue}
                  </p>
                ))}
              </div>
            ) : null}

            <div
              className="counselling-hidden-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"
              data-testid="finalize-surgery-table-viewport"
            >
              {isLoading ? (
                <WorklistSkeleton />
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <p className="text-sm font-medium text-counselling-foreground">No records found</p>
                  <p className="text-xs text-counselling-muted-foreground">
                    Try adjusting the date or search filters
                  </p>
                </div>
              ) : (
                <div className="min-w-0 divide-y divide-counselling-border/40">
                  {pagedRecords.map((rec) => (
                    <FinalizeWorkRow
                      key={rec.id}
                      rec={rec}
                      isDuplicate={duplicateIds.has(rec.id)}
                      isSelected={selectedId === rec.id}
                      onOpen={() => openRow(rec.id)}
                      onAction={(action) => void handleAction(action, rec)}
                      onPrint={() => printOtSlip(rec)}
                    />
                  ))}
                </div>
              )}
            </div>

            {!isLoading && filtered.length > 0 ? (
              <div className="mt-2.5 shrink-0 border-t border-counselling-border/50 pt-2.5">
                <WaitingListQueuePagination
                  page={page}
                  pageSize={pageSize}
                  totalCount={filtered.length}
                  onPageChange={setPage}
                  onPageSizeChange={handlePageSizeChange}
                  isRefreshing={isRefreshing}
                  itemLabel="records"
                  data-testid="finalize-surgery-pagination"
                />
              </div>
            ) : null}
          </div>
        </section>
      ) : (
        <section
          data-testid="finalize-ot-preparation-workspace"
          aria-label="OT preparation workspace"
          className={cn(
            counsellingSessionTokens.sessionWidget,
            'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
          )}
        >
          <div
            className="flex min-h-0 min-w-0 flex-1 flex-col px-4 py-3 sm:px-5"
            data-testid="finalize-prepared-ot-list"
          >
            <div className="mb-3 flex shrink-0 flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className={counsellingSessionTokens.sessionWidgetTitle}>OT Preparation</h2>
                <p className="mt-0.5 text-[13px] text-counselling-muted-foreground">
                  {finalisedForDate.length > 0
                    ? `${finalisedForDate.length} Finalised ready for preparation`
                    : 'Load or prepare the OT list for a surgery date'}
                </p>
              </div>
            </div>

            <div className="mb-3 flex shrink-0 flex-wrap items-end gap-2 border-b border-counselling-border/50 pb-3">
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-counselling-muted-foreground">
                  <Calendar className="h-3 w-3" aria-hidden />
                  Date
                </label>
                <CounsellingInput
                  type="date"
                  value={otListDate}
                  onChange={(e) => setOtListDate(e.target.value)}
                  className="h-8 w-[9.5rem]"
                  aria-label="Prepared OT list date"
                />
              </div>
              <CounsellingButton
                type="button"
                size="sm"
                variant="outline"
                className={cn(denseBtn, 'h-8')}
                onClick={handleLoadOtList}
                disabled={otLoading}
                loading={otLoading}
              >
                <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                Load OT List
              </CounsellingButton>
              <CounsellingButton
                type="button"
                size="sm"
                className={cn(
                  denseBtn,
                  'h-8 bg-counselling-primary text-white hover:bg-counselling-primary/90',
                )}
                disabled={finalisedForDate.length === 0}
                onClick={() => openPrepareFlow(otListDate)}
              >
                Prepare New List
              </CounsellingButton>
              {otList.length > 0 ? (
                <CounsellingButton
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(denseBtn, 'h-8')}
                  onClick={() => window.print()}
                >
                  <Printer className="h-3.5 w-3.5" aria-hidden />
                  Print
                </CounsellingButton>
              ) : null}
            </div>

            {otList.length === 0 ? (
              <div className="rounded-lg border border-dashed border-counselling-border/70 px-4 py-6 text-center">
                <p className="text-sm font-medium text-counselling-foreground">
                  No prepared OT list for this date
                </p>
                <p className="mt-1 text-xs text-counselling-muted-foreground">
                  {otPrepDateLabel} · Use Load OT List or Prepare New List
                </p>
              </div>
            ) : (
              <div className="counselling-hidden-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-counselling-foreground">
                    Prepared OT List
                  </p>
                  <p className="text-xs text-counselling-muted-foreground">
                    {otPrepDateLabel} ·{' '}
                    <span className="tabular-nums font-semibold text-counselling-foreground">
                      {otList.length}
                    </span>{' '}
                    patients
                  </p>
                </div>
                <div className="divide-y divide-counselling-border/40">
                  {otList.map((row, idx) => (
                    <div
                      key={row.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 py-2.5 text-[13px]"
                    >
                      <span className="w-6 shrink-0 font-semibold tabular-nums text-counselling-primary">
                        {row.sequenceNo ?? idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-counselling-foreground">
                          {row.patientName}
                        </p>
                        <p className="truncate text-xs text-counselling-muted-foreground">
                          {[row.uhid, row.surgeryName, row.eyes, row.startTime, row.theaterName]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      <CounsellingButton
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          denseBtn,
                          'border-amber-300 text-amber-800 hover:bg-amber-50',
                        )}
                        onClick={() => void handleAction('reopen', row)}
                      >
                        Reopen
                      </CounsellingButton>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

