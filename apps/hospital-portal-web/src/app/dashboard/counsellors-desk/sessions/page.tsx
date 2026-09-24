'use client';

import { useMemo, useCallback, useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives/CounsellingButton';
import { WaitingListReassignDialog } from '@/components/counsellors-desk/waiting-list/WaitingListReassignDialog';
import { useCounselingSessions } from '@/hooks/use-counseling-sessions';
import { useHasPermission } from '@/hooks/use-permissions';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import {
  COUNSELLING_SESSIONS_READ_PERMISSION,
  COUNSELLING_SESSIONS_REASSIGN_PERMISSION,
  canShowCounsellingReassign,
} from '@/lib/counsellors-desk/counselling-auth';
import { canShowSessionsRrReassign } from '@/lib/counsellors-desk/sessions-rr-reassign';
import type { SessionFilters } from '@/lib/api/counseling-sessions.api';
import {
  parseReassignmentRequiredParam,
  toggleReassignmentRequiredInSearchParams,
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
import { cn } from '@/lib/utils';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

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
  counselorId?: string | null;
  CounselorId?: string | null;
  counselorName?: string | null;
  CounselorName?: string | null;
  CounseledByUserName?: string | null;
  branchId?: string | null;
  BranchId?: string | null;
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

function FilterChip({ label }: { label: string }) {
  return (
    <span className={cn(counsellingSessionTokens.statusPill, 'bg-counselling-muted text-counselling-foreground')}>
      {label}
    </span>
  );
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

  const branchId = searchParams.get('branchId') ?? undefined;
  const counselorId = searchParams.get('counselorId') ?? undefined;
  const sessionDateFrom = searchParams.get('sessionDateFrom') ?? undefined;
  const sessionDateTo = searchParams.get('sessionDateTo') ?? undefined;
  const pendingDecision = parseBoolParam(searchParams.get('pendingDecision'));
  const patientAgreedToSurgery = parseBoolParam(searchParams.get('patientAgreedToSurgery'));
  const recommendedSurgery = searchParams.get('recommendedSurgery') ?? undefined;
  const analyticsOutcome = searchParams.get('analyticsOutcome') ?? undefined;
  const agingBucket = searchParams.get('agingBucket') ?? undefined;
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

  const setReassignmentRequired = useCallback(
    (enabled: boolean) => {
      const toggled = toggleReassignmentRequiredInSearchParams(
        new URLSearchParams(searchParams.toString()),
        enabled,
      );
      // Filter change resets to page 1 (PD-S13-PAG filter→page reset).
      replaceSearchParams(setSessionsPageInSearchParams(toggled, 1));
    },
    [replaceSearchParams, searchParams],
  );

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

  /** Non-RR filter chips only — RR state is shown by the primary pill. */
  const filterChips = useMemo(() => {
    const chips: string[] = [];
    if (analyticsOutcome) chips.push(analyticsOutcome);
    if (pendingDecision === true) chips.push('Pending decision');
    if (pendingDecision === false) chips.push('Not pending');
    if (patientAgreedToSurgery === true) chips.push('Agreed to surgery');
    if (patientAgreedToSurgery === false) chips.push('Declined surgery');
    if (recommendedSurgery) chips.push(`Surgery: ${recommendedSurgery}`);
    if (sessionDateFrom && sessionDateTo) chips.push(`${sessionDateFrom} – ${sessionDateTo}`);
    else if (sessionDateFrom) chips.push(`From ${sessionDateFrom}`);
    else if (sessionDateTo) chips.push(`Through ${sessionDateTo}`);
    if (agingBucket) chips.push(`Aging: ${agingBucket.replace('bucket_', '').replace('_', '–')}`);
    if (counselorId) chips.push('Counselor filtered');
    if (branchId) chips.push('Branch filtered');
    return chips;
  }, [
    analyticsOutcome,
    pendingDecision,
    patientAgreedToSurgery,
    recommendedSurgery,
    sessionDateFrom,
    sessionDateTo,
    agingBucket,
    counselorId,
    branchId,
  ]);

  const handleReassignRefresh = useCallback(() => {
    setReassignSession(null);
    void refetch();
  }, [refetch]);

  return (
    <div
      className={cn(
        counsellingSessionTokens.shellPage,
        'staff-page-fit h-full overflow-hidden gap-0.5 px-2.5 pb-1 pt-0.5',
        'min-[1600px]:gap-2.5 min-[1600px]:px-4 min-[1600px]:pb-4 min-[1600px]:pt-2.5',
      )}
      data-testid="counselling-sessions-list-page"
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-0.5 py-0 min-[1600px]:py-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <CounsellingButton
            type="button"
            variant="ghost"
            size="sm"
            className="!min-h-8 h-8 px-2"
            onClick={() => router.back()}
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </CounsellingButton>
          <div className="min-w-0">
            <h1 className="staff-page-title font-semibold tracking-tight text-counselling-foreground max-[1599px]:text-base max-[1599px]:leading-5 min-[1600px]:text-[1.375rem]">
              Counselling Sessions
            </h1>
            <p
              className="text-xs tabular-nums leading-4 text-counselling-muted-foreground"
              data-testid="sessions-list-count"
            >
              {totalCount} session{totalCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-pressed={reassignmentRequired}
          data-testid="reassignment-required-filter"
          onClick={() => setReassignmentRequired(!reassignmentRequired)}
          className={cn(
            counsellingSessionTokens.pillTab,
            'shrink-0 whitespace-nowrap',
            reassignmentRequired && counsellingSessionTokens.pillTabCurrent,
          )}
        >
          Reassignment Required
        </button>
      </header>

      {filterChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-0.5" data-testid="sessions-filter-chips">
          {filterChips.map((chip) => (
            <FilterChip key={chip} label={chip} />
          ))}
        </div>
      )}

      <section
        className={cn(
          counsellingSessionTokens.sessionWidget,
          'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
        )}
        aria-label="Counselling sessions worklist"
      >
        {isPending && (
          <div className="flex flex-1 items-center justify-center gap-2 py-12 text-sm text-counselling-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading sessions…
          </div>
        )}

        {isError && !isPending && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center" role="alert">
            <p className="text-sm font-medium text-red-800">Failed to load sessions</p>
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
          >
            {reassignmentRequired ? (
              <>
                <p className="text-sm font-medium text-counselling-foreground">
                  No sessions require reassignment
                </p>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-counselling-muted-foreground">
                  None match the Reassignment Required filter.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-counselling-foreground">
                  No sessions match these filters
                </p>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-counselling-muted-foreground">
                  Try adjusting filters or clear the current selection.
                </p>
              </>
            )}
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
                  <col className="w-[28%]" />
                  <col className="w-[16%]" />
                  <col className="w-[26%]" />
                  <col className="w-[12%]" />
                  <col className="w-[18%]" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-counselling-card">
                  <tr className="border-b border-counselling-border/60">
                    <th className="px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground sm:px-3">
                      Patient
                    </th>
                    <th className="px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground sm:px-3">
                      Session date
                    </th>
                    <th className="hidden px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground sm:table-cell sm:px-3">
                      Surgery
                    </th>
                    <th className="px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground sm:px-3">
                      Decision
                    </th>
                    <th className="px-2.5 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground sm:px-3">
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
                    const decision = resolveDecision(session);
                    const ownerId = resolveCounselorId(session);
                    const ownerLabel = reassignmentRequired
                      ? resolveCounselorName(session)
                      : undefined;
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
                          {ownerLabel ? (
                            <div className="mt-0.5 truncate text-[11px] font-normal text-counselling-muted-foreground">
                              Owner: {ownerLabel}
                            </div>
                          ) : null}
                          <div className="mt-0.5 truncate text-[11px] text-counselling-muted-foreground sm:hidden">
                            {surgery}
                          </div>
                        </td>
                        <td className="px-2.5 py-2 align-middle tabular-nums text-counselling-muted-foreground sm:px-3">
                          {dateLabel}
                        </td>
                        <td className="hidden truncate px-2.5 py-2 align-middle text-counselling-muted-foreground sm:table-cell sm:px-3">
                          {surgery}
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
                                router.push(
                                  `/dashboard/counsellors-desk/${id}?from=sessions`,
                                )
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
