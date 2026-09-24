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
import { finalizeMutationErrorMessage } from '@/lib/counsellors-desk/finalize-mutation-error';
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
import {
  isValidPrepareOtSurgeryDate,
  selectFinalisedForPrepareDate,
} from '@/lib/counsellors-desk/prepare-ot-date-scope';
import { OT_PREP_SURGERY_DATE_CATALOG_FILTERS } from '@/lib/counsellors-desk/ot-preparation-surgery-date-catalog';
import {
  buildContinuedPrepareItems,
  filterFinalisedForOtPrepWorklist,
  highestOtPreparedSequenceForDate,
  reconcileSelectionToVisible,
  resolveSinglePrepareScheduleDate,
  selectAllVisibleIds,
  selectedRecordsInWorklistOrder,
} from '@/lib/counsellors-desk/ot-preparation-resp2';
import { openOtPreparationPreparedListPrint } from '@/lib/counsellors-desk/ot-preparation-prepared-list-print';
import {
  openOtSlipsPrint,
  selectAllVisibleOtPreparedIds,
  selectedOtPreparedRecordsInOrder,
} from '@/lib/counsellors-desk/ot-slip-print';
import {
  FINALIZE_OT_MUTATE_PERMISSION,
  resolveFinalizeQueuePrimaryAction,
} from '@/lib/counsellors-desk/finalize-ot-authorization';
import {
  NEEDS_ATTENTION_KPI_LABEL,
  countNeedsAttention,
  isReportingTimeValid,
} from '@/lib/counsellors-desk/finalize-surgery-package1';
import { formatCounsellingTimeDisplay } from '@/lib/counsellors-desk/counselling-time';
import { COUNSELLING_SESSIONS_READ_PERMISSION } from '@/lib/counsellors-desk/counselling-auth';
import { useHasPermission } from '@/hooks/use-permissions';
import { ProtectedRoute } from '@/components/ProtectedRoute';
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
const OT_PREP_WORK_GRID = 'finalize-ot-prep-work-grid';
const COLUMN_CUES = ['Patient', 'Surgery', 'Status', 'Schedule', 'Action'] as const;
const OT_PREP_COLUMN_CUES = ['', 'Patient', 'Surgery', 'Status', 'Schedule', 'Action'] as const;

function formatScheduleDate(raw?: string): string {
  if (!raw) return '—';
  const d = new Date(`${raw.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function primaryActionForStatus(
  status: FinalizeStatus,
  canMutateOt: boolean,
): {
  label: string;
  action?: ActionKey;
  openModal?: boolean;
  variant?: 'primary' | 'outline' | 'ghost';
} {
  return resolveFinalizeQueuePrimaryAction(status, canMutateOt);
}

// ─── Prepare OT List Modal ────────────────────────────────────────────────────

interface PrepareModalProps {
  finalisedRecords: FinalizeSurgeryRecord[];
  prepareDate: string;
  /** Optional FE-supplied SequenceNo seeds (RESP2 continuation / conflict retry). */
  initialSequences?: Record<string, number>;
  onClose: () => void;
  onSubmit: (items: PrepareOtListItem[]) => Promise<void>;
}

function PrepareOtListModal({
  finalisedRecords,
  prepareDate,
  initialSequences,
  onClose,
  onSubmit,
}: PrepareModalProps) {
  const [sequences, setSequences] = useState<Record<string, string>>(
    Object.fromEntries(
      finalisedRecords.map((r, i) => [
        r.id,
        String(initialSequences?.[r.id] ?? i + 1),
      ]),
    ),
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
      } else if (response?.status === 400) {
        toast.error(response.data?.message || 'Surgery date is required to prepare OT.');
      } else {
        toast.error(
          response?.data?.message ||
            (err instanceof Error ? err.message : 'Failed to prepare OT list'),
        );
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
  canMutateOt,
  onOpen,
  onAction,
  onPrint,
  printSelection,
}: {
  rec: FinalizeSurgeryRecord;
  isDuplicate: boolean;
  isSelected: boolean;
  canMutateOt: boolean;
  onOpen: () => void;
  onAction: (action: ActionKey) => void;
  onPrint: () => void;
  /** OT Prepared bulk print selection — current-page checkboxes only. */
  printSelection?: {
    checked: boolean;
    onToggle: (next: boolean) => void;
  };
}) {
  const primary = primaryActionForStatus(rec.status, canMutateOt);
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
  const showPrintSelect = Boolean(printSelection);
  const gridClass = showPrintSelect ? OT_PREP_WORK_GRID : WORK_GRID;
  const checkboxId = `ot-prepared-print-select-${rec.id}`;

  const patientCell = (
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
      <p className="mt-0 truncate text-[13px] font-medium leading-4 text-counselling-muted-foreground max-[1599px]:leading-[1.125rem]">
        <span>{identityLine || '—'}</span>
        {quietMeta ? (
          <span className="min-[1600px]:hidden">{` · ${quietMeta}`}</span>
        ) : null}
      </p>
      {quietMeta ? (
        <p className="mt-0.5 hidden truncate text-xs leading-4 text-counselling-muted-foreground min-[1600px]:block">
          {quietMeta}
        </p>
      ) : null}
    </div>
  );

  const surgeryCell = (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium leading-5 text-counselling-foreground">
        {rec.surgeryName || '—'}
      </p>
      {rec.anesthesiaType ? (
        <p className="mt-0.5 truncate text-xs text-counselling-muted-foreground">
          {rec.anesthesiaType}
          {rec.reportingTime
            ? ` · Report ${formatCounsellingTimeDisplay(rec.reportingTime) || rec.reportingTime}`
            : ''}
        </p>
      ) : rec.reportingTime ? (
        <p className="mt-0.5 truncate text-xs text-counselling-muted-foreground">
          Report {formatCounsellingTimeDisplay(rec.reportingTime) || rec.reportingTime}
        </p>
      ) : null}
    </div>
  );

  const scheduleCell = (
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
  );

  const actionCell = (
    <div className="flex min-w-0 items-center justify-end gap-0.5" onClick={stop}>
      {!showPrintSelect ? (
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
      ) : null}
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
      {!showPrintSelect ? (
        <ChevronRight
          className="h-4 w-4 shrink-0 text-counselling-muted-foreground/50 transition-colors group-hover:text-counselling-muted-foreground"
          aria-hidden
        />
      ) : null}
    </div>
  );

  return (
    <div
      role={showPrintSelect ? undefined : 'button'}
      tabIndex={showPrintSelect ? undefined : 0}
      data-testid="finalize-surgery-work-row"
      data-schedule-id={rec.id}
      data-print-selected={printSelection?.checked ? 'true' : 'false'}
      aria-pressed={showPrintSelect ? undefined : isSelected}
      aria-label={
        showPrintSelect
          ? undefined
          : `${rec.patientName}, ${rec.status}. Activate to open surgery details.`
      }
      onClick={showPrintSelect ? undefined : onOpen}
      onKeyDown={showPrintSelect ? undefined : onKeyDown}
      className={cn(
        'group staff-worklist-row bg-transparent px-1 transition-colors',
        !showPrintSelect &&
          'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-counselling-primary/40',
        'hover:bg-counselling-muted/30',
        (isSelected || printSelection?.checked) && 'bg-counselling-accent/35',
        rec.isLocked && !printSelection?.checked && 'bg-counselling-accent/15',
      )}
    >
      <div className={gridClass}>
        {printSelection ? (
          <div className="flex items-center justify-center" onClick={stop}>
            <input
              id={checkboxId}
              type="checkbox"
              checked={printSelection.checked}
              onChange={(e) => printSelection.onToggle(e.target.checked)}
              className="h-4 w-4 rounded border-counselling-border text-counselling-primary focus-visible:ring-2 focus-visible:ring-counselling-primary/40"
              data-testid={`finalize-ot-prepared-select-${rec.id}`}
              aria-label={`Select ${rec.patientName} for OT slip print`}
            />
          </div>
        ) : null}
        {showPrintSelect ? (
          <div
            role="button"
            tabIndex={0}
            className="min-w-0 cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-counselling-primary/40"
            onClick={onOpen}
            onKeyDown={onKeyDown}
            aria-label={`${rec.patientName}, ${rec.status}. Activate to open surgery details.`}
          >
            {patientCell}
          </div>
        ) : (
          patientCell
        )}
        {surgeryCell}
        <div className="min-w-0">
          <StatusBadge status={rec.status} size="sm" showDot />
        </div>
        {scheduleCell}
        {actionCell}
      </div>
    </div>
  );
}

function WorklistSkeleton() {
  return (
    <div className="divide-y divide-counselling-border/40" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={cn(WORK_GRID, 'staff-worklist-row items-center px-1')}>
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

/** RESP2 — Finalised row with explicit selection checkbox. */
function OtPrepWorkRow({
  rec,
  checked,
  onToggle,
  onOpen,
}: {
  rec: FinalizeSurgeryRecord;
  checked: boolean;
  onToggle: (next: boolean) => void;
  onOpen: () => void;
}) {
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
  const quietMeta = [doctor || null, rec.packageName || null, rec.paymentMode || null]
    .filter(Boolean)
    .join(' · ');
  const stop = (e: MouseEvent) => e.stopPropagation();
  const checkboxId = `ot-prep-select-${rec.id}`;

  return (
    <div
      data-testid={`finalize-ot-prep-row-${rec.id}`}
      data-schedule-id={rec.id}
      data-selected={checked ? 'true' : 'false'}
      className={cn(
        'group staff-worklist-row bg-transparent px-1 transition-colors',
        'hover:bg-counselling-muted/30',
        checked && 'bg-counselling-accent/35',
      )}
    >
      <div className={OT_PREP_WORK_GRID}>
        <div className="flex items-center justify-center" onClick={stop}>
          <input
            id={checkboxId}
            type="checkbox"
            checked={checked}
            onChange={(e) => onToggle(e.target.checked)}
            className="h-4 w-4 rounded border-counselling-border text-counselling-primary focus-visible:ring-2 focus-visible:ring-counselling-primary/40"
            data-testid={`finalize-ot-prep-select-${rec.id}`}
            aria-label={`Select ${rec.patientName} for OT preparation`}
          />
        </div>
        <div
          role="button"
          tabIndex={0}
          className="min-w-0 cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-counselling-primary/40"
          onClick={onOpen}
          onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpen();
            }
          }}
          aria-label={`${rec.patientName}, Finalised. Activate to open surgery details.`}
        >
          <p className="truncate text-sm font-semibold leading-5 text-counselling-foreground">
            {rec.patientName}
          </p>
          <p className="mt-0 truncate text-[13px] font-medium leading-4 text-counselling-muted-foreground">
            {identityLine || '—'}
            {quietMeta ? ` · ${quietMeta}` : ''}
          </p>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-5 text-counselling-foreground">
            {rec.surgeryName || '—'}
          </p>
        </div>
        <div className="min-w-0">
          <StatusBadge status={rec.status} size="sm" showDot />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-5 text-counselling-foreground">
            {scheduleLine}
          </p>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-0.5" onClick={stop}>
          <CounsellingButton
            type="button"
            size="sm"
            variant="outline"
            className={cn(denseBtn, 'px-2.5')}
            onClick={onOpen}
            data-testid={`finalize-ot-prep-open-${rec.id}`}
          >
            Open
          </CounsellingButton>
        </div>
      </div>
    </div>
  );
}

function OtPrepPrepareConfirmDialog({
  selectedCount,
  scheduleDate,
  submitting,
  onCancel,
  onConfirm,
}: {
  selectedCount: number;
  scheduleDate: string;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dateLabel = formatScheduleDate(scheduleDate);
  return (
    <div className="counselling-session fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className={cn(
          counsellingSessionTokens.sessionWidget,
          'w-full max-w-md shadow-xl',
        )}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ot-prep-confirm-title"
        aria-describedby="ot-prep-confirm-desc"
        data-testid="finalize-ot-prep-confirm"
      >
        <div className="border-b border-counselling-border/60 px-5 py-3.5">
          <h2
            id="ot-prep-confirm-title"
            className="text-lg font-semibold text-counselling-foreground"
          >
            Prepare OT
          </h2>
          <p
            id="ot-prep-confirm-desc"
            className="mt-1 text-sm text-counselling-muted-foreground"
            data-testid="finalize-ot-prep-confirm-count"
          >
            Prepare {selectedCount} selected{' '}
            {selectedCount === 1 ? 'surgery' : 'surgeries'} for {dateLabel}?
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3">
          <CounsellingButton
            type="button"
            variant="outline"
            size="sm"
            className={denseBtn}
            onClick={onCancel}
            disabled={submitting}
            data-testid="finalize-ot-prep-confirm-cancel"
          >
            Cancel
          </CounsellingButton>
          <CounsellingButton
            type="button"
            size="sm"
            className={cn(denseBtn, 'bg-counselling-primary text-white hover:bg-counselling-primary/90')}
            onClick={onConfirm}
            loading={submitting}
            disabled={submitting}
            data-testid="finalize-ot-prep-confirm-submit"
          >
            Prepare OT
          </CounsellingButton>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FinalizeSurgeryPage() {
  return (
    <ProtectedRoute requiredPermission={COUNSELLING_SESSIONS_READ_PERMISSION}>
      <FinalizeSurgeryPageContent />
    </ProtectedRoute>
  );
}

function FinalizeSurgeryPageContent() {
  const { invalidateFinalizeList, patchFinalizeRecord } = useInvalidateCounsellorsDesk();
  const canMutateOt = useHasPermission(FINALIZE_OT_MUTATE_PERMISSION);
  const [activeTab, setActiveTab] = useState('All');
  const [filters, setFilters] = useState<FinalizeListFilters>({ date: '', uhid: '', name: '' });
  const debouncedFilters = useDebouncedValue(filters, 300);

  const finalizeQuery = useFinalizeListQuery(debouncedFilters);
  const records = useMemo(() => finalizeQuery.data ?? [], [finalizeQuery.data]);
  const isLoading = finalizeQuery.isLoading && records.length === 0;
  const isRefreshing = finalizeQuery.isFetching && records.length > 0;

  // PD-OTPREP-01/02: existing GET ot-schedule with date omitted — full ScheduleDate universe for catalog.
  const catalogQuery = useFinalizeListQuery({ ...OT_PREP_SURGERY_DATE_CATALOG_FILTERS });
  const catalogRecords = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [prepareModalOpen, setPrepareModalOpen] = useState(false);
  const [prepareDate, setPrepareDate] = useState('');
  const [prepareInitialSequences, setPrepareInitialSequences] = useState<
    Record<string, number> | undefined
  >(undefined);
  const [prepareModalRecordsOverride, setPrepareModalRecordsOverride] = useState<
    FinalizeSurgeryRecord[] | null
  >(null);

  /** RESP2 OT Prep worklist filters (independent of Finalization filters). */
  const [otPrepFilters, setOtPrepFilters] = useState<FinalizeListFilters>({
    date: '',
    uhid: '',
    name: '',
  });
  const debouncedOtPrepFilters = useDebouncedValue(otPrepFilters, 300);
  const [otPrepPage, setOtPrepPage] = useState(1);
  const [otPrepPageSize, setOtPrepPageSize] = useState<WaitingListPageSize>(
    WAITING_LIST_DEFAULT_PAGE_SIZE,
  );
  const [otPrepSelectedIds, setOtPrepSelectedIds] = useState<Set<string>>(() => new Set());
  const [otPrepConfirmOpen, setOtPrepConfirmOpen] = useState(false);
  const [otPrepPrepareSubmitting, setOtPrepPrepareSubmitting] = useState(false);
  const [otPrepPrintBusy, setOtPrepPrintBusy] = useState(false);
  /** Last successful Prepare date — for optional View OT Prepared. */
  const [otPrepLastSuccess, setOtPrepLastSuccess] = useState<{
    date: string;
    count: number;
  } | null>(null);

  /** UI workspace only — not a backend status. */
  const [activeWorkspace, setActiveWorkspace] = useState<'finalization' | 'ot-preparation'>(
    'finalization',
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<WaitingListPageSize>(WAITING_LIST_DEFAULT_PAGE_SIZE);
  /** Finalization OT Prepared — bulk OT slip print selection (current page only). */
  const [otPreparedPrintSelectedIds, setOtPreparedPrintSelectedIds] = useState<Set<string>>(
    () => new Set(),
  );

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
      if (document.visibilityState === 'visible') {
        void finalizeQuery.refetch();
        void catalogQuery.refetch();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [finalizeQuery, catalogQuery]);

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

  const isOtPreparedTab = activeTab === 'OTPrepared';

  useEffect(() => {
    if (!isOtPreparedTab) {
      setOtPreparedPrintSelectedIds(new Set());
      return;
    }
    const visibleIds = pagedRecords.map((r) => r.id);
    setOtPreparedPrintSelectedIds((prev) => reconcileSelectionToVisible(prev, visibleIds));
  }, [isOtPreparedTab, pagedRecords]);

  const otPreparedPrintSelectedCount = otPreparedPrintSelectedIds.size;

  const toggleOtPreparedPrintRow = useCallback((id: string, next: boolean) => {
    setOtPreparedPrintSelectedIds((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  }, []);

  const selectAllVisibleOtPreparedPrint = useCallback(() => {
    setOtPreparedPrintSelectedIds(selectAllVisibleOtPreparedIds(pagedRecords));
  }, [pagedRecords]);

  const clearOtPreparedPrintSelection = useCallback(() => {
    setOtPreparedPrintSelectedIds(new Set());
  }, []);

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
    // Prepare OT scope = selected Finalize date filter (not "all Finalised in the loaded list").
    return selectFinalisedForPrepareDate(records, filters.date);
  }, [records, filters.date]);

  const otPrepFiltered = useMemo(
    () => filterFinalisedForOtPrepWorklist(catalogRecords, debouncedOtPrepFilters),
    [catalogRecords, debouncedOtPrepFilters],
  );

  useEffect(() => {
    setOtPrepPage(1);
  }, [
    debouncedOtPrepFilters.date,
    debouncedOtPrepFilters.uhid,
    debouncedOtPrepFilters.name,
    otPrepPageSize,
  ]);

  useEffect(() => {
    const totalPages = getWaitingListTotalPages(otPrepFiltered.length, otPrepPageSize);
    if (otPrepPage > totalPages) setOtPrepPage(totalPages);
  }, [otPrepFiltered.length, otPrepPageSize, otPrepPage]);

  const otPrepPaged = useMemo(
    () => sliceWaitingListPage(otPrepFiltered, otPrepPage, otPrepPageSize),
    [otPrepFiltered, otPrepPage, otPrepPageSize],
  );

  /** Cross-page selection not allowed — reconcile to current page visible ids. */
  useEffect(() => {
    const visibleIds = otPrepPaged.map((r) => r.id);
    setOtPrepSelectedIds((prev) => {
      const next = reconcileSelectionToVisible(prev, visibleIds);
      if (next.size === prev.size && [...next].every((id) => prev.has(id))) return prev;
      return next;
    });
  }, [otPrepPaged]);

  const otPrepSelectedCount = otPrepSelectedIds.size;
  const otPrepSameDateCheck = useMemo(
    () => resolveSinglePrepareScheduleDate(otPrepFiltered, otPrepSelectedIds),
    [otPrepFiltered, otPrepSelectedIds],
  );
  const canPrepareOtFromSelection =
    canMutateOt && otPrepSelectedCount > 0 && otPrepSameDateCheck.ok;

  const handleOtPrepPageSizeChange = useCallback((next: WaitingListPageSize) => {
    setOtPrepPageSize(next);
    setOtPrepPage(1);
  }, []);

  const toggleOtPrepRow = useCallback((id: string, next: boolean) => {
    setOtPrepSelectedIds((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  }, []);

  const selectAllVisibleOtPrep = useCallback(() => {
    setOtPrepSelectedIds(selectAllVisibleIds(otPrepPaged));
  }, [otPrepPaged]);

  const clearOtPrepSelection = useCallback(() => {
    setOtPrepSelectedIds(new Set());
  }, []);

  const prepareModalRecords = useMemo(() => {
    if (prepareModalRecordsOverride) return prepareModalRecordsOverride;
    return selectFinalisedForPrepareDate(catalogRecords, prepareDate);
  }, [catalogRecords, prepareDate, prepareModalRecordsOverride]);

  const statsBar = useMemo(() => {
    const pendingActions = countNeedsAttention(records);
    const surgeryDone = records.filter((r) => r.status === 'SurgeryDone').length;
    return { total: records.length, pendingActions, surgeryDone };
  }, [records]);

  const canPrepareOt =
    canMutateOt && isValidPrepareOtSurgeryDate(filters.date) && finalisedForDate.length > 0;

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
    const result = openOtSlipsPrint([rec]);
    if (!result.opened) {
      toast.error('Unable to open print window. Allow pop-ups and try again.');
    }
  };

  const printSelectedOtSlips = () => {
    if (otPreparedPrintSelectedCount === 0) return;
    const selected = selectedOtPreparedRecordsInOrder(
      filtered,
      otPreparedPrintSelectedIds,
    );
    if (selected.length === 0) {
      toast.error('Select at least one OT Prepared surgery to print.');
      return;
    }
    const result = openOtSlipsPrint(selected);
    if (!result.opened) {
      toast.error('Unable to open print window. Allow pop-ups and try again.');
    }
  };

  const handleAction = async (action: ActionKey, rec: FinalizeSurgeryRecord) => {
    if (!canMutateOt) {
      toast.error('You do not have permission to update surgery finalization.');
      return;
    }
    const patch = (p: Partial<FinalizeSurgeryRecord>) => {
      patchFinalizeRecord(debouncedFilters, rec.id, p);
      patchFinalizeRecord({ ...OT_PREP_SURGERY_DATE_CATALOG_FILTERS }, rec.id, p);
    };

    try {
      if (action === 'confirm') {
        if (!isReportingTimeValid(rec.reportingTime)) {
          toast.error('Reporting time is required to confirm. Open the case to set it.');
          setSelectedId(rec.id);
          setModalOpen(true);
          return;
        }
        const u = await counsellorsDeskApi.confirmOtSchedule(rec.id);
        patch({ status: u.status, version: u.version });
        toast.success(`${rec.patientName} confirmed`);
      } else if (action === 'finalise') {
        const u = await counsellorsDeskApi.finaliseOtSchedule(rec.id);
        patch({ status: u.status, version: u.version });
        toast.success(`${rec.patientName} finalised`);
      } else if (action === 'cancel') {
        // Cancel from queue is not a primary CTA; if invoked, open detail for confirm+reason.
        setSelectedId(rec.id);
        setModalOpen(true);
        toast.error('Open the case to cancel with a required reason.');
        return;
      } else if (action === 'reopen') {
        const u = await counsellorsDeskApi.reopenOtCase(rec.id);
        patch({ status: u.status, version: u.version, isLocked: false });
        toast.success(`${rec.patientName} reopened for editing`);
      }
    } catch (err: unknown) {
      toast.error(finalizeMutationErrorMessage(err, 'Action failed'));
    }
  };

  const viewOtPrepared = useCallback(
    (dateOverride?: string) => {
      const day = (dateOverride ?? otPrepLastSuccess?.date ?? otPrepFilters.date ?? '').slice(0, 10);
      setActiveWorkspace('finalization');
      setActiveTab('OTPrepared');
      if (isValidPrepareOtSurgeryDate(day)) {
        setFilters((f) => ({ ...f, date: day }));
      }
    },
    [otPrepLastSuccess?.date, otPrepFilters.date],
  );

  const handleSubmitPrepareOtList = async (items: PrepareOtListItem[]) => {
    if (!canMutateOt) {
      toast.error('You do not have permission to prepare OT.');
      return;
    }
    if (!isValidPrepareOtSurgeryDate(prepareDate)) {
      toast.error('Surgery date is required to prepare OT.');
      return;
    }
    const day = prepareDate.slice(0, 10);
    await counsellorsDeskApi.submitPrepareOtList({
      date: day,
      items,
    });
    toast.success('OT list locked and prepared');
    setPrepareModalOpen(false);
    setPrepareInitialSequences(undefined);
    setPrepareModalRecordsOverride(null);
    setOtPrepLastSuccess({ date: day, count: items.length });
    setOtPrepSelectedIds(new Set());
    invalidateFinalizeList();
  };

  const openRow = (id: string) => {
    setSelectedId(id);
    setModalOpen(true);
  };

  /** Finalization toolbar — date-scoped Prepare (unchanged certified path). */
  const openPrepareFlow = (dateSource: string) => {
    if (!canMutateOt) {
      toast.error('You do not have permission to prepare OT.');
      return;
    }
    if (!isValidPrepareOtSurgeryDate(dateSource)) {
      toast.error('Select a surgery date before preparing OT.');
      return;
    }
    const day = dateSource.slice(0, 10);
    setPrepareModalRecordsOverride(null);
    setPrepareInitialSequences(undefined);
    setPrepareDate(day);
    setPrepareModalOpen(true);
  };

  /** RESP2 — Prepare only selected Finalised rows (same ScheduleDate). */
  const requestOtPrepPrepare = () => {
    if (!canMutateOt) {
      toast.error('You do not have permission to prepare OT.');
      return;
    }
    if (otPrepSelectedCount === 0) {
      toast.error('Select at least one Finalised surgery.');
      return;
    }
    const check = resolveSinglePrepareScheduleDate(otPrepFiltered, otPrepSelectedIds);
    if (!check.ok) {
      if (check.reason === 'mixed') {
        toast.error('Selected surgeries must have the same surgery date.');
      } else if (check.reason === 'missing_date') {
        toast.error('Selected surgeries are missing a surgery date.');
      } else {
        toast.error('Select at least one Finalised surgery.');
      }
      return;
    }
    setOtPrepConfirmOpen(true);
  };

  /** Package B — dedicated prepared OT list print for selected surgery date. */
  const printOtPreparationPreparedList = async () => {
    const day = (otPrepFilters.date ?? '').slice(0, 10);
    if (!isValidPrepareOtSurgeryDate(day)) {
      toast.error('Select a surgery date before printing the prepared OT list.');
      return;
    }
    setOtPrepPrintBusy(true);
    try {
      const result = await openOtPreparationPreparedListPrint(day);
      if (!result.opened) {
        toast.error('Unable to open print window. Allow pop-ups and try again.');
      }
    } catch (err: unknown) {
      toast.error(finalizeMutationErrorMessage(err, 'Failed to load prepared OT list for print'));
    } finally {
      setOtPrepPrintBusy(false);
    }
  };

  const confirmOtPrepPrepare = async () => {
    if (!canMutateOt) {
      toast.error('You do not have permission to prepare OT.');
      return;
    }
    const check = resolveSinglePrepareScheduleDate(otPrepFiltered, otPrepSelectedIds);
    if (!check.ok) {
      setOtPrepConfirmOpen(false);
      if (check.reason === 'mixed') {
        toast.error('Selected surgeries must have the same surgery date.');
      }
      return;
    }
    const day = check.date;
    const ordered = selectedRecordsInWorklistOrder(otPrepFiltered, otPrepSelectedIds);
    if (ordered.length === 0) {
      setOtPrepConfirmOpen(false);
      toast.error('Select at least one Finalised surgery.');
      return;
    }
    const highest = highestOtPreparedSequenceForDate(catalogRecords, day);
    const items = buildContinuedPrepareItems(ordered, highest);

    setOtPrepPrepareSubmitting(true);
    try {
      await counsellorsDeskApi.submitPrepareOtList({ date: day, items });
      setOtPrepConfirmOpen(false);
      setOtPrepSelectedIds(new Set());
      setOtPrepLastSuccess({ date: day, count: items.length });
      toast.success(
        `Prepared ${items.length} ${items.length === 1 ? 'surgery' : 'surgeries'} for OT`,
      );
      invalidateFinalizeList();
      void catalogQuery.refetch();
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
        setOtPrepConfirmOpen(false);
        const seqMap = Object.fromEntries(items.map((i) => [i.scheduleId, i.sequence]));
        setPrepareDate(day);
        setPrepareModalRecordsOverride(ordered);
        setPrepareInitialSequences(seqMap);
        setPrepareModalOpen(true);
        toast.error(response.data?.message || 'Time conflict — adjust start times to continue.');
      } else if (response?.status === 400) {
        toast.error(response.data?.message || 'Surgery date is required to prepare OT.');
      } else {
        toast.error(
          response?.data?.message ||
            (err instanceof Error ? err.message : 'Failed to prepare OT list'),
        );
      }
    } finally {
      setOtPrepPrepareSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        counsellingSessionTokens.shellPage,
        'staff-page-fit overflow-hidden gap-0.5 px-2.5 pb-1 pt-0.5 h-full',
        'min-[1600px]:gap-2.5 min-[1600px]:px-4 min-[1600px]:pb-4 min-[1600px]:pt-2.5',
      )}
    >
      <FinalizeOtModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        scheduleId={selectedId}
        onStatusChange={(updated) => {
          const mapped = mapOtRecord(updated);
          patchFinalizeRecord(debouncedFilters, updated.id, mapped);
          patchFinalizeRecord({ ...OT_PREP_SURGERY_DATE_CATALOG_FILTERS }, updated.id, mapped);
          setModalOpen(false);
        }}
      />
      {prepareModalOpen && (
        <PrepareOtListModal
          finalisedRecords={prepareModalRecords}
          prepareDate={prepareDate}
          initialSequences={prepareInitialSequences}
          onClose={() => {
            setPrepareModalOpen(false);
            setPrepareInitialSequences(undefined);
            setPrepareModalRecordsOverride(null);
          }}
          onSubmit={handleSubmitPrepareOtList}
        />
      )}
      {otPrepConfirmOpen && otPrepSameDateCheck.ok ? (
        <OtPrepPrepareConfirmDialog
          selectedCount={otPrepSelectedCount}
          scheduleDate={otPrepSameDateCheck.date}
          submitting={otPrepPrepareSubmitting}
          onCancel={() => setOtPrepConfirmOpen(false)}
          onConfirm={() => void confirmOtPrepPrepare()}
        />
      ) : null}

      <header className="flex shrink-0 flex-col justify-center px-0.5 py-0 min-[1600px]:py-0.5">
        <h1
          className="staff-page-title font-semibold tracking-tight text-counselling-foreground min-[1600px]:text-[1.375rem]"
          data-testid="finalize-surgery-page-title"
        >
          {activeWorkspace === 'ot-preparation' ? 'OT Preparation' : 'Surgery Finalization'}
        </h1>
        {activeWorkspace === 'ot-preparation' ? (
          <p
            className="mt-0.5 text-xs text-counselling-muted-foreground"
            data-testid="finalize-ot-prep-purpose"
          >
            Prepare Finalised surgeries for OT.
          </p>
        ) : null}
      </header>

      {/* ONE compact stats widget — Finalization KPIs OR OT-local strip */}
      <div
        className={cn(
          counsellingSessionTokens.sessionStatusStrip,
          'shrink-0',
        )}
        data-testid={
          activeWorkspace === 'ot-preparation'
            ? 'finalize-ot-prep-summary'
            : 'finalize-surgery-summary'
        }
        aria-label={
          activeWorkspace === 'ot-preparation' ? 'OT preparation summary' : 'Schedule summary'
        }
      >
        {activeWorkspace === 'ot-preparation' ? (
          <dl
            className={cn(
              counsellingSessionTokens.sessionStatusDetails,
              'grid-cols-2 gap-x-2 gap-y-1 min-[1600px]:gap-x-4 min-[1600px]:gap-y-2',
            )}
          >
            <div className="min-w-0" data-testid="finalize-ot-stat-finalised">
              <dd className="text-base font-semibold leading-5 tabular-nums text-counselling-foreground min-[1600px]:text-lg min-[1600px]:leading-6 sm:min-[1600px]:text-xl">
                {otPrepFiltered.length}
              </dd>
              <dt className={counsellingSessionTokens.sessionStatusDetailLabel}>Finalised</dt>
            </div>
            <div className="min-w-0" data-testid="finalize-ot-stat-selected">
              <dd className="text-base font-semibold leading-5 tabular-nums text-counselling-foreground min-[1600px]:text-lg min-[1600px]:leading-6 sm:min-[1600px]:text-xl">
                {otPrepSelectedCount}
              </dd>
              <dt className={counsellingSessionTokens.sessionStatusDetailLabel}>Selected</dt>
            </div>
          </dl>
        ) : (
          <dl
            className={cn(
              counsellingSessionTokens.sessionStatusDetails,
              'grid-cols-3 gap-x-2 gap-y-1 min-[1600px]:gap-x-4 min-[1600px]:gap-y-2',
            )}
          >
            <div className="min-w-0" data-testid="finalize-stat-scheduled">
              <dd className="text-base font-semibold leading-5 tabular-nums text-counselling-foreground min-[1600px]:text-lg min-[1600px]:leading-6 sm:min-[1600px]:text-xl">
                {statsBar.total}
              </dd>
              <dt className={counsellingSessionTokens.sessionStatusDetailLabel}>Scheduled</dt>
            </div>
            <div className="min-w-0" data-testid="finalize-stat-needs-attention">
              <dd className="text-base font-semibold leading-5 tabular-nums text-counselling-foreground min-[1600px]:text-lg min-[1600px]:leading-6 sm:min-[1600px]:text-xl">
                {statsBar.pendingActions}
              </dd>
              <dt className={counsellingSessionTokens.sessionStatusDetailLabel}>
                {NEEDS_ATTENTION_KPI_LABEL}
              </dt>
            </div>
            <div className="min-w-0" data-testid="finalize-stat-surgery-done">
              <dd className="text-base font-semibold leading-5 tabular-nums text-counselling-foreground min-[1600px]:text-lg min-[1600px]:leading-6 sm:min-[1600px]:text-xl">
                {statsBar.surgeryDone}
              </dd>
              <dt className={counsellingSessionTokens.sessionStatusDetailLabel}>Surgery Done</dt>
            </div>
          </dl>
        )}
      </div>

      {/* Primary workspace — journey pill tabs (approved Finalize Surgery treatment) */}
      <nav
        aria-label="Surgery finalization workspaces"
        data-testid="finalize-surgery-workspace-nav"
        className="flex min-w-0 shrink-0 flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain px-0.5 max-[1599px]:gap-1.5"
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
              className="shrink-0 border-b border-counselling-border/50 px-2.5 pt-1 sm:px-3 min-[1600px]:px-5 min-[1600px]:pt-3"
              data-testid="finalize-surgery-status-nav"
              data-status-style="pill-tab"
              role="tablist"
              aria-label="Surgery status"
            >
              <div
                className={cn(
                  counsellingSessionTokens.pillTabTrack,
                  'flex-nowrap gap-1 overflow-x-auto overscroll-x-contain pb-1 min-[1600px]:gap-1.5 min-[1600px]:pb-3',
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
              className="shrink-0 border-b border-counselling-border/50 px-2.5 py-1 sm:px-3 min-[1600px]:px-5 min-[1600px]:py-3"
              data-testid="finalize-surgery-toolbar"
            >
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-2 max-[1599px]:lg:grid-cols-[minmax(7.5rem,9rem)_minmax(6.5rem,8rem)_minmax(0,1fr)_auto] lg:grid-cols-[9.5rem_8.5rem_minmax(0,1fr)_auto] lg:items-end min-[1600px]:gap-3">
              <div className="flex min-w-0 items-center gap-1.5 min-[1600px]:flex-col min-[1600px]:items-stretch min-[1600px]:gap-0">
                <label className="mb-0 flex shrink-0 items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-counselling-muted-foreground min-[1600px]:mb-1 min-[1600px]:text-xs min-[1600px]:normal-case min-[1600px]:tracking-normal">
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
              <div className="flex min-w-0 items-center gap-1.5 min-[1600px]:flex-col min-[1600px]:items-stretch min-[1600px]:gap-0">
                <label className="mb-0 flex shrink-0 items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-counselling-muted-foreground min-[1600px]:mb-1 min-[1600px]:text-xs min-[1600px]:normal-case min-[1600px]:tracking-normal">
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
              <div className="flex min-w-0 items-center gap-1.5 sm:col-span-2 lg:col-span-1 min-[1600px]:flex-col min-[1600px]:items-stretch min-[1600px]:gap-0">
                <label className="mb-0 flex shrink-0 items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-counselling-muted-foreground min-[1600px]:mb-1 min-[1600px]:text-xs min-[1600px]:normal-case min-[1600px]:tracking-normal">
                  <Users className="h-3 w-3" aria-hidden />
                  Patient Name
                </label>
                <CounsellingInput
                  type="text"
                  placeholder="Search by patient name…"
                  value={filters.name}
                  onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))}
                  className="h-8 min-w-0 flex-1"
                  aria-label="Patient name"
                />
              </div>
              <div className="flex items-center justify-stretch sm:justify-end min-[1600px]:items-end">
                <CounsellingButton
                  type="button"
                  size="sm"
                  className={cn(
                    denseBtn,
                    'h-8 w-full bg-counselling-primary text-white hover:bg-counselling-primary/90 sm:w-auto',
                  )}
                  disabled={!canPrepareOt}
                  onClick={() => openPrepareFlow(filters.date)}
                >
                  <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                  Prepare OT List
                </CounsellingButton>
              </div>
            </div>
            </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col px-2.5 pb-1.5 pt-1 sm:px-3 min-[1600px]:px-5 min-[1600px]:pb-3 min-[1600px]:pt-2.5">
            <div className="mb-0.5 flex shrink-0 items-center justify-between gap-2 min-[1600px]:mb-1.5">
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

            {isOtPreparedTab && !isLoading && pagedRecords.length > 0 ? (
              <div
                className="mb-1 flex shrink-0 flex-wrap items-center justify-between gap-2"
                data-testid="finalize-ot-prepared-print-selection-bar"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <CounsellingButton
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn(denseBtn, 'h-8')}
                    onClick={selectAllVisibleOtPreparedPrint}
                    data-testid="finalize-ot-prepared-select-all-visible"
                  >
                    Select all visible
                  </CounsellingButton>
                  <CounsellingButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={cn(denseBtn, 'h-8')}
                    onClick={clearOtPreparedPrintSelection}
                    disabled={otPreparedPrintSelectedCount === 0}
                    data-testid="finalize-ot-prepared-clear-selection"
                  >
                    Clear selection
                  </CounsellingButton>
                  <span
                    className="text-xs font-medium text-counselling-muted-foreground"
                    data-testid="finalize-ot-prepared-selected-count"
                  >
                    <span className="tabular-nums text-counselling-foreground">
                      {otPreparedPrintSelectedCount}
                    </span>{' '}
                    selected
                  </span>
                </div>
                <CounsellingButton
                  type="button"
                  size="sm"
                  className={cn(
                    denseBtn,
                    'h-8 bg-counselling-primary text-white hover:bg-counselling-primary/90',
                  )}
                  disabled={otPreparedPrintSelectedCount === 0}
                  onClick={printSelectedOtSlips}
                  data-testid="finalize-ot-prepared-print-slips"
                  title="Print OT Slips for selected patients"
                  aria-label={
                    otPreparedPrintSelectedCount === 0
                      ? 'Print OT Slips'
                      : `Print OT Slips (${otPreparedPrintSelectedCount})`
                  }
                >
                  <Printer className="h-3.5 w-3.5" aria-hidden />
                  {otPreparedPrintSelectedCount === 0
                    ? 'Print OT Slips'
                    : `Print OT Slips (${otPreparedPrintSelectedCount})`}
                </CounsellingButton>
              </div>
            ) : null}

            {duplicateIds.size > 0 && (
              <div className="mb-1.5 flex shrink-0 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-800">
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
                  isOtPreparedTab ? OT_PREP_WORK_GRID : WORK_GRID,
                  'mb-0 shrink-0 border-b border-counselling-border/50 px-1 py-1 max-md:hidden min-[1600px]:py-2',
                )}
                aria-hidden
              >
                {(isOtPreparedTab ? OT_PREP_COLUMN_CUES : COLUMN_CUES).map((cue, i) => (
                  <p
                    key={cue || `sel-${i}`}
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
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]"
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
                      canMutateOt={canMutateOt}
                      onOpen={() => openRow(rec.id)}
                      onAction={(action) => void handleAction(action, rec)}
                      onPrint={() => printOtSlip(rec)}
                      printSelection={
                        isOtPreparedTab
                          ? {
                              checked: otPreparedPrintSelectedIds.has(rec.id),
                              onToggle: (next) => toggleOtPreparedPrintRow(rec.id, next),
                            }
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            {!isLoading && filtered.length > 0 ? (
              <div
                data-testid="finalize-surgery-queue-footer"
                className="mt-1 shrink-0 border-t border-counselling-border/50 pt-1 min-[1600px]:mt-2.5 min-[1600px]:pt-2.5"
              >
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
            className="shrink-0 border-b border-counselling-border/50 px-2.5 py-1 sm:px-3 min-[1600px]:px-5 min-[1600px]:py-3"
            data-testid="finalize-ot-prep-toolbar"
          >
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-2 max-[1599px]:lg:grid-cols-[minmax(7.5rem,9rem)_minmax(6.5rem,8rem)_minmax(0,1fr)_auto] lg:grid-cols-[9.5rem_8.5rem_minmax(0,1fr)_auto] lg:items-end min-[1600px]:gap-3">
              <div className="flex min-w-0 items-center gap-1.5 min-[1600px]:flex-col min-[1600px]:items-stretch min-[1600px]:gap-0">
                <label className="mb-0 flex shrink-0 items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-counselling-muted-foreground min-[1600px]:mb-1 min-[1600px]:text-xs min-[1600px]:normal-case min-[1600px]:tracking-normal">
                  <Calendar className="h-3 w-3" aria-hidden />
                  Date
                </label>
                <CounsellingInput
                  type="date"
                  value={otPrepFilters.date}
                  onChange={(e) => setOtPrepFilters((f) => ({ ...f, date: e.target.value }))}
                  className="h-8"
                  aria-label="Surgery date filter"
                  data-testid="finalize-ot-prep-date-input"
                />
              </div>
              <div className="flex min-w-0 items-center gap-1.5 min-[1600px]:flex-col min-[1600px]:items-stretch min-[1600px]:gap-0">
                <label className="mb-0 flex shrink-0 items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-counselling-muted-foreground min-[1600px]:mb-1 min-[1600px]:text-xs min-[1600px]:normal-case min-[1600px]:tracking-normal">
                  <Search className="h-3 w-3" aria-hidden />
                  UHID
                </label>
                <CounsellingInput
                  type="text"
                  placeholder="UHID…"
                  value={otPrepFilters.uhid}
                  onChange={(e) => setOtPrepFilters((f) => ({ ...f, uhid: e.target.value }))}
                  className="h-8"
                  aria-label="UHID"
                  data-testid="finalize-ot-prep-uhid-input"
                />
              </div>
              <div className="flex min-w-0 items-center gap-1.5 sm:col-span-2 lg:col-span-1 min-[1600px]:flex-col min-[1600px]:items-stretch min-[1600px]:gap-0">
                <label className="mb-0 flex shrink-0 items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-counselling-muted-foreground min-[1600px]:mb-1 min-[1600px]:text-xs min-[1600px]:normal-case min-[1600px]:tracking-normal">
                  <Users className="h-3 w-3" aria-hidden />
                  Patient Name
                </label>
                <CounsellingInput
                  type="text"
                  placeholder="Search by patient name…"
                  value={otPrepFilters.name}
                  onChange={(e) => setOtPrepFilters((f) => ({ ...f, name: e.target.value }))}
                  className="h-8 min-w-0 flex-1"
                  aria-label="Patient name"
                  data-testid="finalize-ot-prep-name-input"
                />
              </div>
              <div className="flex flex-wrap items-center justify-stretch gap-2 sm:justify-end min-[1600px]:items-end">
                <CounsellingButton
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(denseBtn, 'h-8 w-full sm:w-auto')}
                  disabled={
                    otPrepPrintBusy || !isValidPrepareOtSurgeryDate(otPrepFilters.date)
                  }
                  onClick={() => void printOtPreparationPreparedList()}
                  data-testid="finalize-ot-prep-print-prepared"
                  title="Print prepared OT list for selected surgery date"
                  aria-label="Print prepared OT list"
                >
                  <Printer className="h-3.5 w-3.5" aria-hidden />
                  {otPrepPrintBusy ? 'Loading…' : 'Print'}
                </CounsellingButton>
                <CounsellingButton
                  type="button"
                  size="sm"
                  className={cn(
                    denseBtn,
                    'h-8 w-full bg-counselling-primary text-white hover:bg-counselling-primary/90 sm:w-auto',
                  )}
                  disabled={!canPrepareOtFromSelection}
                  onClick={requestOtPrepPrepare}
                  data-testid="finalize-ot-prepare-selected"
                  title={
                    otPrepSameDateCheck.ok || otPrepSelectedCount === 0
                      ? undefined
                      : otPrepSameDateCheck.reason === 'mixed'
                        ? 'Selected surgeries must have the same surgery date'
                        : undefined
                  }
                >
                  <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                  Prepare OT
                  {otPrepSelectedCount > 0 ? (
                    <span className="tabular-nums" data-testid="finalize-ot-prep-selected-count">
                      ({otPrepSelectedCount})
                    </span>
                  ) : null}
                </CounsellingButton>
              </div>
            </div>
            {otPrepSelectedCount > 0 && !otPrepSameDateCheck.ok && otPrepSameDateCheck.reason === 'mixed' ? (
              <p
                className="mt-1.5 text-xs text-amber-800"
                data-testid="finalize-ot-prep-mixed-date-hint"
                role="status"
              >
                Selected surgeries must have the same surgery date.
              </p>
            ) : null}
          </div>

          <div
            className="flex min-h-0 min-w-0 flex-1 flex-col px-2.5 pb-1.5 pt-1 sm:px-3 min-[1600px]:px-5 min-[1600px]:pb-3 min-[1600px]:pt-2.5"
            data-testid="finalize-ot-preparation-panel"
          >
            <div className="mb-0.5 flex shrink-0 flex-wrap items-center justify-between gap-2 min-[1600px]:mb-1.5">
              <h2 className={counsellingSessionTokens.sessionWidgetTitle}>Finalised</h2>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-counselling-muted-foreground">
                  <span className="tabular-nums text-counselling-foreground">
                    {otPrepFiltered.length}
                  </span>{' '}
                  records
                  {catalogQuery.isFetching ? (
                    <span className="ml-2 inline-flex items-center gap-1">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-counselling-border border-t-counselling-primary" />
                      Refreshing
                    </span>
                  ) : null}
                </span>
                {otPrepLastSuccess ? (
                  <CounsellingButton
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn(denseBtn, 'h-8')}
                    onClick={() => viewOtPrepared(otPrepLastSuccess.date)}
                    data-testid="finalize-ot-view-prepared"
                  >
                    View OT Prepared
                  </CounsellingButton>
                ) : null}
              </div>
            </div>

            {otPrepPaged.length > 0 ? (
              <div className="mb-1 flex shrink-0 flex-wrap items-center gap-2">
                <CounsellingButton
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(denseBtn, 'h-8')}
                  onClick={selectAllVisibleOtPrep}
                  data-testid="finalize-ot-prep-select-all-visible"
                >
                  Select all visible
                </CounsellingButton>
                <CounsellingButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={cn(denseBtn, 'h-8')}
                  onClick={clearOtPrepSelection}
                  disabled={otPrepSelectedCount === 0}
                  data-testid="finalize-ot-prep-clear-selection"
                >
                  Clear selection
                </CounsellingButton>
              </div>
            ) : null}

            {otPrepPaged.length > 0 ? (
              <div
                className={cn(
                  OT_PREP_WORK_GRID,
                  'mb-0 shrink-0 border-b border-counselling-border/50 px-1 py-1 max-md:hidden min-[1600px]:py-2',
                )}
                aria-hidden
              >
                {OT_PREP_COLUMN_CUES.map((cue, i) => (
                  <p
                    key={cue || `sel-${i}`}
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
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]"
              data-testid="finalize-ot-prep-table-viewport"
            >
              {catalogQuery.isLoading && catalogRecords.length === 0 ? (
                <WorklistSkeleton />
              ) : otPrepFiltered.length === 0 ? (
                <div
                  className="flex flex-col items-center gap-2 px-4 py-10 text-center"
                  data-testid="finalize-ot-prep-empty"
                >
                  <p className="text-sm font-medium text-counselling-foreground">
                    No Finalised surgeries
                  </p>
                  <p className="text-xs text-counselling-muted-foreground">
                    Try adjusting the date or search filters
                  </p>
                </div>
              ) : (
                <div className="min-w-0 divide-y divide-counselling-border/40">
                  {otPrepPaged.map((rec) => (
                    <OtPrepWorkRow
                      key={rec.id}
                      rec={rec}
                      checked={otPrepSelectedIds.has(rec.id)}
                      onToggle={(next) => toggleOtPrepRow(rec.id, next)}
                      onOpen={() => openRow(rec.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {otPrepFiltered.length > 0 ? (
              <div
                data-testid="finalize-ot-prep-queue-footer"
                className="mt-1 shrink-0 border-t border-counselling-border/50 pt-1 min-[1600px]:mt-2.5 min-[1600px]:pt-2.5"
              >
                <WaitingListQueuePagination
                  page={otPrepPage}
                  pageSize={otPrepPageSize}
                  totalCount={otPrepFiltered.length}
                  onPageChange={setOtPrepPage}
                  onPageSizeChange={handleOtPrepPageSizeChange}
                  isRefreshing={catalogQuery.isFetching && catalogRecords.length > 0}
                  itemLabel="records"
                  data-testid="finalize-ot-prep-pagination"
                />
              </div>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}

