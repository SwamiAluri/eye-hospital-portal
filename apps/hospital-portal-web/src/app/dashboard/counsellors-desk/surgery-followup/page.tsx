'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  Phone,
  History,
  RotateCcw,
  RefreshCw,
  ClipboardList,
  Clock,
  AlertTriangle,
  Send,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import type { ReQueuePayload } from '@/types/counsellors-desk';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { SessionTypeSelect } from '@/components/counsellors-desk/SessionTypeSelect';
import { defaultSessionTypeCode, sessionTypeCodeToDb } from '@/lib/counsellors-desk/counsellor-master-maps';
import {
  FOLLOWUP_PAGE_SIZE,
  useActiveFollowupsQuery,
  useColdLeadsQuery,
  useFollowupStatsQuery,
  useInvalidateCounsellorsDesk,
  usePostSurgeryFollowupsQuery,
} from '@/hooks/use-counsellors-desk-queries';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives/CounsellingButton';
import { getWaitingListTotalPages } from '@/lib/counsellors-desk/waiting-list-pagination';
import { CounsellingSearchInput } from '@/components/counsellors-desk/session/primitives/CounsellingSearchInput';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { COUNSELLING_SESSIONS_READ_PERMISSION } from '@/lib/counsellors-desk/counselling-auth';
import {
  ACTIVE_FOLLOWUP_INTENTIONS,
  FOLLOWUP_TABS,
  FOLLOWUP_WORK_GRID,
  POST_DISCHARGE_AGING_KPI_LABEL,
  formatFollowupAverage,
  formatFollowupShortDate,
  formatOriginalCounsellorAttribution,
  intentionPillClass,
  INTENTION_LABEL,
  type FollowupTabId,
} from '@/lib/counsellors-desk/followup-presentation';
import {
  getSessionConcurrencyMessage,
  isSessionConcurrencyConflict,
} from '@/lib/counsellors-desk/session-concurrency';
import { getApiErrorMessage } from '@/lib/auth-interceptors';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

const PatientHistoryDrawer = dynamic(
  () => import('@/components/counsellors-desk/followup/PatientHistoryDrawer'),
  { ssr: false },
);
const ContactLogModal = dynamic(
  () => import('@/components/counsellors-desk/followup/ContactLogModal'),
  { ssr: false },
);
const SendReminderModal = dynamic(
  () => import('@/components/counsellors-desk/followup/SendReminderModal'),
  { ssr: false },
);

const denseBtn = 'min-h-8 !min-h-8 h-8 text-xs';
const PAGE_SIZE = FOLLOWUP_PAGE_SIZE;

type KpiItem = { label: string; value: string | number };

function ReQueueModal({
  sessionId,
  patientName,
  counselorId,
  onClose,
  onQueued,
}: {
  isOpen: boolean;
  sessionId: string;
  patientName: string;
  /** Current session owner; null when already unassigned (PD-S8-02/14). */
  counselorId: string | null;
  onClose: () => void;
  onQueued: () => void;
}) {
  const [reason, setReason] = useState('');
  const [sessionType, setSessionType] = useState(defaultSessionTypeCode('requeue'));
  const [saving, setSaving] = useState(false);
  const [sessionVersion, setSessionVersion] = useState<number | undefined>(undefined);
  const [versionLoading, setVersionLoading] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const loadSessionVersion = () => {
    setVersionLoading(true);
    setVersionError(null);
    counsellorsDeskApi
      .getSession(sessionId, { skipCatalogFallback: true })
      .then((s) => setSessionVersion(s.version))
      .catch((err) => {
        setSessionVersion(undefined);
        setVersionError(getApiErrorMessage(err, 'Could not load session details.'));
      })
      .finally(() => setVersionLoading(false));
  };

  useEffect(() => {
    loadSessionVersion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const canSubmit =
    reason.trim().length > 0 &&
    typeof sessionVersion === 'number' &&
    !versionLoading &&
    !saving;

  const handleSubmit = async () => {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setFormError('Reason is required.');
      return;
    }
    if (typeof sessionVersion !== 'number') {
      setFormError(
        versionError
          ? `Could not verify the session version (${versionError}). Close and reopen to retry.`
          : 'Session version is still loading. Please wait a moment and try again.',
      );
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload: ReQueuePayload = {
        version: sessionVersion,
        expectedCounselorId: counselorId,
        reason: trimmedReason,
        // Master UI code → DB CHECK value (Initial|Followup|Recheck|Urgent). Backend also normalizes.
        sessionType: sessionType ? sessionTypeCodeToDb(sessionType) : undefined,
      };
      const result = await counsellorsDeskApi.reQueueSession(sessionId, payload);
      if (typeof result.version === 'number') {
        setSessionVersion(result.version);
      }
      toast.success(`${patientName} re-queued to waiting list`);
      onQueued();
      onClose();
    } catch (err) {
      if (isSessionConcurrencyConflict(err)) {
        toast.error(getSessionConcurrencyMessage(err));
        loadSessionVersion();
        return;
      }
      toast.error(getApiErrorMessage(err, 'Failed to re-queue'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="followup-requeue-title"
      data-testid="followup-requeue-modal"
    >
      <div className={cn(counsellingSessionTokens.sessionWidget, 'w-full max-w-md overflow-hidden')}>
        <div className="border-b border-counselling-border/60 px-4 py-3">
          <h2 id="followup-requeue-title" className="text-sm font-semibold text-counselling-foreground">
            Re-queue to Waiting List
          </h2>
          <p className="mt-0.5 text-xs text-counselling-muted-foreground">{patientName}</p>
        </div>
        <div className="space-y-3 px-4 py-3">
          <div>
            <label
              htmlFor="followup-requeue-session-type"
              className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-counselling-muted-foreground"
            >
              Session type
            </label>
            <SessionTypeSelect
              id="followup-requeue-session-type"
              value={sessionType}
              onChange={setSessionType}
            />
          </div>
          <div>
            <label
              htmlFor="followup-requeue-reason"
              className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-counselling-muted-foreground"
            >
              Reason <span className="text-counselling-destructive">*</span>
            </label>
            <textarea
              id="followup-requeue-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for re-queuing…"
              rows={3}
              required
              aria-required="true"
              data-testid="followup-requeue-reason"
              className="w-full resize-none rounded-lg border border-counselling-border bg-counselling-card px-3 py-2 text-sm text-counselling-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40"
            />
          </div>
          {formError ? (
            <p className="text-xs text-counselling-destructive" role="alert">
              {formError}
            </p>
          ) : null}
          {versionError && typeof sessionVersion !== 'number' ? (
            <p className="text-xs text-counselling-destructive" role="alert">
              {versionError}
            </p>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-counselling-border/60 bg-counselling-muted/20 px-4 py-2.5">
          <CounsellingButton type="button" variant="outline" size="sm" className={denseBtn} onClick={onClose}>
            Cancel
          </CounsellingButton>
          <CounsellingButton
            type="button"
            size="sm"
            className={cn(denseBtn, 'bg-counselling-primary text-white hover:bg-counselling-primary/90')}
            disabled={!canSubmit}
            data-testid="followup-requeue-submit"
            onClick={() => void handleSubmit()}
          >
            {saving ? 'Queuing…' : 'Re-queue'}
          </CounsellingButton>
        </div>
      </div>
    </div>
  );
}

function ActionButtons({
  onCall,
  onReminder,
  onHistory,
  onReQueue,
  onReevaluate,
}: {
  /** Session-bound; omit when no authoritative SessionId (Post-Surgery honesty). */
  onCall?: () => void;
  onReminder: () => void;
  /** Session-bound; omit when no authoritative SessionId. */
  onHistory?: () => void;
  onReQueue?: () => void;
  onReevaluate?: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-end gap-0.5" data-testid="followup-row-actions">
      {onReevaluate && (
        <CounsellingButton
          type="button"
          variant="ghost"
          size="sm"
          className="!min-h-8 h-8 w-8 px-0 text-counselling-muted-foreground"
          title="Open session"
          aria-label="Open session"
          data-testid="followup-action-open-session"
          onClick={onReevaluate}
        >
          <ClipboardList className="h-3.5 w-3.5" />
        </CounsellingButton>
      )}
      <PermissionGate permission="counseling_sessions.update">
        {onCall && (
          <CounsellingButton
            type="button"
            variant="ghost"
            size="sm"
            className="!min-h-8 h-8 w-8 px-0 text-counselling-muted-foreground"
            title="Log contact"
            aria-label="Log contact"
            data-testid="followup-action-log-contact"
            onClick={onCall}
          >
            <Phone className="h-3.5 w-3.5" />
          </CounsellingButton>
        )}
        <CounsellingButton
          type="button"
          variant="ghost"
          size="sm"
          className="!min-h-8 h-8 w-8 px-0 text-counselling-muted-foreground"
          title="Send reminder"
          aria-label="Send reminder"
          data-testid="followup-action-send-reminder"
          onClick={onReminder}
        >
          <Send className="h-3.5 w-3.5" />
        </CounsellingButton>
      </PermissionGate>
      {onHistory && (
        <CounsellingButton
          type="button"
          variant="ghost"
          size="sm"
          className="!min-h-8 h-8 w-8 px-0 text-counselling-muted-foreground"
          title="View history"
          aria-label="View history"
          data-testid="followup-action-history"
          onClick={onHistory}
        >
          <History className="h-3.5 w-3.5" />
        </CounsellingButton>
      )}
      {onReQueue && (
        <PermissionGate permission="counseling_sessions.update">
          <CounsellingButton
            type="button"
            variant="ghost"
            size="sm"
            className="!min-h-8 h-8 w-8 px-0 text-counselling-muted-foreground"
            title="Re-queue to waiting list"
            aria-label="Re-queue to waiting list"
            data-testid="followup-action-requeue"
            onClick={onReQueue}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </CounsellingButton>
        </PermissionGate>
      )}
    </div>
  );
}

export default function SurgeryFollowupPage() {
  return (
    <ProtectedRoute requiredPermission={COUNSELLING_SESSIONS_READ_PERMISSION}>
      <SurgeryFollowupPageContent />
    </ProtectedRoute>
  );
}

const FOLLOWUP_SUMMARY_CARD_CLASS =
  'min-w-0 rounded-lg border border-counselling-border/70 border-l-[3px] border-l-counselling-primary bg-counselling-card px-3 py-2.5 shadow-sm';

function SurgeryFollowupPageContent() {
  const router = useRouter();
  const { user, selectedBranchId } = useAuthStore();
  const branchId = selectedBranchId ?? user?.branchId ?? undefined;
  const { invalidateFollowups, invalidateWaitingList } = useInvalidateCounsellorsDesk();

  const [activeTab, setActiveTab] = useState<FollowupTabId>('active');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const searchQ = debouncedSearch.trim();
  const [intentionFilter, setIntentionFilter] = useState('');

  const [activePage, setActivePage] = useState(1);
  const [coldPage, setColdPage] = useState(1);
  const [postPage, setPostPage] = useState(1);

  const [tabFetched, setTabFetched] = useState<Record<FollowupTabId, boolean>>({
    active: true,
    cold: false,
    'post-surgery': false,
  });

  useEffect(() => {
    setTabFetched((prev) => ({ ...prev, [activeTab]: true }));
  }, [activeTab]);

  useEffect(() => {
    setActivePage(1);
    setColdPage(1);
    setPostPage(1);
  }, [searchQ, branchId]);

  useEffect(() => {
    setActivePage(1);
  }, [intentionFilter]);

  const listFilters = {
    branchId,
    q: searchQ || undefined,
  };

  const activeQuery = useActiveFollowupsQuery({
    page: activePage,
    enabled: tabFetched.active,
    intention: intentionFilter,
    ...listFilters,
  });
  const coldQuery = useColdLeadsQuery({
    page: coldPage,
    enabled: tabFetched.cold,
    ...listFilters,
  });
  const postQuery = usePostSurgeryFollowupsQuery({
    page: postPage,
    enabled: tabFetched['post-surgery'],
    ...listFilters,
  });
  const statsQuery = useFollowupStatsQuery({
    branchId,
    q: searchQ || undefined,
    intention: intentionFilter || undefined,
  });

  const activeItems = activeQuery.data?.items ?? [];
  const activeTotal = activeQuery.data?.total ?? 0;
  const coldItems = coldQuery.data?.items ?? [];
  const coldTotal = coldQuery.data?.total ?? 0;
  const postItems = postQuery.data?.items ?? [];
  const postTotal = postQuery.data?.total ?? 0;

  const currentQuery =
    activeTab === 'active' ? activeQuery : activeTab === 'cold' ? coldQuery : postQuery;
  const showSkeleton = currentQuery.isLoading && !currentQuery.data;
  const isRefreshing = currentQuery.isFetching && !!currentQuery.data;
  const error = currentQuery.isError
    ? activeTab === 'active'
      ? 'Failed to load active follow-ups'
      : activeTab === 'cold'
        ? 'Failed to load cold leads'
        : 'Failed to load post-surgery patients'
    : null;

  const [historyDrawer, setHistoryDrawer] = useState<{
    sessionId: string;
    patientName: string;
  } | null>(null);
  const [contactModal, setContactModal] = useState<{
    sessionId: string;
    patientName: string;
    phone: string | null;
  } | null>(null);
  const [reQueueModal, setReQueueModal] = useState<{
    sessionId: string;
    patientName: string;
    counselorId: string | null;
  } | null>(null);
  const [reminderModal, setReminderModal] = useState<{
    patientId: string;
    patientName: string;
    phone: string | null;
    journeyId?: string;
  } | null>(null);

  const handleRefresh = useCallback(() => {
    void invalidateFollowups();
    void invalidateWaitingList();
  }, [invalidateFollowups, invalidateWaitingList]);

  const stats = statsQuery.data;
  const kpiLoading = statsQuery.isPending && !stats;
  const kpiItems: KpiItem[] = (() => {
    if (kpiLoading) {
      return [
        { label: '…', value: '—' },
        { label: '…', value: '—' },
        { label: '…', value: '—' },
        { label: '…', value: '—' },
      ];
    }
    if (!stats) {
      return [
        { label: 'Unavailable', value: '—' },
        { label: 'Unavailable', value: '—' },
        { label: 'Unavailable', value: '—' },
        { label: 'Unavailable', value: '—' },
      ];
    }
    if (activeTab === 'active') {
      // Phase2Y PD6: no High Priority KPI — no formal priority model.
      return [
        { label: 'Active', value: stats.active.total },
        { label: 'Never Contacted', value: stats.active.neverContacted },
        { label: 'Avg Attempts', value: formatFollowupAverage(stats.active.averageAttempts) },
      ];
    }
    if (activeTab === 'cold') {
      return [
        { label: 'Cold Leads', value: stats.cold.total },
        { label: 'Declined', value: stats.cold.declined },
        { label: 'Referred', value: stats.cold.referredElsewhere },
        { label: 'Avg Attempts', value: formatFollowupAverage(stats.cold.averageAttempts) },
      ];
    }
    return [
      { label: 'Post-Surgery', value: stats.postSurgery.total },
      // Phase2Y: factual discharge aging — not due/SLA/overdue/priority.
      { label: POST_DISCHARGE_AGING_KPI_LABEL, value: stats.postSurgery.over30Days },
      { label: 'Pending Visits', value: stats.postSurgery.pendingPostOpVisits },
      {
        label: 'Avg Days',
        value: formatFollowupAverage(stats.postSurgery.averageDaysSinceDischarge),
      },
    ];
  })();

  const currentItems =
    activeTab === 'active' ? activeItems : activeTab === 'cold' ? coldItems : postItems;
  const currentTotal =
    activeTab === 'active' ? activeTotal : activeTab === 'cold' ? coldTotal : postTotal;
  const currentPage =
    activeTab === 'active' ? activePage : activeTab === 'cold' ? coldPage : postPage;

  const handlePageChange = (p: number) => {
    if (activeTab === 'active') setActivePage(p);
    else if (activeTab === 'cold') setColdPage(p);
    else setPostPage(p);
  };

  const tabCounts: Record<FollowupTabId, number | string> = {
    active: stats?.active.total ?? (tabFetched.active ? activeTotal : '—'),
    cold: stats?.cold.total ?? (tabFetched.cold ? coldTotal : '—'),
    'post-surgery': stats?.postSurgery.total ?? (tabFetched['post-surgery'] ? postTotal : '—'),
  };

  const emptyMessage =
    searchQ
      ? 'No patients match this search'
      : activeTab === 'active'
        ? 'No active follow-ups found'
        : activeTab === 'cold'
          ? 'No cold leads found'
          : 'No post-surgery patients found';

  return (
    <div
      data-testid="followup-page"
      className={cn(
        counsellingSessionTokens.shellPage,
        'staff-page-fit h-full overflow-hidden gap-0.5 px-2.5 pb-1 pt-0',
        'min-[1600px]:gap-2.5 min-[1600px]:px-4 min-[1600px]:pb-4',
      )}
    >
      <div
        data-testid="followup-summary"
        className="grid w-full min-w-0 shrink-0 grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-2"
        aria-label="Follow-up statistics"
        aria-busy={kpiLoading || undefined}
      >
        {kpiItems.map((item, idx) => (
          <div key={`${item.label}-${idx}`} className={FOLLOWUP_SUMMARY_CARD_CLASS} data-testid="followup-kpi">
            <p className="truncate text-sm font-medium leading-5 text-counselling-muted-foreground">
              {item.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums leading-7 text-counselling-foreground">
              {item.value}
            </p>
          </div>
        ))}
        {statsQuery.isError && (
          <p className="col-span-full mt-1 text-[11px] text-red-800" role="status">
            Stats unavailable
          </p>
        )}
      </div>

      <div
        data-testid="followup-tabs"
        role="tablist"
        aria-label="Follow-up queues"
        className="w-full min-w-0 shrink-0"
      >
        <div
          className={cn(
            counsellingSessionTokens.pillTabTrack,
            'flex-nowrap gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:thin] min-[1600px]:gap-1.5',
          )}
        >
          {FOLLOWUP_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const count = tabCounts[tab.id];
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-testid={`followup-tab-${tab.id}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearch('');
                }}
                className={cn(
                  counsellingSessionTokens.pillTab,
                  'shrink-0 whitespace-nowrap',
                  isActive && counsellingSessionTokens.pillTabCurrent,
                )}
              >
                <span>{tab.label}</span>
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

      <section
        data-testid="followup-worklist"
        aria-label="Follow-up worklist"
        className={cn(
          counsellingSessionTokens.sessionWidget,
          'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
        )}
      >
        <div
          className="shrink-0 border-b border-counselling-border/50 px-2.5 py-1 sm:px-3 min-[1600px]:px-5 min-[1600px]:py-3"
          data-testid="followup-toolbar"
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <CounsellingSearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search name, MRN, phone, or procedure…"
              density="catalog"
              className="min-w-0 flex-1 min-[1600px]:max-w-md"
              data-testid="followup-search"
            />
            {activeTab === 'active' && (
              <select
                value={intentionFilter}
                onChange={(e) => setIntentionFilter(e.target.value)}
                aria-label="Filter by intention"
                data-testid="followup-intention-filter"
                className="h-8 min-w-[10rem] rounded-md border border-counselling-border bg-counselling-card px-2 text-xs font-medium text-counselling-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40"
              >
                {ACTIVE_FOLLOWUP_INTENTIONS.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
            <CounsellingButton
              type="button"
              variant="outline"
              size="sm"
              className={denseBtn}
              disabled={isRefreshing || statsQuery.isFetching}
              onClick={handleRefresh}
              data-testid="followup-refresh"
            >
              <RefreshCw
                className={cn(
                  'mr-1 h-3.5 w-3.5',
                  (isRefreshing || statsQuery.isFetching) && 'animate-spin',
                )}
              />
              Refresh
            </CounsellingButton>
          </div>
        </div>

        {error && (
          <div
            className="mx-2.5 mt-2 shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 sm:mx-3 min-[1600px]:mx-5"
            data-testid="followup-error"
            role="alert"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{error}</span>
              <CounsellingButton
                type="button"
                variant="outline"
                size="sm"
                className={denseBtn}
                onClick={handleRefresh}
              >
                Retry
              </CounsellingButton>
            </div>
          </div>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-2.5 pb-1 pt-1 sm:px-3 min-[1600px]:px-5 min-[1600px]:pb-3 min-[1600px]:pt-3">
          <div className="flex shrink-0 items-center justify-between gap-2 pb-0.5 min-[1600px]:pb-2">
            <h2 className="text-sm font-semibold text-counselling-foreground">
              {activeTab === 'active'
                ? 'Active Follow-ups'
                : activeTab === 'cold'
                  ? 'Cold Leads'
                  : 'Post-Surgery'}
            </h2>
            <span className="text-xs tabular-nums text-counselling-muted-foreground">
              {currentTotal} total
            </span>
          </div>

          <div
            className={cn(
              FOLLOWUP_WORK_GRID,
              'shrink-0 border-b border-counselling-border/40 px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground',
            )}
            role="row"
            data-testid="followup-column-cues"
          >
            <span role="columnheader">Patient</span>
            <span role="columnheader" className="hidden sm:inline">Procedure</span>
            <span role="columnheader" className="hidden sm:inline">Status</span>
            <span role="columnheader" className="hidden sm:inline">Contact</span>
            <span role="columnheader" className="justify-self-end">Action</span>
          </div>

          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            data-testid="followup-worklist-body"
          >
            {showSkeleton ? (
              <div role="status">
                <span className="sr-only">Loading</span>
                <div className="divide-y divide-counselling-border/40" aria-hidden>
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(FOLLOWUP_WORK_GRID, 'staff-worklist-row items-center px-1')}
                  >
                    <div className="h-3 max-w-[80%] animate-pulse rounded-full bg-counselling-muted" />
                    <div className="hidden h-3 max-w-[70%] animate-pulse rounded-full bg-counselling-muted sm:block" />
                    <div className="hidden h-3 w-16 animate-pulse rounded-full bg-counselling-muted sm:block" />
                    <div className="hidden h-3 max-w-[60%] animate-pulse rounded-full bg-counselling-muted sm:block" />
                    <div className="hidden h-7 w-16 justify-self-end animate-pulse rounded-md bg-counselling-muted sm:block" />
                  </div>
                ))}
                </div>
              </div>
            ) : currentItems.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-16 text-center"
                data-testid="followup-empty"
              >
                <p className="text-sm font-medium text-counselling-foreground">{emptyMessage}</p>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-counselling-muted-foreground">
                  Try adjusting search or intention filters.
                </p>
              </div>
            ) : activeTab === 'active' ? (
              activeItems.map((row) => (
                <div
                  key={row.sessionId}
                  data-testid="followup-worklist-row"
                  className={cn(
                    FOLLOWUP_WORK_GRID,
                    'staff-worklist-row border-b border-counselling-border/40 px-1 hover:bg-counselling-muted/30',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-counselling-foreground">
                      {row.patientName}
                    </p>
                    <p className="truncate text-xs tabular-nums text-counselling-muted-foreground">
                      {row.uhid ? `#${row.uhid}` : '—'}
                      {row.phone ? ` · ${row.phone}` : ''}
                      {formatOriginalCounsellorAttribution({
                        counselorId: row.counselorId,
                        counselorName: row.counselorName,
                      })}
                    </p>
                  </div>
                  <div className="hidden min-w-0 sm:block">
                    <p className="truncate text-xs text-counselling-foreground">
                      {row.recommendedSurgery ?? '—'}
                    </p>
                  </div>
                  <div className="hidden min-w-0 flex-wrap gap-1 sm:flex">
                    {row.patientIntention && (
                      <span
                        className={cn(
                          counsellingSessionTokens.statusPill,
                          intentionPillClass(row.patientIntention),
                        )}
                      >
                        {INTENTION_LABEL[row.patientIntention] ?? row.patientIntention}
                      </span>
                    )}
                  </div>
                  <div className="hidden min-w-0 text-xs text-counselling-muted-foreground sm:block">
                    {row.lastContactDate ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden />
                        {formatFollowupShortDate(row.lastContactDate)} · {row.contactAttemptCount}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-800">
                        <AlertTriangle className="h-3 w-3" aria-hidden />
                        Never contacted
                      </span>
                    )}
                  </div>
                  <ActionButtons
                    onCall={() =>
                      setContactModal({
                        sessionId: row.sessionId,
                        patientName: row.patientName,
                        phone: row.phone,
                      })
                    }
                    onReminder={() =>
                      setReminderModal({
                        patientId: row.patientId,
                        patientName: row.patientName,
                        phone: row.phone,
                      })
                    }
                    onHistory={() =>
                      setHistoryDrawer({
                        sessionId: row.sessionId,
                        patientName: row.patientName,
                      })
                    }
                    onReQueue={() =>
                      setReQueueModal({
                        sessionId: row.sessionId,
                        patientName: row.patientName,
                        counselorId: row.counselorId ?? null,
                      })
                    }
                    onReevaluate={() =>
                      router.push(`/dashboard/counsellors-desk/${row.sessionId}?from=follow-up`)
                    }
                  />
                </div>
              ))
            ) : activeTab === 'cold' ? (
              coldItems.map((row) => (
                <div
                  key={row.sessionId}
                  data-testid="followup-worklist-row"
                  className={cn(
                    FOLLOWUP_WORK_GRID,
                    'staff-worklist-row border-b border-counselling-border/40 border-l-4 border-l-red-400 px-1 hover:bg-counselling-muted/30',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-counselling-foreground">
                      {row.patientName}
                    </p>
                    <p className="truncate text-xs tabular-nums text-counselling-muted-foreground">
                      {row.uhid ? `#${row.uhid}` : '—'}
                      {row.phone ? ` · ${row.phone}` : ''}
                      {formatOriginalCounsellorAttribution({
                        counselorId: row.counselorId,
                        counselorName: row.counselorName,
                      })}
                    </p>
                  </div>
                  <div className="hidden min-w-0 sm:block">
                    <p className="truncate text-xs text-counselling-foreground">
                      {row.recommendedSurgery ?? '—'}
                    </p>
                  </div>
                  <div className="hidden min-w-0 sm:block">
                    {row.patientIntention && (
                      <span
                        className={cn(
                          counsellingSessionTokens.statusPill,
                          intentionPillClass(row.patientIntention),
                        )}
                      >
                        {INTENTION_LABEL[row.patientIntention] ?? row.patientIntention}
                      </span>
                    )}
                  </div>
                  <div className="hidden min-w-0 text-xs text-counselling-muted-foreground sm:block">
                    Session {formatFollowupShortDate(row.sessionDate)}
                    {row.lastContactDate
                      ? ` · Last ${formatFollowupShortDate(row.lastContactDate)}`
                      : ''}
                  </div>
                  <ActionButtons
                    onCall={() =>
                      setContactModal({
                        sessionId: row.sessionId,
                        patientName: row.patientName,
                        phone: row.phone,
                      })
                    }
                    onReminder={() =>
                      setReminderModal({
                        patientId: row.patientId,
                        patientName: row.patientName,
                        phone: row.phone,
                      })
                    }
                    onHistory={() =>
                      setHistoryDrawer({
                        sessionId: row.sessionId,
                        patientName: row.patientName,
                      })
                    }
                    onReQueue={() =>
                      setReQueueModal({
                        sessionId: row.sessionId,
                        patientName: row.patientName,
                        counselorId: row.counselorId ?? null,
                      })
                    }
                    onReevaluate={() =>
                      router.push(`/dashboard/counsellors-desk/${row.sessionId}?from=follow-up`)
                    }
                  />
                </div>
              ))
            ) : (
              postItems.map((row) => {
                const daysSince = row.daysSinceDischarge;
                return (
                  <div
                    key={row.journeyId}
                    data-testid="followup-worklist-row"
                    className={cn(
                      FOLLOWUP_WORK_GRID,
                      'staff-worklist-row border-b border-counselling-border/40 px-1 hover:bg-counselling-muted/30',
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-counselling-foreground">
                        {row.patientName}
                      </p>
                      <p className="truncate text-xs tabular-nums text-counselling-muted-foreground">
                        {row.uhid ? `#${row.uhid}` : '—'}
                        {row.phone ? ` · ${row.phone}` : ''}
                      </p>
                    </div>
                    <div className="hidden min-w-0 sm:block">
                      <p className="truncate text-xs text-counselling-foreground">
                        {row.surgeryType ?? '—'}
                      </p>
                    </div>
                    <div className="hidden min-w-0 flex-wrap gap-1 sm:flex">
                      {daysSince != null && (
                        <span
                          className={cn(
                            counsellingSessionTokens.statusPill,
                            'bg-counselling-muted/70 text-counselling-foreground',
                          )}
                        >
                          {daysSince}d since discharge
                        </span>
                      )}
                      {row.conditionAtDischarge && (
                        <span
                          className={cn(
                            counsellingSessionTokens.statusPill,
                            row.conditionAtDischarge === 'Good'
                              ? counsellingSessionTokens.statusPillComplete
                              : row.conditionAtDischarge === 'Critical'
                                ? counsellingSessionTokens.statusPillDanger
                                : counsellingSessionTokens.statusPillRequired,
                          )}
                        >
                          {row.conditionAtDischarge}
                        </span>
                      )}
                    </div>
                    <div className="hidden min-w-0 text-xs text-counselling-muted-foreground sm:block">
                      {row.dischargeDate
                        ? `Discharged ${formatFollowupShortDate(row.dischargeDate)}`
                        : '—'}
                      {(row.pendingPostOpVisits ?? 0) > 0
                        ? ` · ${row.pendingPostOpVisits} visit(s) pending`
                        : ''}
                    </div>
                    <ActionButtons
                      onCall={
                        row.sessionId
                          ? () =>
                              setContactModal({
                                sessionId: row.sessionId!,
                                patientName: row.patientName,
                                phone: row.phone,
                              })
                          : undefined
                      }
                      onReminder={() =>
                        setReminderModal({
                          patientId: row.patientId,
                          patientName: row.patientName,
                          phone: row.phone,
                          journeyId: row.journeyId,
                        })
                      }
                      onHistory={
                        row.sessionId
                          ? () =>
                              setHistoryDrawer({
                                sessionId: row.sessionId!,
                                patientName: row.patientName,
                              })
                          : undefined
                      }
                      onReevaluate={
                        row.sessionId
                          ? () => router.push(`/dashboard/counsellors-desk/${row.sessionId}?from=follow-up`)
                          : undefined
                      }
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {!showSkeleton && currentTotal > 0 && (
          <div
            data-testid="followup-pagination"
            className="flex shrink-0 flex-col gap-1 border-t border-counselling-border/50 px-2.5 py-1.5 text-xs text-counselling-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-3 min-[1600px]:px-5"
          >
            <p>
              Showing{' '}
              <span className="font-medium tabular-nums text-counselling-foreground">
                {Math.min((currentPage - 1) * PAGE_SIZE + 1, currentTotal)}
              </span>
              –
              <span className="font-medium tabular-nums text-counselling-foreground">
                {Math.min(currentPage * PAGE_SIZE, currentTotal)}
              </span>
              {' of '}
              <span className="font-medium tabular-nums text-counselling-foreground">{currentTotal}</span>
              {' patients'}
              {isRefreshing ? (
                <span className="ml-2 inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-counselling-border border-t-counselling-primary" />
                  Refreshing
                </span>
              ) : null}
            </p>
            {currentTotal > PAGE_SIZE && (
              <div className="flex items-center gap-0.5">
                <CounsellingButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={denseBtn}
                  disabled={currentPage <= 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  aria-label="Previous page"
                >
                  Prev
                </CounsellingButton>
                <span className="px-2 tabular-nums text-counselling-foreground">
                  {currentPage} / {getWaitingListTotalPages(currentTotal, PAGE_SIZE)}
                </span>
                <CounsellingButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={denseBtn}
                  disabled={currentPage * PAGE_SIZE >= currentTotal}
                  onClick={() => handlePageChange(currentPage + 1)}
                  aria-label="Next page"
                >
                  Next
                </CounsellingButton>
              </div>
            )}
          </div>
        )}
      </section>

      <PatientHistoryDrawer
        isOpen={!!historyDrawer}
        onClose={() => setHistoryDrawer(null)}
        sessionId={historyDrawer?.sessionId ?? null}
        patientName={historyDrawer?.patientName ?? ''}
      />
      {contactModal && (
        <ContactLogModal
          isOpen={!!contactModal}
          onClose={() => setContactModal(null)}
          sessionId={contactModal.sessionId}
          patientName={contactModal.patientName}
          phone={contactModal.phone}
          onLogged={handleRefresh}
        />
      )}
      {reQueueModal && (
        <ReQueueModal
          isOpen={!!reQueueModal}
          sessionId={reQueueModal.sessionId}
          patientName={reQueueModal.patientName}
          counselorId={reQueueModal.counselorId}
          onClose={() => setReQueueModal(null)}
          onQueued={handleRefresh}
        />
      )}
      {reminderModal && (
        <SendReminderModal
          isOpen={!!reminderModal}
          onClose={() => setReminderModal(null)}
          patientId={reminderModal.patientId}
          patientName={reminderModal.patientName}
          phone={reminderModal.phone}
          journeyId={reminderModal.journeyId}
          onSent={handleRefresh}
        />
      )}
    </div>
  );
}
