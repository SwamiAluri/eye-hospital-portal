'use client';

import { Users } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import { counsellingAzureApi } from '@/lib/api/counselling-azure.api';
import { ipManagementApi } from '@/lib/api/ip-management.api';
import type { PatientJourneyRowDto } from '@/lib/api/ip-management.api';
import { useAuthStore } from '@/lib/auth-store';
import { useBranchContext } from '@/hooks/use-branch-context';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { WaitingListSummaryWidget } from '@/components/counsellors-desk/waiting-list/WaitingListSummaryWidget';
import {
  WaitingListFilterToolbar,
  WAITING_LIST_STATUS_TABS,
} from '@/components/counsellors-desk/waiting-list/WaitingListFilterToolbar';
import { WaitingListQueueWidget } from '@/components/counsellors-desk/waiting-list/WaitingListQueueWidget';
import { WaitingListQueuePagination } from '@/components/counsellors-desk/waiting-list/WaitingListQueuePagination';
import { WaitingListWorkRow } from '@/components/counsellors-desk/waiting-list/WaitingListWorkRow';
import { startOtReturnedCounselling } from '@/lib/counsellors-desk/start-ot-returned-counselling';
import type { OtReturnedCreateSessionPayload } from '@/lib/counsellors-desk/start-ot-returned-counselling';
import {
  filterOtReturnedOperationalRows,
  type OtReturnedProjectedRow,
  type OtReturnedSessionLite,
} from '@/lib/counsellors-desk/ot-returned-membership';
import { toOtReturnedWaitingListPatient } from '@/lib/counsellors-desk/ot-returned-work-row';
import { getApi } from '@/lib/api';
import { counselingSessionsApi } from '@/lib/api/counseling-sessions.api';
import { WaitingListPatientDetailSheet } from '@/components/counsellors-desk/waiting-list/WaitingListPatientDetailSheet';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useWaitingListQuery, useInvalidateCounsellorsDesk } from '@/hooks/use-counsellors-desk-queries';
import {
  useDeferredCcmsBadges,
  type DeferredCcmsBadge,
} from '@/hooks/use-deferred-ccms-badges';
import { isCoveragePaymentTypeValue } from '@/lib/counsellors-desk/session-utils';
import { isWaitingListPreAuthQueue } from '@/lib/counsellors-desk/waiting-list-preauth';
import { applyWaitingListClientFilters } from '@/lib/counsellors-desk/waiting-list-client-filters';
import type { WaitingListOwnerFilter } from '@/lib/counsellors-desk/waiting-list-client-filters';
import {
  getWaitingListTotalPages,
  sliceWaitingListPage,
  type WaitingListPageSize,
} from '@/lib/counsellors-desk/waiting-list-pagination';
import {
  applyWaitingListUrlState,
  parseWaitingListUrlState,
  resetWaitingListUrlFilters,
  type WaitingListUrlState,
  type WaitingListUrlTab,
  type WaitingListUrlType,
} from '@/lib/counsellors-desk/waiting-list-url-state';
import {
  resolveWaitingListEmptyCopy,
  resolveWaitingListQueueTitle,
} from '@/lib/counsellors-desk/waiting-list-empty-copy';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import {
  COUNSELLING_SESSIONS_READ_PERMISSION,
  COUNSELLING_SESSIONS_UPDATE_PERMISSION,
  COUNSELLING_SESSIONS_REASSIGN_PERMISSION,
  canShowCounsellingInitialAssign,
  canShowCounsellingAssignToMe,
  canShowCounsellingReassign,
  isWaitingListEligibleForInitialAssign,
} from '@/lib/counsellors-desk/counselling-auth';
import { resolveLifecycleOwnershipDecision } from '@/lib/counsellors-desk/counselling-ownership';
import {
  buildLifecycleOwnershipConfirmCopy,
  formatCounsellorDisplayName,
  shouldOpenProcessingAfterAssign,
} from '@/lib/counsellors-desk/lifecycle-ownership-confirm';
import type { WaitingListLifecycleActionKind } from '@/lib/counsellors-desk/waiting-list-lifecycle-action';
import type { WaitingListPatient, WaitingListFilters, AddPatientFormData } from '@/types/counsellors-desk';
import { cn } from '@/lib/utils';
import { useHasPermission } from '@/hooks/use-permissions';
import { WaitingListAssignDialog } from '@/components/counsellors-desk/waiting-list/WaitingListAssignDialog';
import { WaitingListReassignDialog } from '@/components/counsellors-desk/waiting-list/WaitingListReassignDialog';
import { useConfirmation } from '@/components/common/ConfirmationDialog';
import { getApiErrorMessage } from '@/lib/auth-interceptors';
import {
  getSessionConcurrencyMessage,
  isSessionConcurrencyConflict,
} from '@/lib/counsellors-desk/session-concurrency';

const AddPatientModal = dynamic(
  () => import('@/components/counsellors-desk/AddPatientModal').then(m => ({ default: m.AddPatientModal })),
  { ssr: false },
);

function ccmsPropsFromBadge(badge: DeferredCcmsBadge | undefined) {
  if (badge?.status === 'ready') return { hasCcmsCase: true, ccmsState: badge.state };
  return { hasCcmsCase: false, ccmsState: undefined };
}

export default function CounsellorWaitingListPage() {
  return (
    <ProtectedRoute requiredPermission={COUNSELLING_SESSIONS_READ_PERMISSION}>
      <CounsellorWaitingListPageContent />
    </ProtectedRoute>
  );
}

function CounsellorWaitingListPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { invalidateWaitingList } = useInvalidateCounsellorsDesk();
  const { user, roles } = useAuthStore();
  const { showConfirmation, ConfirmationComponent } = useConfirmation();
  const { branchId: contextBranchId } = useBranchContext();
  const branchId = contextBranchId ?? user?.branchId ?? undefined;
  const hasUpdatePermission = useHasPermission(COUNSELLING_SESSIONS_UPDATE_PERMISSION);
  const hasReassignPermission = useHasPermission(COUNSELLING_SESSIONS_REASSIGN_PERMISSION);
  const canAssign = canShowCounsellingInitialAssign({
    hasUpdatePermission,
    roles,
    userType: user?.userType,
  });
  const canAssignToMe = canShowCounsellingAssignToMe({
    roles,
    userType: user?.userType,
  });
  const canReassign = canShowCounsellingReassign({
    hasReassignPermission,
  });

  const urlView = useMemo(
    () => parseWaitingListUrlState(searchParams),
    [searchParams],
  );

  const activeTab = urlView.tab;
  const ownerFilter = urlView.owner;
  const page = urlView.page;
  const pageSize = urlView.pageSize;

  const [otReturnedRows, setOtReturnedRows] = useState<
    Array<OtReturnedProjectedRow<PatientJourneyRowDto>>
  >([]);
  const [otReturnedLoading, setOtReturnedLoading] = useState(false);
  const [startCounsellingJourneyId, setStartCounsellingJourneyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  /** Local draft for typing; URL `q` is SoT after debounce sync. */
  const [quickSearch, setQuickSearch] = useState(urlView.search);
  const debouncedQuickSearch = useDebouncedValue(quickSearch, 300);
  const searchHydratedRef = useRef(false);
  const [demographicsPatient, setDemographicsPatient] = useState<WaitingListPatient | null>(null);
  const [assignPatient, setAssignPatient] = useState<WaitingListPatient | null>(null);
  const [reassignPatient, setReassignPatient] = useState<WaitingListPatient | null>(null);

  const [filters, setFilters] = useState<WaitingListFilters>({
    fromDate: '', toDate: '', patientName: '', mrd: '', type: urlView.type, status: '',
  });
  /** Date / name / MRD sent to API after Apply. Type is client-side only (§6). */
  const [appliedFilters, setAppliedFilters] = useState<WaitingListFilters>({
    fromDate: '', toDate: '', patientName: '', mrd: '', type: 'All', status: '',
  });

  const replaceSearchParams = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const writeUrlView = useCallback(
    (patch: Partial<WaitingListUrlState>) => {
      const nextState: WaitingListUrlState = {
        tab: patch.tab ?? activeTab,
        type: patch.type ?? (filters.type as WaitingListUrlType),
        owner: patch.owner ?? ownerFilter,
        search: patch.search ?? debouncedQuickSearch,
        page: patch.page ?? page,
        pageSize: patch.pageSize ?? pageSize,
      };
      replaceSearchParams(
        applyWaitingListUrlState(new URLSearchParams(searchParams.toString()), nextState),
      );
    },
    [
      activeTab,
      filters.type,
      ownerFilter,
      debouncedQuickSearch,
      page,
      pageSize,
      replaceSearchParams,
      searchParams,
    ],
  );

  // Hydrate local search draft when URL `q` changes (Back/Forward / deep link).
  useEffect(() => {
    setQuickSearch(urlView.search);
    searchHydratedRef.current = true;
  }, [urlView.search]);

  // Keep filters.type aligned with URL type SoT.
  useEffect(() => {
    setFilters((prev) =>
      prev.type === urlView.type ? prev : { ...prev, type: urlView.type },
    );
  }, [urlView.type]);

  // Debounced search → URL (page resets to 1). Skip first paint after hydrate.
  useEffect(() => {
    if (!searchHydratedRef.current) return;
    if (debouncedQuickSearch === urlView.search) return;
    writeUrlView({ search: debouncedQuickSearch, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: sync debounce → URL only
  }, [debouncedQuickSearch]);

  const setActiveTab = useCallback(
    (key: string) => {
      writeUrlView({ tab: key as WaitingListUrlTab, page: 1 });
    },
    [writeUrlView],
  );

  const setOwnerFilter = useCallback(
    (value: WaitingListOwnerFilter) => {
      writeUrlView({ owner: value, page: 1 });
    },
    [writeUrlView],
  );

  const setPage = useCallback(
    (nextPage: number) => {
      writeUrlView({ page: nextPage });
    },
    [writeUrlView],
  );

  const handleFiltersChange = useCallback(
    (next: WaitingListFilters) => {
      setFilters(next);
      if (next.type !== filters.type) {
        writeUrlView({ type: next.type as WaitingListUrlType, page: 1 });
      }
    },
    [filters.type, writeUrlView],
  );

  const apiFilters = useMemo(
    (): WaitingListFilters => ({
      ...appliedFilters,
      type: 'All',
      branchId: branchId,
    }),
    [appliedFilters, branchId],
  );

  const waitingListQuery = useWaitingListQuery(apiFilters);
  const patients = useMemo(() => waitingListQuery.data ?? [], [waitingListQuery.data]);
  const isLoading = waitingListQuery.isLoading && patients.length === 0;
  const isRefreshing = waitingListQuery.isFetching && patients.length > 0;

  // §8 — fetch OT Returned only after branchId is available (auth hydrate race on mount).
  useEffect(() => {
    if (!branchId) return;

    let cancelled = false;

    const loadOtReturned = async () => {
      setOtReturnedLoading(true);
      try {
        const rows = await ipManagementApi.listJourneys({
          branchId,
          clinicalState: 'ReadyForSurgery',
        });
        if (cancelled) return;

        const candidates = rows.filter((r) => !!r.otReturnReason);
        const patientIds = [
          ...new Set(
            candidates
              .map((r) => r.patientId?.trim())
              .filter((id): id is string => !!id),
          ),
        ];

        const sessionsByPatientId = new Map<string, OtReturnedSessionLite[]>();
        await Promise.all(
          patientIds.map(async (patientId) => {
            try {
              const list = await counselingSessionsApi.getPatientSessions(patientId);
              sessionsByPatientId.set(
                patientId,
                (list ?? [])
                  .filter((s) => !!s.id?.trim())
                  .map((s) => ({
                    id: s.id.trim(),
                    status: (s.status || s.sessionStatus || '').toString(),
                    patientAgreedToSurgery: s.patientAgreedToSurgery ?? null,
                    additionalNotes: s.additionalNotes ?? null,
                    createdAt: s.createdAt ?? null,
                    counselorId: s.counselorId != null ? String(s.counselorId) : null,
                    counselorName: s.counselorName ?? null,
                    patientType: s.patientType ?? null,
                    version: s.version ?? null,
                  })),
              );
            } catch {
              sessionsByPatientId.set(patientId, []);
            }
          }),
        );

        if (cancelled) return;

        // Authoritative WL lifecycle when the patient is already on the counselling queue.
        const waitingListByPatientId = new Map<
          string,
          {
            id: string;
            status: (typeof patients)[number]['status'];
            counselorId?: string | null;
            counselorName?: string | null;
            patientType?: string | null;
            version?: number | null;
          }
        >();
        for (const p of patients) {
          const key = (p as WaitingListPatient & { patientId?: string }).patientId?.trim();
          // Waiting list rows are keyed by session id; patientId may be present on enriched rows.
          const pid =
            key ||
            (p as { patientId?: string }).patientId ||
            '';
          if (!pid) continue;
          if (!waitingListByPatientId.has(pid)) {
            waitingListByPatientId.set(pid, {
              id: p.id,
              status: p.status,
              counselorId: p.counselorId,
              counselorName: p.counselorName,
              patientType: p.patientType,
              version: p.version,
            });
          }
        }

        // Also index by matching session id → patient from sessions map when WL patientId missing.
        for (const [patientId, sessions] of sessionsByPatientId) {
          if (waitingListByPatientId.has(patientId)) continue;
          const match = patients.find((p) => sessions.some((s) => s.id === p.id));
          if (match) {
            waitingListByPatientId.set(patientId, {
              id: match.id,
              status: match.status,
              counselorId: match.counselorId,
              counselorName: match.counselorName,
              patientType: match.patientType,
              version: match.version,
            });
          }
        }

        setOtReturnedRows(
          filterOtReturnedOperationalRows(candidates, sessionsByPatientId, waitingListByPatientId),
        );
      } catch {
        if (cancelled) return;
        setOtReturnedRows([]);
        toast.error('Failed to load OT-returned patients');
      } finally {
        if (!cancelled) setOtReturnedLoading(false);
      }
    };

    void loadOtReturned();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadOtReturned();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [branchId, patients]);

  const refetchWaitingList = waitingListQuery.refetch;

  // Refetch when user navigates back to this page (visibility change covers router.back())
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refetchWaitingList();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refetchWaitingList]);

  useEffect(() => {
    if (waitingListQuery.isError) toast.error('Failed to load waiting list');
  }, [waitingListQuery.isError]);

  const handleStartOtReturnedCounselling = useCallback(
    async (row: OtReturnedProjectedRow<PatientJourneyRowDto>) => {
      if (startCounsellingJourneyId) return;
      setStartCounsellingJourneyId(row.id);
      try {
        const result = await startOtReturnedCounselling(
          {
            journeyId: row.id,
            patientId: row.patientId,
            branchId,
            otReturnReason: row.otReturnReason,
            procedureName: row.procedureName,
            eye: row.eyeOperated,
          },
          {
            getJourneyDetail: async (journeyId) => {
              const detail = await ipManagementApi.getJourneyDetail(journeyId);
              if (!detail) return null;
              const raw = detail as PatientJourneyRowDto & {
                admittingDoctorId?: string | null;
              };
              return {
                patientId: detail.patientId,
                primarySurgeonId: detail.primarySurgeonId,
                admittingDoctorId: raw.admittingDoctorId ?? null,
                procedureName: detail.procedureName,
                eyeOperated: detail.eyeOperated,
                otReturnReason: detail.otReturnReason,
              };
            },
            getPatientSessions: async (patientId) => {
              const list = await counselingSessionsApi.getPatientSessions(patientId);
              return (list ?? []).map((s) => ({
                id: s.id,
                referredByDoctorId:
                  (s as { referredByDoctorId?: string | null }).referredByDoctorId ?? null,
                status: s.status || s.sessionStatus,
              }));
            },
            createSession: async (payload: OtReturnedCreateSessionPayload) => {
              try {
                const response = await getApi().post('/Counseling/sessions', payload);
                return { status: response.status, data: response.data };
              } catch (err: unknown) {
                const axiosErr = err as {
                  response?: {
                    status?: number;
                    data?: { success?: boolean; sessionId?: string; message?: string };
                  };
                };
                if (axiosErr.response?.status) {
                  return {
                    status: axiosErr.response.status,
                    data: axiosErr.response.data,
                  };
                }
                throw err;
              }
            },
          },
        );
        router.push(result.href);
      } catch (err: unknown) {
        toast.error(
          getApiErrorMessage(err) ||
            (err instanceof Error ? err.message : 'Failed to start counselling'),
        );
      } finally {
        setStartCounsellingJourneyId(null);
      }
    },
    [branchId, router, startCounsellingJourneyId],
  );

  const handleSearch = () => {
    // Apply date / name / MRD only — type already filters immediately client-side.
    setAppliedFilters({
      ...filters,
      type: 'All',
    });
    writeUrlView({ page: 1 });
  };

  const handleReset = () => {
    const blank: WaitingListFilters = {
      fromDate: '', toDate: '', patientName: '', mrd: '', type: 'All', status: '',
    };
    setFilters(blank);
    setAppliedFilters(blank);
    setQuickSearch('');
    replaceSearchParams(
      resetWaitingListUrlFilters(new URLSearchParams(searchParams.toString())),
    );
  };

  const coveragePatients = useMemo(
    () => patients.filter((p) => isCoveragePaymentTypeValue(p.patientType)),
    [patients],
  );

  const ccmsBadges = useDeferredCcmsBadges(coveragePatients);

  const isPreAuthQueueRow = useCallback(
    (p: WaitingListPatient) => {
      const badge = ccmsBadges[p.id];
      if (!badge || badge.status !== 'ready') return false;
      return isWaitingListPreAuthQueue({
        patientType: p.patientType,
        ccmsState: badge.state,
        hasCcmsCase: true,
      });
    },
    [ccmsBadges],
  );

  const filtered = useMemo(
    () =>
      applyWaitingListClientFilters({
        patients,
        type: filters.type,
        activeTab,
        quickSearch: debouncedQuickSearch,
        patientName: appliedFilters.patientName,
        mrd: appliedFilters.mrd,
        ownerFilter,
        currentUserId: user?.id,
        isPreAuthQueueRow,
      }),
    [patients, filters.type, activeTab, debouncedQuickSearch, appliedFilters.patientName, appliedFilters.mrd, ownerFilter, user?.id, isPreAuthQueueRow],
  );

  const tabCounts = useMemo(() => {
    const typeScoped =
      filters.type === 'All' ? patients : patients.filter((p) => p.type === filters.type);
    const map: Record<string, number> = { All: typeScoped.length };
    WAITING_LIST_STATUS_TABS.slice(1).forEach(({ key }) => {
      if (key === 'OtReturned') {
        map[key] = otReturnedRows.length;
      } else if (key === 'PreAuthQueue') {
        map[key] = typeScoped.filter(isPreAuthQueueRow).length;
      } else {
        map[key] = typeScoped.filter((p) => p.status === key).length;
      }
    });
    return map;
  }, [patients, otReturnedRows, isPreAuthQueueRow, filters.type]);

  const handleAddPatient = async (data: AddPatientFormData) => {
    try {
      const added = await counsellorsDeskApi.addPatientToWaitingList(data, {
        branchId: branchId ?? undefined,
      });
      setQuickSearch('');
      setFilters((f) => ({ ...f, type: 'All', patientName: '', mrd: '' }));
      setAppliedFilters({
        fromDate: '', toDate: '', patientName: '', mrd: '', type: 'All', status: '',
      });
      replaceSearchParams(
        applyWaitingListUrlState(new URLSearchParams(searchParams.toString()), {
          tab: 'Pending',
          type: 'All',
          owner: 'All',
          search: '',
          page: 1,
          pageSize,
        }),
      );
      await invalidateWaitingList();
      await refetchWaitingList();
      toast.success(`${added.patientName} scheduled for counselling — check Pending (${added.uhid})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to schedule counselling';
      toast.error(message);
      throw err;
    }
  };

  const navigateToSession = useCallback(
    (patient: WaitingListPatient, lifecycle?: WaitingListLifecycleActionKind) => {
      // Azure enrichment start only — does not set AuthService CounselorId.
      if (patient.status === 'Pending' || patient.status === 'RepeatCounselling') {
        counsellingAzureApi.start(patient.id);
      }
      const qs = new URLSearchParams({ from: 'waiting-list' });
      if (lifecycle === 're-evaluate') qs.set('lifecycle', 're-evaluate');
      if (lifecycle === 'start-repeat') qs.set('lifecycle', 'start-repeat');
      // Pending Start Counseling — authoritative Auth StartSession on session page.
      if (lifecycle === 'open') qs.set('lifecycle', 'start-counseling');
      router.push(`/dashboard/counsellors-desk/${patient.id}?${qs.toString()}`);
    },
    [router],
  );

  const handleRowClick = useCallback((patient: WaitingListPatient) => {
    setSelectedId(patient.id);
    // Pending/Processing/unassigned RepeatCounselling: Assign dialog. Done uses explicit CTAs.
    if (isWaitingListEligibleForInitialAssign(patient)) {
      if (canAssign) setAssignPatient(patient);
      return;
    }
    // Done/owned Repeat row click = view only — never silently start lifecycle or claim ownership.
    navigateToSession(patient);
  }, [canAssign, navigateToSession]);

  const runLifecycleAfterOwnership = useCallback(
    (patient: WaitingListPatient, kind: 're-evaluate' | 'start-repeat') => {
      void invalidateWaitingList();
      navigateToSession(patient, kind);
    },
    [invalidateWaitingList, navigateToSession],
  );

  const resolveLifecycleOwnershipThenContinue = useCallback(
    (patient: WaitingListPatient, kind: 're-evaluate' | 'start-repeat') => {
      const decision = resolveLifecycleOwnershipDecision({
        counselorId: patient.counselorId,
        currentUserId: user?.id,
        canAssignToMe,
      });
      const intent = kind === 're-evaluate' ? 'ReEvaluate' : 'StartRepeat';

      if (decision.path === 'continue') {
        // Current owner: no ownership mutation — direct continuation.
        // Start Repeat has no separate Waiting List confirmation — session lifecycle consumes intent once.
        if (kind === 're-evaluate') {
          showConfirmation({
            title: 'Re-evaluate Session',
            message:
              'Changing the procedure will restart the counselling process (Done → In Progress). Continue?',
            variant: 'warning',
            confirmText: 'Continue',
            onConfirm: () => {
              navigateToSession(patient, kind);
            },
          });
          return;
        }
        navigateToSession(patient, kind);
        return;
      }

      if (decision.path === 'blocked') {
        toast.error('Only a counsellor can take ownership for this action');
        return;
      }

      const copy = buildLifecycleOwnershipConfirmCopy({
        kind,
        currentOwnerName: patient.counselorName,
        continueAsName: formatCounsellorDisplayName({
          firstName: user?.firstName,
          lastName: user?.lastName,
          fallback: 'You',
        }),
      });

      // NULL or other owner — lifecycle-specific claim (not Assign, not General Reassign).
      showConfirmation({
        title: copy.title,
        message: (
          <div className="space-y-3 text-sm" data-testid="lifecycle-ownership-confirm">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Current owner</p>
              <p className="font-medium text-foreground">{copy.currentOwnerLabel}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Continue as</p>
              <p className="font-medium text-foreground">{copy.continueAsLabel}</p>
            </div>
          </div>
        ),
        confirmText: 'Continue as me',
        variant: 'warning',
        confirmTestId: 'lifecycle-ownership-continue-as-me',
        dataTestId: 'lifecycle-ownership-confirm-dialog',
        onConfirm: async () => {
          try {
            await counsellorsDeskApi.claimSessionForLifecycle(patient.id, {
              expectedCounselorId: decision.expectedCounselorId,
              intent,
              version: patient.version,
            });
            runLifecycleAfterOwnership(patient, kind);
          } catch (err) {
            if (isSessionConcurrencyConflict(err)) {
              // Phase 3I Slice 7 (PD-S7-06): server distinguishes stale-ownership vs stale-Version
              // via the 409 message body — surface it verbatim, no auto-retry.
              toast.error(getSessionConcurrencyMessage(err));
              await waitingListQuery.refetch();
              return;
            }
            toast.error(getApiErrorMessage(err, 'Failed to claim session'));
            await waitingListQuery.refetch();
          }
        },
      });
    },
    [
      user?.id,
      user?.firstName,
      user?.lastName,
      canAssignToMe,
      navigateToSession,
      showConfirmation,
      runLifecycleAfterOwnership,
      waitingListQuery,
    ],
  );

  const handleLifecycleAction = useCallback(
    (patient: WaitingListPatient, kind: WaitingListLifecycleActionKind) => {
      setSelectedId(patient.id);
      if (kind === 'assign') {
        if (canAssign) setAssignPatient(patient);
        return;
      }
      if (kind === 'preauth') {
        router.push(
          `/dashboard/counsellors-desk/${patient.id}?from=waiting-list&tab=coverage&subtab=preauth`,
        );
        return;
      }
      if (kind === 're-evaluate' || kind === 'start-repeat') {
        resolveLifecycleOwnershipThenContinue(patient, kind);
        return;
      }
      if (kind === 'open') {
        // Pending + current owner — Start Counseling (lifecycle intent; Auth StartSession on session page).
        navigateToSession(patient, 'open');
        return;
      }
      navigateToSession(patient);
    },
    [canAssign, navigateToSession, resolveLifecycleOwnershipThenContinue, router],
  );

  const handleDemographics = useCallback((patient: WaitingListPatient) => {
    setDemographicsPatient(patient);
  }, []);

  const handleAssignOpen = useCallback((patient: WaitingListPatient) => {
    setAssignPatient(patient);
  }, []);

  const handleAssigned = useCallback(
    async (result: { sessionId: string; counselorId: string; counselorName: string | null }) => {
      const patient = assignPatient;
      setAssignPatient(null);
      await invalidateWaitingList();
      await waitingListQuery.refetch();

      // Processing + assigned to current user → open counselling workflow (no StartSession).
      // Peer assign or Pending assign → stay on Waiting List (Pending still requires Start Counseling).
      if (
        patient &&
        shouldOpenProcessingAfterAssign({
          sessionStatus: patient.status,
          assignedCounselorId: result.counselorId,
          currentUserId: user?.id,
        })
      ) {
        navigateToSession(patient);
      }
    },
    [assignPatient, invalidateWaitingList, navigateToSession, user?.id, waitingListQuery],
  );

  const handleReassignOpen = useCallback((patient: WaitingListPatient) => {
    setReassignPatient(patient);
  }, []);

  const handleReassigned = useCallback(async () => {
    setReassignPatient(null);
    await invalidateWaitingList();
    await waitingListQuery.refetch();
  }, [invalidateWaitingList, waitingListQuery]);

  const handlePreAuth = useCallback((patientId: string) => {
    router.push(`/dashboard/counsellors-desk/${patientId}?from=waiting-list&tab=coverage&subtab=preauth`);
  }, [router]);

  const hasActiveFilters = !!(
    appliedFilters.fromDate || appliedFilters.toDate ||
    filters.type !== 'All' ||
    ownerFilter !== 'All' ||
    quickSearch.trim() ||
    activeTab !== 'All'
  );

  const hasRestrictiveClientScope = !!(
    filters.type !== 'All' ||
    ownerFilter !== 'All' ||
    debouncedQuickSearch.trim() ||
    appliedFilters.patientName.trim() ||
    appliedFilters.mrd.trim() ||
    appliedFilters.fromDate ||
    appliedFilters.toDate ||
    (activeTab !== 'All' && activeTab !== 'OtReturned')
  );

  const isOtTab = activeTab === 'OtReturned';
  const queueCount = isOtTab ? otReturnedRows.length : filtered.length;
  const queueLoading = isOtTab ? otReturnedLoading : isLoading;
  const queueEmpty = isOtTab ? !otReturnedLoading && otReturnedRows.length === 0 : !isLoading && filtered.length === 0;

  // Clamp page when queue shrinks (client-side pagination only).
  useEffect(() => {
    const totalPages = getWaitingListTotalPages(queueCount, pageSize);
    if (page > totalPages) {
      writeUrlView({ page: totalPages });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clamp only when page exceeds total
  }, [queueCount, pageSize, page]);

  const pagedPatients = useMemo(
    () => sliceWaitingListPage(filtered, page, pageSize),
    [filtered, page, pageSize],
  );
  const pagedOtRows = useMemo(
    () => sliceWaitingListPage(otReturnedRows, page, pageSize),
    [otReturnedRows, page, pageSize],
  );

  const emptyCopy = resolveWaitingListEmptyCopy({
    activeTab,
    hasRestrictiveClientScope,
    hasAnyPatientsInBranch: patients.length > 0 || isOtTab,
  });

  const emptyContent = (
    <>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-counselling-muted/60">
        <Users className="h-5 w-5 text-counselling-muted-foreground opacity-60" aria-hidden />
      </div>
      <p role="status" className="text-sm font-medium text-counselling-foreground">
        {emptyCopy.title}
      </p>
    </>
  );

  const handlePageSizeChange = useCallback(
    (next: WaitingListPageSize) => {
      writeUrlView({ pageSize: next, page: 1 });
    },
    [writeUrlView],
  );

  return (
    <div
      className={cn(
        counsellingSessionTokens.shellPage,
        'staff-page-fit h-full overflow-hidden gap-1 px-2.5 pb-1 pt-0.5',
        'min-[1600px]:gap-2 min-[1600px]:px-4 min-[1600px]:pb-4 min-[1600px]:pt-2',
      )}
    >
      <header className="flex shrink-0 flex-col justify-center gap-0.5 px-0.5 py-0 leading-none min-[1600px]:py-0.5">
        <h1 className="staff-page-title font-semibold tracking-tight text-counselling-foreground max-[1599px]:text-base max-[1599px]:leading-5 min-[1600px]:text-[1.375rem]">
          Waiting List
        </h1>
        <p className="text-[11px] leading-4 text-counselling-muted-foreground min-[1600px]:text-xs min-[1600px]:leading-5">
          Shared counselling queue · scan, filter, then act
        </p>
      </header>

      <WaitingListSummaryWidget
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabCounts={tabCounts}
      />

      <WaitingListQueueWidget
        className="min-h-0 flex-1"
        title={resolveWaitingListQueueTitle(activeTab)}
        count={queueCount}
        mode={isOtTab ? 'ot-returned' : 'counselling'}
        isLoading={queueLoading}
        isEmpty={queueEmpty}
        emptyContent={emptyContent}
        isRefreshing={!isOtTab && isRefreshing}
        toolbar={
          <WaitingListFilterToolbar
            quickSearch={quickSearch}
            onQuickSearchChange={setQuickSearch}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onApply={handleSearch}
            onReset={handleReset}
            ownerFilter={ownerFilter}
            onOwnerFilterChange={setOwnerFilter}
            hasActiveFilters={hasActiveFilters}
            onAddPatient={() => setIsAddModalOpen(true)}
            appliedFromDate={appliedFilters.fromDate}
            appliedToDate={appliedFilters.toDate}
          />
        }
        footer={
          !queueEmpty && !queueLoading ? (
            <WaitingListQueuePagination
              page={page}
              pageSize={pageSize}
              totalCount={queueCount}
              onPageChange={setPage}
              onPageSizeChange={handlePageSizeChange}
              isRefreshing={!isOtTab && isRefreshing}
            />
          ) : undefined
        }
      >
        {isOtTab
          ? pagedOtRows.map((row, idx) => {
              const otPatient = toOtReturnedWaitingListPatient(
                row,
                (page - 1) * pageSize + idx,
              );
              return (
                <WaitingListWorkRow
                  key={row.id}
                  patient={otPatient}
                  isSelected={selectedId === otPatient.id}
                  activeTab={activeTab}
                  hasCcmsCase={false}
                  currentUserId={user?.id}
                  onRowClick={(p) => {
                    if (row.needsSessionCreate) return;
                    handleRowClick(p);
                  }}
                  onDemographics={handleDemographics}
                  onPreAuth={handlePreAuth}
                  onAssign={handleAssignOpen}
                  onReassign={handleReassignOpen}
                  onLifecycleAction={handleLifecycleAction}
                  canAssign={canAssign}
                  canReassign={canReassign}
                  otReturnReason={row.otReturnReason}
                  onOtStartCounselling={
                    row.needsSessionCreate
                      ? () => {
                          void handleStartOtReturnedCounselling(row);
                        }
                      : undefined
                  }
                  otStartPending={startCounsellingJourneyId === row.id}
                  data-testid="waiting-list-ot-returned-row"
                />
              );
            })
          : pagedPatients.map((patient) => {
              const { hasCcmsCase, ccmsState } = ccmsPropsFromBadge(ccmsBadges[patient.id]);
              return (
                <WaitingListWorkRow
                  key={patient.id}
                  patient={patient}
                  isSelected={selectedId === patient.id}
                  activeTab={activeTab}
                  hasCcmsCase={hasCcmsCase}
                  ccmsState={ccmsState}
                  currentUserId={user?.id}
                  onRowClick={handleRowClick}
                  onDemographics={handleDemographics}
                  onPreAuth={handlePreAuth}
                  onAssign={handleAssignOpen}
                  onReassign={handleReassignOpen}
                  onLifecycleAction={handleLifecycleAction}
                  canAssign={canAssign}
                  canReassign={canReassign}
                />
              );
            })}
      </WaitingListQueueWidget>

      <WaitingListPatientDetailSheet
        patient={demographicsPatient}
        open={!!demographicsPatient}
        onClose={() => setDemographicsPatient(null)}
      />

      <WaitingListAssignDialog
        open={!!assignPatient}
        sessionId={assignPatient?.id ?? null}
        patientName={assignPatient?.patientName}
        sessionBranchId={assignPatient?.branchId}
        sessionVersion={assignPatient?.version}
        onOpenChange={(open) => {
          if (!open) setAssignPatient(null);
        }}
        onAssigned={(result) => {
          void handleAssigned(result);
        }}
      />

      <WaitingListReassignDialog
        open={!!reassignPatient}
        sessionId={reassignPatient?.id ?? null}
        patientName={reassignPatient?.patientName}
        currentOwnerId={reassignPatient?.counselorId ?? null}
        currentOwnerName={reassignPatient?.counselorName}
        sessionBranchId={reassignPatient?.branchId}
        sessionVersion={reassignPatient?.version}
        onOpenChange={(open) => {
          if (!open) setReassignPatient(null);
        }}
        onReassigned={() => {
          void handleReassigned();
        }}
        onOwnershipConflict={() => {
          void handleReassigned();
        }}
      />

      <ConfirmationComponent />

      {isAddModalOpen && (
        <AddPatientModal
          isOpen
          onClose={() => setIsAddModalOpen(false)}
          onAdd={handleAddPatient}
          branchId={branchId}
        />
      )}
    </div>
  );
}
