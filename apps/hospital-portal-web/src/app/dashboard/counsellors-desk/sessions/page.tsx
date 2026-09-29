'use client';

import { useMemo, useCallback, useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives/CounsellingButton';
import { CounsellingCheckbox } from '@/components/counsellors-desk/session/primitives/CounsellingCheckbox';
import { CounsellingDatePicker } from '@/components/counsellors-desk/session/primitives/CounsellingDatePicker';
import { CounsellingInput } from '@/components/counsellors-desk/session/primitives/CounsellingInput';
import { CounsellingLabel } from '@/components/counsellors-desk/session/primitives/CounsellingLabel';
import { CounsellingSearchInput } from '@/components/counsellors-desk/session/primitives/CounsellingSearchInput';
import {
  CounsellingSheet,
  CounsellingSheetContent,
  CounsellingSheetHeader,
  CounsellingSheetTitle,
  CounsellingSheetDescription,
} from '@/components/counsellors-desk/session/primitives';
import { WaitingListReassignDialog } from '@/components/counsellors-desk/waiting-list/WaitingListReassignDialog';
import { useCounselingSessions } from '@/hooks/use-counseling-sessions';
import { useHasPermission } from '@/hooks/use-permissions';
import { branchContextKeys } from '@/hooks/use-branch-context';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import { userBranchesApi } from '@/lib/api/user-branches.api';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { buildSessionsOpenHref } from '@/lib/counsellors-desk/counselling-session-origin';
import { counselorOptionLabel } from '@/lib/counsellors-desk/ownership-display-name';
import {
  COUNSELLING_SESSIONS_READ_PERMISSION,
  COUNSELLING_SESSIONS_REASSIGN_PERMISSION,
  canShowCounsellingReassign,
} from '@/lib/counsellors-desk/counselling-auth';
import { canShowSessionsRrReassign } from '@/lib/counsellors-desk/sessions-rr-reassign';
import type { SessionFilters } from '@/lib/api/counseling-sessions.api';
import {
  parseReassignmentRequiredParam,
} from '@/lib/counsellors-desk/reassignment-required-filter';
import {
  SESSIONS_PAGE_SIZE,
  clampSessionsPage,
  parseSessionsPageParam,
  setSessionsPageInSearchParams,
} from '@/lib/counsellors-desk/sessions-pagination';
import {
  getWaitingListPageRange,
  getWaitingListTotalPages,
  getWaitingListVisiblePages,
} from '@/lib/counsellors-desk/waiting-list-pagination';
import {
  SessionsEyeLine,
  SessionsMrnLine,
  formatSessionListStatus,
  nonEmptyListText,
  sessionsHeaderClassName,
  sessionsOwnerLabel,
} from '@/lib/counsellors-desk/sessions-list-presentation';
import {
  applySessionsRegisterDraft,
  buildSessionsFilterChips,
  clearSessionsDrilldownFilters,
  hasSessionsOrdinaryFilters,
  readSessionsRegisterDraft,
  removeSessionsFilterChip,
  resolveSessionsEmptyCopy,
  SESSIONS_STATUS_VALUES,
  shouldShowAnalyticsContext,
  type SessionsRegisterDraft,
} from '@/lib/counsellors-desk/sessions-register-filters';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

type SessionsListRow = {
  id?: string;
  Id?: string;
  patientName?: string;
  PatientName?: string;
  sessionNumber?: string;
  SessionNumber?: string;
  sessionDate?: string;
  SessionDate?: string;
  recommendedSurgery?: string;
  RecommendedSurgery?: string;
  pendingDecision?: boolean;
  PendingDecision?: boolean;
  patientAgreedToSurgery?: boolean;
  PatientAgreedToSurgery?: boolean;
  patientMrn?: string | null;
  PatientMrn?: string | null;
  surgeryTentativeEye?: string | null;
  SurgeryTentativeEye?: string | null;
  counselorId?: string | null;
  CounselorId?: string | null;
  counselorName?: string | null;
  CounselorName?: string | null;
  CounseledByUserName?: string | null;
  branchId?: string | null;
  BranchId?: string | null;
  status?: string | null;
  Status?: string | null;
  version?: number;
  Version?: number;
};

type DecisionKind = 'Pending' | 'Agreed' | 'Declined' | '—';

function parseBoolParam(value: string | null): boolean | undefined {
  if (value == null || value === '') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function resolveStatus(session: SessionsListRow): string | null {
  return nonEmptyListText(session.status ?? session.Status);
}

function resolveSessionId(session: SessionsListRow): string {
  return session.id ?? session.Id ?? '';
}

function resolveCounselorId(session: SessionsListRow): string | null {
  const raw = session.counselorId ?? session.CounselorId;
  if (raw == null || raw === '') return null;
  return String(raw);
}

function resolveCounselorName(session: SessionsListRow): string | null {
  return (
    session.counselorName ??
    session.CounselorName ??
    session.CounseledByUserName ??
    null
  );
}

function resolveBranchId(session: SessionsListRow): string | null {
  const raw = session.branchId ?? session.BranchId;
  if (raw == null || raw === '') return null;
  return String(raw);
}

function resolveVersion(session: SessionsListRow): number | undefined {
  const raw = session.version ?? session.Version;
  return typeof raw === 'number' ? raw : undefined;
}

function resolvePatientMrn(session: SessionsListRow): string | null {
  return nonEmptyListText(session.patientMrn ?? session.PatientMrn);
}

function resolveSurgeryEye(session: SessionsListRow): string | null {
  return nonEmptyListText(session.surgeryTentativeEye ?? session.SurgeryTentativeEye);
}

function resolveDecision(session: SessionsListRow): DecisionKind {
  const pending = session.pendingDecision ?? session.PendingDecision;
  const agreed = session.patientAgreedToSurgery ?? session.PatientAgreedToSurgery;
  if (pending === true) return 'Pending';
  if (agreed === true) return 'Agreed';
  if (agreed === false) return 'Declined';
  return '—';
}

function decisionPillClass(decision: DecisionKind): string {
  switch (decision) {
    case 'Pending':
      return counsellingSessionTokens.statusPillRequired;
    case 'Agreed':
      return counsellingSessionTokens.statusPillComplete;
    case 'Declined':
      return counsellingSessionTokens.statusPillDanger;
    default:
      return 'bg-counselling-muted text-counselling-muted-foreground';
  }
}

export default function CounsellingSessionsListPage() {
  return (
    <ProtectedRoute requiredPermission={COUNSELLING_SESSIONS_READ_PERMISSION}>
      <PermissionGate permission={COUNSELLING_SESSIONS_READ_PERMISSION}>
        <SessionsListContent />
      </PermissionGate>
    </ProtectedRoute>
  );
}

function SessionsListContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasReassignPermission = useHasPermission(COUNSELLING_SESSIONS_REASSIGN_PERMISSION);
  const canReassign = canShowCounsellingReassign({ hasReassignPermission });

  const [reassignSession, setReassignSession] = useState<SessionsListRow | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<SessionsRegisterDraft>(() =>
    readSessionsRegisterDraft(searchParams.toString()),
  );
  const [searchText, setSearchText] = useState(searchParams.get('search') ?? '');

  const branchId = searchParams.get('branchId') ?? undefined;
  const counselorId = searchParams.get('counselorId') ?? undefined;
  const sessionDateFrom = searchParams.get('sessionDateFrom') ?? undefined;
  const sessionDateTo = searchParams.get('sessionDateTo') ?? undefined;
  const pendingDecision = parseBoolParam(searchParams.get('pendingDecision'));
  const patientAgreedToSurgery = parseBoolParam(searchParams.get('patientAgreedToSurgery'));
  const recommendedSurgery = searchParams.get('recommendedSurgery') ?? undefined;
  const status = searchParams.get('status') ?? undefined;
  const search = searchParams.get('search') ?? undefined;
  const analyticsOutcome = searchParams.get('analyticsOutcome') ?? undefined;
  const reassignmentRequired = parseReassignmentRequiredParam(
    searchParams.get('reassignmentRequired'),
  );
  const page = parseSessionsPageParam(searchParams.get('page'));

  const filters = useMemo(
    (): SessionFilters => ({
      branchId,
      counselorId,
      sessionDateFrom,
      sessionDateTo,
      pendingDecision,
      patientAgreedToSurgery,
      recommendedSurgery,
      status,
      search,
      reassignmentRequired: reassignmentRequired || undefined,
      page,
      pageSize: SESSIONS_PAGE_SIZE,
    }),
    [
      branchId,
      counselorId,
      sessionDateFrom,
      sessionDateTo,
      pendingDecision,
      patientAgreedToSurgery,
      recommendedSurgery,
      status,
      search,
      reassignmentRequired,
      page,
    ],
  );

  const { data, isPending, isError, refetch } = useCounselingSessions(filters);
  const sessions =
    (data?.sessions ?? data?.data ?? data?.Sessions ?? []) as SessionsListRow[];
  const totalCount = data?.totalCount ?? data?.TotalCount ?? sessions.length;
  const totalPagesFromApi = data?.totalPages ?? data?.TotalPages;
  const totalPages =
    typeof totalPagesFromApi === 'number' && totalPagesFromApi > 0
      ? totalPagesFromApi
      : getWaitingListTotalPages(totalCount, SESSIONS_PAGE_SIZE);
  const { start: rangeStart, end: rangeEnd } = getWaitingListPageRange(
    page,
    SESSIONS_PAGE_SIZE,
    totalCount,
  );
  const visiblePages = getWaitingListVisiblePages(page, totalPages);

  const replaceSearchParams = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router],
  );

  const setPage = useCallback(
    (nextPage: number) => {
      replaceSearchParams(
        setSessionsPageInSearchParams(
          new URLSearchParams(searchParams.toString()),
          nextPage,
        ),
      );
    },
    [replaceSearchParams, searchParams],
  );

  const openFilters = useCallback(() => {
    setDraft(readSessionsRegisterDraft(searchParams.toString()));
    setFiltersOpen(true);
  }, [searchParams]);

  const applyFilters = useCallback(() => {
    replaceSearchParams(
      applySessionsRegisterDraft(new URLSearchParams(searchParams.toString()), draft),
    );
    setFiltersOpen(false);
  }, [draft, replaceSearchParams, searchParams]);

  const commitSearch = useCallback(
    (value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      const trimmed = value.trim();
      if (trimmed) next.set('search', trimmed);
      else next.delete('search');
      replaceSearchParams(setSessionsPageInSearchParams(next, 1));
    },
    [replaceSearchParams, searchParams],
  );

  const removeFilterChip = useCallback(
    (removeKeys: readonly string[]) => {
      replaceSearchParams(
        removeSessionsFilterChip(new URLSearchParams(searchParams.toString()), removeKeys),
      );
    },
    [replaceSearchParams, searchParams],
  );

  const clearDrilldownFilters = useCallback(() => {
    replaceSearchParams(
      clearSessionsDrilldownFilters(new URLSearchParams(searchParams.toString())),
    );
  }, [replaceSearchParams, searchParams]);

  // After Reassign/refetch, clamp URL page when TotalPages shrinks.
  useEffect(() => {
    if (isPending || isError) return;
    if (totalCount <= 0) {
      if (page > 1) setPage(1);
      return;
    }
    const clamped = clampSessionsPage(page, totalPages);
    if (clamped !== page) setPage(clamped);
  }, [isPending, isError, totalCount, totalPages, page, setPage]);

  useEffect(() => {
    setSearchText(search ?? '');
  }, [search]);

  const counselorQuery = useQuery({
    queryKey: ['counseling', 'counselors', 'sessions-register-labels'],
    queryFn: () => counsellorsDeskApi.getCounselors(),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: Boolean(counselorId) || filtersOpen,
  });
  const branchesQuery = useQuery({
    queryKey: branchContextKeys.myBranches,
    queryFn: () => userBranchesApi.getMyBranches(),
    staleTime: 5 * 60_000,
    enabled: Boolean(branchId) || filtersOpen,
  });
  const counselorLabel = useMemo(() => {
    if (!counselorId) return null;
    const match = counselorQuery.data?.find((counselor) => counselor.id === counselorId);
    if (!match) return null;
    const label = counselorOptionLabel(match);
    if (!label || label === counselorId) return null;
    return label;
  }, [counselorId, counselorQuery.data]);
  const branchLabel = useMemo(() => {
    if (!branchId) return null;
    return (
      branchesQuery.data?.branches?.find((branch) => branch.branchId === branchId)?.branchName?.trim() ||
      null
    );
  }, [branchId, branchesQuery.data]);

  /** Active register filters, including Reassignment Required. */
  const filterChips = useMemo(
    () =>
      buildSessionsFilterChips({
        search: searchParams.toString(),
        counselorLabel,
        branchLabel,
      }),
    [searchParams, counselorLabel, branchLabel],
  );
  const ordinaryFilters = hasSessionsOrdinaryFilters(searchParams.toString());
  const showAnalyticsContext = shouldShowAnalyticsContext(analyticsOutcome);
  const emptyCopy = resolveSessionsEmptyCopy({
    reassignmentRequired,
    hasDrilldownFilters: ordinaryFilters,
  });
  const showClear = filterChips.length > 0 || ordinaryFilters;
  const counselors = counselorQuery.data ?? [];
  const branches = branchesQuery.data?.branches ?? [];
  const filterField = cn(
    'h-9 w-full rounded-md border border-counselling-border bg-counselling-background',
    'px-2 text-sm text-counselling-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40',
  );

  const handleReassignRefresh = useCallback(() => {
    setReassignSession(null);
    void refetch();
  }, [refetch]);

  return (
    <div
      className={cn(
        counsellingSessionTokens.shellPage,
        'staff-page-fit h-full overflow-hidden gap-0.5 px-2.5 pb-1 pt-0',
        'min-[1600px]:gap-2.5 min-[1600px]:px-4 min-[1600px]:pb-4',
      )}
      data-testid="counselling-sessions-list-page"
    >
      <div className="flex flex-wrap items-center gap-2 px-0.5">
        <CounsellingButton
          type="button"
          variant="outline"
          size="sm"
          className="!min-h-8 h-8 text-xs"
          data-testid="sessions-filters-open"
          onClick={openFilters}
        >
          Filters
        </CounsellingButton>
        <form
          className="min-w-[12rem] flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            commitSearch(searchText);
          }}
        >
          <CounsellingSearchInput
            value={searchText}
            onChange={(value) => {
              setSearchText(value);
              if (value.trim() === '' && (search ?? '') !== '') commitSearch('');
            }}
            placeholder="Search session number"
            data-testid="sessions-search"
          />
        </form>
      </div>

      {showAnalyticsContext ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-0.5"
          data-testid="sessions-analytics-context"
        >
          <p className="text-xs font-medium text-counselling-foreground">Filtered from Analytics</p>
          <a
            href="/dashboard/counselor/analytics"
            className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-counselling-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40"
            data-testid="sessions-analytics-back"
          >
            Back to Analytics
          </a>
        </div>
      ) : null}

      {filterChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 px-0.5" data-testid="sessions-filter-chips">
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={cn(
                counsellingSessionTokens.statusPill,
                'bg-counselling-muted text-counselling-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40',
              )}
              aria-label={chip.removeAriaLabel}
              data-testid={`sessions-filter-chip-${chip.id}`}
              onClick={() => removeFilterChip(chip.removeKeys)}
            >
              {chip.label}
              <span aria-hidden="true" className="ml-1">
                ×
              </span>
            </button>
          ))}
          {showClear ? (
            <CounsellingButton
              type="button"
              variant="outline"
              size="sm"
              className="!min-h-8 h-8 text-xs"
              data-testid="sessions-list-clear"
              onClick={clearDrilldownFilters}
            >
              Clear
            </CounsellingButton>
          ) : null}
        </div>
      ) : null}

      <CounsellingSheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CounsellingSheetContent
          className="counsellor-scrollbar flex w-full flex-col gap-4 sm:max-w-md"
          data-testid="sessions-filter-sheet"
        >
          <CounsellingSheetHeader>
            <CounsellingSheetTitle>Filters</CounsellingSheetTitle>
            <CounsellingSheetDescription className="sr-only">
              Filter the counselling sessions register. These choices do not change ownership.
            </CounsellingSheetDescription>
          </CounsellingSheetHeader>

          <div className="grid gap-3">
            <label className="grid gap-1 text-xs font-medium text-counselling-foreground" htmlFor="sessions-filter-owner">
              Owner
              <select
                id="sessions-filter-owner"
                className={filterField}
                value={draft.counselorId}
                data-testid="sessions-filter-owner"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, counselorId: event.target.value }))
                }
              >
                <option value="">Any owner</option>
                {draft.counselorId && !counselors.some((counselor) => counselor.id === draft.counselorId) ? (
                  <option value={draft.counselorId}>Counselor filtered</option>
                ) : null}
                {counselors.map((counselor) => {
                  const label = counselorOptionLabel(counselor);
                  const text = !label || label === counselor.id ? 'Counselor filtered' : label;
                  return (
                    <option key={counselor.id} value={counselor.id}>
                      {text}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="grid gap-1 text-xs font-medium text-counselling-foreground" htmlFor="sessions-filter-status">
              Status
              <select
                id="sessions-filter-status"
                className={filterField}
                value={draft.status}
                data-testid="sessions-filter-status"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    status: event.target.value as SessionsRegisterDraft['status'],
                  }))
                }
              >
                <option value="">Any status</option>
                {SESSIONS_STATUS_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {formatSessionListStatus(value) ?? value}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-xs font-medium text-counselling-foreground" htmlFor="sessions-filter-decision">
              Decision
              <select
                id="sessions-filter-decision"
                className={filterField}
                value={draft.decision}
                data-testid="sessions-filter-decision"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    decision: event.target.value as SessionsRegisterDraft['decision'],
                  }))
                }
              >
                <option value="">Any decision</option>
                <option value="Pending">Pending</option>
                <option value="Agreed">Agreed</option>
                <option value="Declined">Declined</option>
              </select>
            </label>

            <div className="grid gap-1">
              <CounsellingLabel htmlFor="sessions-filter-date-from">Session date from</CounsellingLabel>
              <CounsellingDatePicker
                id="sessions-filter-date-from"
                variant="scheduling"
                value={draft.sessionDateFrom}
                placeholder="From"
                data-testid="sessions-filter-date-from"
                onChange={(isoDate) =>
                  setDraft((current) => ({ ...current, sessionDateFrom: isoDate }))
                }
              />
            </div>
            <div className="grid gap-1">
              <CounsellingLabel htmlFor="sessions-filter-date-to">Session date to</CounsellingLabel>
              <CounsellingDatePicker
                id="sessions-filter-date-to"
                variant="scheduling"
                value={draft.sessionDateTo}
                placeholder="To"
                data-testid="sessions-filter-date-to"
                onChange={(isoDate) =>
                  setDraft((current) => ({ ...current, sessionDateTo: isoDate }))
                }
              />
            </div>

            <label className="grid gap-1 text-xs font-medium text-counselling-foreground" htmlFor="sessions-filter-surgery">
              Surgery
              <CounsellingInput
                id="sessions-filter-surgery"
                value={draft.recommendedSurgery}
                placeholder="Exact surgery name"
                data-testid="sessions-filter-surgery"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, recommendedSurgery: event.target.value }))
                }
              />
            </label>

            <label className="grid gap-1 text-xs font-medium text-counselling-foreground" htmlFor="sessions-filter-branch">
              Branch
              <select
                id="sessions-filter-branch"
                className={filterField}
                value={draft.branchId}
                data-testid="sessions-filter-branch"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, branchId: event.target.value }))
                }
              >
                <option value="">Any authorized branch</option>
                {draft.branchId && !branches.some((branch) => branch.branchId === draft.branchId) ? (
                  <option value={draft.branchId}>Branch filtered</option>
                ) : null}
                {branches.map((branch) => (
                  <option key={branch.branchId} value={branch.branchId}>
                    {branch.branchName?.trim() || 'Branch filtered'}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center gap-2">
              <CounsellingCheckbox
                id="sessions-filter-rr"
                checked={draft.reassignmentRequired}
                data-testid="sessions-filter-rr"
                onCheckedChange={(checked) =>
                  setDraft((current) => ({ ...current, reassignmentRequired: checked === true }))
                }
              />
              <CounsellingLabel htmlFor="sessions-filter-rr">Reassignment required</CounsellingLabel>
            </div>
          </div>

          <div className="mt-auto flex justify-end gap-2">
            <CounsellingButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen(false)}
            >
              Cancel
            </CounsellingButton>
            <CounsellingButton
              type="button"
              size="sm"
              data-testid="sessions-filters-apply"
              onClick={applyFilters}
            >
              Apply
            </CounsellingButton>
          </div>
        </CounsellingSheetContent>
      </CounsellingSheet>

      <section
        className={cn(
          counsellingSessionTokens.sessionWidget,
          'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
        )}
        aria-label="Counselling sessions worklist"
      >
        {isPending && (
          <div
            className="flex flex-1 flex-col items-center justify-center gap-1 px-4 py-12 text-center"
            data-testid="sessions-list-loading"
            role="status"
          >
            <p className="inline-flex items-center gap-2 text-sm font-medium text-counselling-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading sessions…
            </p>
            <p className="max-w-sm text-xs leading-relaxed text-counselling-muted-foreground">
              The list will appear when this request finishes.
            </p>
          </div>
        )}

        {isError && !isPending && (
          <div
            className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-12 text-center"
            role="alert"
            data-testid="sessions-list-error"
          >
            <p className="text-sm font-medium text-red-800">Failed to load sessions</p>
            <p className="max-w-sm text-xs leading-relaxed text-counselling-muted-foreground">
              Retry to load the counselling sessions list.
            </p>
            <CounsellingButton
              type="button"
              variant="outline"
              size="sm"
              className="!min-h-8 h-8 text-xs"
              onClick={() => void refetch()}
            >
              Retry
            </CounsellingButton>
          </div>
        )}

        {!isPending && !isError && sessions.length === 0 && (
          <div
            className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center"
            data-testid="sessions-list-empty"
            role="status"
          >
            <p className="text-sm font-medium text-counselling-foreground">{emptyCopy.title}</p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-counselling-muted-foreground">
              {emptyCopy.hint}
            </p>
          </div>
        )}

        {!isPending && !isError && sessions.length > 0 && (
          <>
            <div className="min-h-0 flex-1 overflow-auto">
              <table
                className="w-full table-fixed text-xs"
                aria-label="Counselling sessions"
              >
                <colgroup>
                  <col className="w-[22%]" />
                  <col className="w-[14%]" />
                  <col className="w-[13%]" />
                  <col className="w-[16%]" />
                  <col className="w-[11%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-counselling-card">
                  <tr className="border-b border-counselling-border/60">
                    <th scope="col" className={sessionsHeaderClassName('left')}>
                      Patient
                    </th>
                    <th scope="col" className={sessionsHeaderClassName('left')}>
                      Owner
                    </th>
                    <th scope="col" className={sessionsHeaderClassName('left')}>
                      Session date
                    </th>
                    <th scope="col" className={cn(sessionsHeaderClassName('left'), 'hidden sm:table-cell')}>
                      Surgery
                    </th>
                    <th scope="col" className={sessionsHeaderClassName('left')}>
                      Decision
                    </th>
                    <th scope="col" className={sessionsHeaderClassName('left')}>
                      Status
                    </th>
                    <th scope="col" className={sessionsHeaderClassName('right')}>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-counselling-border/40">
                  {sessions.map((session) => {
                    const id = resolveSessionId(session);
                    const patient =
                      session.patientName ??
                      session.PatientName ??
                      session.sessionNumber ??
                      session.SessionNumber ??
                      '—';
                    const dateRaw = session.sessionDate ?? session.SessionDate;
                    const dateLabel = dateRaw
                      ? new Date(dateRaw).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : '—';
                    const surgery =
                      session.recommendedSurgery ?? session.RecommendedSurgery ?? '—';
                    const eye = resolveSurgeryEye(session);
                    const decision = resolveDecision(session);
                    const ownerId = resolveCounselorId(session);
                    const ownerLabel = sessionsOwnerLabel(ownerId, resolveCounselorName(session));
                    const statusLabel = formatSessionListStatus(resolveStatus(session));
                    const showReassign = canShowSessionsRrReassign({
                      reassignmentRequiredFilter: reassignmentRequired,
                      hasReassignPermission: canReassign,
                      counselorId: ownerId,
                    });

                    return (
                      <tr
                        key={id}
                        className="staff-worklist-row hover:bg-counselling-muted/30"
                      >
                        <td className="px-2.5 py-2 align-middle sm:px-3">
                          <div className="truncate text-sm font-semibold text-counselling-foreground">
                            {patient}
                          </div>
                          <SessionsMrnLine mrn={resolvePatientMrn(session)} />
                          <div className="mt-0.5 truncate text-[11px] text-counselling-muted-foreground sm:hidden">
                            {surgery}
                            <SessionsEyeLine eye={eye} />
                          </div>
                        </td>
                        <td className="px-2.5 py-2 align-middle sm:px-3">
                          <div
                            className="truncate text-counselling-foreground"
                            data-testid="sessions-row-owner"
                          >
                            {ownerLabel}
                          </div>
                        </td>
                        <td className="px-2.5 py-2 align-middle tabular-nums text-counselling-muted-foreground sm:px-3">
                          {dateLabel}
                        </td>
                        <td className="hidden px-2.5 py-2 align-middle text-counselling-muted-foreground sm:table-cell sm:px-3">
                          <div className="truncate">{surgery}</div>
                          <SessionsEyeLine eye={eye} />
                        </td>
                        <td className="px-2.5 py-2 align-middle sm:px-3">
                          {decision === '—' ? (
                            <span className="text-counselling-muted-foreground">—</span>
                          ) : (
                            <span
                              className={cn(
                                counsellingSessionTokens.statusPill,
                                decisionPillClass(decision),
                              )}
                            >
                              {decision}
                            </span>
                          )}
                        </td>
                        <td className="px-2.5 py-2 align-middle sm:px-3">
                          {statusLabel ? (
                            <span
                              className={cn(
                                counsellingSessionTokens.statusPill,
                                'bg-counselling-muted text-counselling-foreground',
                              )}
                              data-testid="sessions-row-status"
                            >
                              {statusLabel}
                            </span>
                          ) : (
                            <span className="text-counselling-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-2.5 py-2 align-middle text-right sm:px-3">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1">
                            <CounsellingButton
                              type="button"
                              variant="default"
                              size="sm"
                              className="!min-h-8 h-8 px-2 text-xs font-medium"
                              data-testid="sessions-row-open"
                              aria-label={`Open counselling session for ${patient}`}
                              onClick={() =>
                                router.push(buildSessionsOpenHref(id, searchParams.toString()))
                              }
                            >
                              Open
                            </CounsellingButton>
                            {showReassign ? (
                              <CounsellingButton
                                type="button"
                                variant="outline"
                                size="sm"
                                className="!min-h-8 h-8 px-2 text-xs font-medium border-counselling-border text-counselling-foreground"
                                data-testid="sessions-row-reassign"
                                aria-label={`Reassign counselling session for ${patient}`}
                                onClick={() => setReassignSession(session)}
                              >
                                Reassign
                              </CounsellingButton>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalCount > 0 ? (
              <div
                data-testid="sessions-list-pagination"
                className="flex shrink-0 flex-col gap-1 border-t border-counselling-border/50 px-2.5 py-1.5 text-xs text-counselling-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-3"
              >
                <p data-testid="sessions-list-pagination-summary">
                  Showing{' '}
                  <span className="font-medium tabular-nums text-counselling-foreground">
                    {rangeStart}
                  </span>
                  –
                  <span className="font-medium tabular-nums text-counselling-foreground">
                    {rangeEnd}
                  </span>
                  {' of '}
                  <span className="font-medium tabular-nums text-counselling-foreground">
                    {totalCount}
                  </span>
                  {' sessions'}
                </p>
                {totalPages > 1 ? (
                  <nav
                    className="flex items-center gap-0.5"
                    aria-label="Counselling sessions pagination"
                  >
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-counselling-muted-foreground transition-colors hover:bg-counselling-muted/50 hover:text-counselling-foreground disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40"
                      aria-label="Previous page"
                      data-testid="sessions-list-pagination-prev"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {visiblePages.map((p, idx) =>
                      p === 'ellipsis' ? (
                        <span
                          key={`e-${idx}`}
                          className="px-1 text-counselling-muted-foreground/70"
                          aria-hidden
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPage(p)}
                          className={cn(
                            'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40',
                            p === page
                              ? 'bg-counselling-primary text-white'
                              : 'text-counselling-muted-foreground hover:bg-counselling-muted/50 hover:text-counselling-foreground',
                          )}
                          aria-label={`Page ${p}`}
                          aria-current={p === page ? 'page' : undefined}
                          data-testid={`sessions-list-pagination-page-${p}`}
                        >
                          {p}
                        </button>
                      ),
                    )}
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-counselling-muted-foreground transition-colors hover:bg-counselling-muted/50 hover:text-counselling-foreground disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40"
                      aria-label="Next page"
                      data-testid="sessions-list-pagination-next"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </nav>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </section>

      <WaitingListReassignDialog
        open={!!reassignSession}
        sessionId={reassignSession ? resolveSessionId(reassignSession) : null}
        patientName={
          reassignSession?.patientName ??
          reassignSession?.PatientName ??
          undefined
        }
        currentOwnerId={reassignSession ? resolveCounselorId(reassignSession) : null}
        currentOwnerName={
          reassignSession ? resolveCounselorName(reassignSession) : null
        }
        sessionBranchId={
          reassignSession ? resolveBranchId(reassignSession) : null
        }
        sessionVersion={
          reassignSession ? resolveVersion(reassignSession) : undefined
        }
        onOpenChange={(open) => {
          if (!open) setReassignSession(null);
        }}
        onReassigned={() => {
          handleReassignRefresh();
        }}
        onOwnershipConflict={() => {
          handleReassignRefresh();
        }}
      />
    </div>
  );
}
