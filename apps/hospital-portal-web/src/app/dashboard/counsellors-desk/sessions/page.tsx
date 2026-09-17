'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives/CounsellingButton';
import { useCounselingSessions } from '@/hooks/use-counseling-sessions';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { COUNSELLING_SESSIONS_READ_PERMISSION } from '@/lib/counsellors-desk/counselling-auth';
import type { SessionFilters } from '@/lib/api/counseling-sessions.api';
import { cn } from '@/lib/utils';
import { ArrowLeft, Loader2 } from 'lucide-react';

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
  const searchParams = useSearchParams();

  const branchId = searchParams.get('branchId') ?? undefined;
  const counselorId = searchParams.get('counselorId') ?? undefined;
  const sessionDateFrom = searchParams.get('sessionDateFrom') ?? undefined;
  const sessionDateTo = searchParams.get('sessionDateTo') ?? undefined;
  const pendingDecision = parseBoolParam(searchParams.get('pendingDecision'));
  const patientAgreedToSurgery = parseBoolParam(searchParams.get('patientAgreedToSurgery'));
  const recommendedSurgery = searchParams.get('recommendedSurgery') ?? undefined;
  const analyticsOutcome = searchParams.get('analyticsOutcome') ?? undefined;
  const agingBucket = searchParams.get('agingBucket') ?? undefined;

  const filters = useMemo(
    (): SessionFilters => ({
      branchId,
      counselorId,
      sessionDateFrom,
      sessionDateTo,
      pendingDecision,
      patientAgreedToSurgery,
      recommendedSurgery,
      page: 1,
      pageSize: 50,
    }),
    [
      branchId,
      counselorId,
      sessionDateFrom,
      sessionDateTo,
      pendingDecision,
      patientAgreedToSurgery,
      recommendedSurgery,
    ],
  );

  const { data, isPending, isError, refetch } = useCounselingSessions(filters);
  const sessions =
    data?.sessions ?? data?.data ?? data?.Sessions ?? [];
  const totalCount = data?.totalCount ?? data?.TotalCount ?? sessions.length;

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

  return (
    <div
      className={cn(
        counsellingSessionTokens.shellPage,
        'staff-page-fit h-full overflow-hidden gap-2 px-2.5 pb-2 pt-1 min-[1600px]:px-4 min-[1600px]:pb-4',
      )}
      data-testid="counselling-sessions-list-page"
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2">
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
            <h1 className="staff-page-title text-base font-semibold text-counselling-foreground min-[1600px]:text-lg">
              Counselling Sessions
            </h1>
            <p className="text-xs text-counselling-muted-foreground">
              {totalCount} session{totalCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </header>

      {filterChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5" data-testid="sessions-filter-chips">
          {filterChips.map((chip) => (
            <FilterChip key={chip} label={chip} />
          ))}
        </div>
      )}

      <div className={cn(counsellingSessionTokens.sessionWidget, 'min-h-0 flex-1 overflow-hidden p-0')}>
        {isPending && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-counselling-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading sessions…
          </div>
        )}

        {isError && !isPending && (
          <div className="py-16 text-center" role="alert">
            <p className="text-sm text-red-800">Failed to load sessions</p>
            <CounsellingButton
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 !min-h-8 h-8 text-xs"
              onClick={() => void refetch()}
            >
              Retry
            </CounsellingButton>
          </div>
        )}

        {!isPending && !isError && sessions.length === 0 && (
          <p className="py-16 text-center text-sm text-counselling-muted-foreground">
            No sessions match these filters
          </p>
        )}

        {!isPending && !isError && sessions.length > 0 && (
          <div className="overflow-auto">
            <table className="w-full min-w-[36rem] text-xs" aria-label="Counselling sessions">
              <thead className="sticky top-0 z-10 bg-counselling-card">
                <tr className="border-b border-counselling-border/60">
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-counselling-muted-foreground">
                    Patient
                  </th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-counselling-muted-foreground">
                    Session date
                  </th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-counselling-muted-foreground">
                    Surgery
                  </th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-counselling-muted-foreground">
                    Decision
                  </th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide text-counselling-muted-foreground">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-counselling-border/40">
                {sessions.map((session) => {
                  const agreed =
                    session.patientAgreedToSurgery ?? session.agreedToSurgery;
                  const pending = session.pendingDecision === true;
                  return (
                    <tr
                      key={session.id}
                      className="hover:bg-counselling-muted/20"
                      data-testid="sessions-list-row"
                    >
                      <td className="max-w-[180px] truncate px-3 py-2 font-medium text-counselling-foreground">
                        {session.patientName ?? session.sessionNumber ?? session.id.slice(0, 8)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-counselling-muted-foreground">
                        {session.sessionDate?.slice(0, 10) ?? '—'}
                      </td>
                      <td className="max-w-[140px] truncate px-3 py-2 text-counselling-muted-foreground">
                        {session.recommendedSurgery ?? '—'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {pending && (
                            <span
                              className={cn(
                                counsellingSessionTokens.statusPill,
                                counsellingSessionTokens.statusPillRequired,
                              )}
                            >
                              Pending
                            </span>
                          )}
                          {agreed === true && (
                            <span
                              className={cn(
                                counsellingSessionTokens.statusPill,
                                counsellingSessionTokens.statusPillComplete,
                              )}
                            >
                              Agreed
                            </span>
                          )}
                          {agreed === false && !pending && (
                            <span
                              className={cn(
                                counsellingSessionTokens.statusPill,
                                counsellingSessionTokens.statusPillDanger,
                              )}
                            >
                              Declined
                            </span>
                          )}
                          {agreed == null && !pending && (
                            <span className="text-counselling-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <CounsellingButton
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="!min-h-7 h-7 px-2 text-xs"
                          onClick={() => router.push(`/dashboard/counsellors-desk/${session.id}?from=analytics`)}
                        >
                          Open
                        </CounsellingButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
