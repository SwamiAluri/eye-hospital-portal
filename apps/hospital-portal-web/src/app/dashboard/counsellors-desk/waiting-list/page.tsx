'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import { counsellingAzureApi } from '@/lib/api/counselling-azure.api';
import { ipManagementApi } from '@/lib/api/ip-management.api';
import type { PatientJourneyRowDto } from '@/lib/api/ip-management.api';
import { useAuthStore } from '@/lib/auth-store';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { WaitingListSummaryWidget } from '@/components/counsellors-desk/waiting-list/WaitingListSummaryWidget';
import {
  WaitingListFilterToolbar,
  WAITING_LIST_STATUS_TABS,
} from '@/components/counsellors-desk/waiting-list/WaitingListFilterToolbar';
import { WaitingListQueueWidget } from '@/components/counsellors-desk/waiting-list/WaitingListQueueWidget';
import { WaitingListQueuePagination } from '@/components/counsellors-desk/waiting-list/WaitingListQueuePagination';
import { WaitingListWorkRow } from '@/components/counsellors-desk/waiting-list/WaitingListWorkRow';
import { WaitingListOtReturnedRow } from '@/components/counsellors-desk/waiting-list/WaitingListOtReturnedRow';
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
import {
  WAITING_LIST_DEFAULT_PAGE_SIZE,
  getWaitingListTotalPages,
  sliceWaitingListPage,
  type WaitingListPageSize,
} from '@/lib/counsellors-desk/waiting-list-pagination';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { COUNSELLING_SESSIONS_READ_PERMISSION } from '@/lib/counsellors-desk/counselling-auth';
import type { WaitingListPatient, WaitingListFilters, AddPatientFormData } from '@/types/counsellors-desk';
import { cn } from '@/lib/utils';

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
  const { invalidateWaitingList } = useInvalidateCounsellorsDesk();
  const { user, selectedBranchId } = useAuthStore();

  const [otReturnedRows, setOtReturnedRows]  = useState<PatientJourneyRowDto[]>([]);
  const [otReturnedLoading, setOtReturnedLoading] = useState(false);
  const [activeTab, setActiveTab]           = useState('All');
  const [selectedId, setSelectedId]         = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [quickSearch, setQuickSearch]       = useState('');
  const debouncedQuickSearch = useDebouncedValue(quickSearch, 300);
  const [demographicsPatient, setDemographicsPatient] = useState<WaitingListPatient | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<WaitingListPageSize>(WAITING_LIST_DEFAULT_PAGE_SIZE);

  const [filters, setFilters] = useState<WaitingListFilters>({
    fromDate: '', toDate: '', patientName: '', mrd: '', type: 'All', status: '',
  });
  /** Date / name / MRD sent to API after Apply. Type is client-side only (§6). */
  const [appliedFilters, setAppliedFilters] = useState<WaitingListFilters>({
    fromDate: '', toDate: '', patientName: '', mrd: '', type: 'All', status: '',
  });

  const apiFilters = useMemo(
    (): WaitingListFilters => ({
      ...appliedFilters,
      type: 'All',
      branchId: selectedBranchId ?? user?.branchId ?? undefined,
    }),
    [appliedFilters, selectedBranchId, user?.branchId],
  );

  const waitingListQuery = useWaitingListQuery(apiFilters);
  const patients = useMemo(() => waitingListQuery.data ?? [], [waitingListQuery.data]);
  const isLoading = waitingListQuery.isLoading && patients.length === 0;
  const isRefreshing = waitingListQuery.isFetching && patients.length > 0;

  const branchId = selectedBranchId ?? user?.branchId;

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
        setOtReturnedRows(rows.filter((r) => !!r.otReturnReason));
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
  }, [branchId]);

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

  const handleSearch = () => {
    // Apply date / name / MRD only — type already filters immediately client-side.
    setAppliedFilters({
      ...filters,
      type: 'All',
    });
  };

  const handleReset = () => {
    const blank: WaitingListFilters = {
      fromDate: '', toDate: '', patientName: '', mrd: '', type: 'All', status: '',
    };
    setFilters(blank);
    setAppliedFilters(blank);
    setQuickSearch('');
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
        isPreAuthQueueRow,
      }),
    [patients, filters.type, activeTab, debouncedQuickSearch, appliedFilters.patientName, appliedFilters.mrd, isPreAuthQueueRow],
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
    if (!branchId) {
      toast.error('Branch is required to add a patient to the waiting list');
      throw new Error('Branch is required');
    }
    try {
      const added = await counsellorsDeskApi.addPatientToWaitingList(data, { branchId });
      setActiveTab('Pending');
      setQuickSearch('');
      setFilters((f) => ({ ...f, type: 'All', patientName: '', mrd: '' }));
      setAppliedFilters({
        fromDate: '', toDate: '', patientName: '', mrd: '', type: 'All', status: '',
      });
      await invalidateWaitingList();
      await refetchWaitingList();
      toast.success(`${added.patientName} scheduled for counselling — check Pending (${added.uhid})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to schedule counselling';
      toast.error(message);
      throw err;
    }
  };

  const handleRowClick = useCallback((patient: WaitingListPatient) => {
    setSelectedId(patient.id);
    if (patient.status === 'Pending' || patient.status === 'RepeatCounselling') {
      counsellingAzureApi.start(patient.id);
    }
    router.push(`/dashboard/counsellors-desk/${patient.id}`);
  }, [router]);

  const handleDemographics = useCallback((patient: WaitingListPatient) => {
    setDemographicsPatient(patient);
  }, []);

  const handlePreAuth = useCallback((patientId: string) => {
    router.push(`/dashboard/counsellors-desk/${patientId}?tab=coverage&subtab=preauth`);
  }, [router]);

  const hasActiveFilters = !!(
    appliedFilters.fromDate || appliedFilters.toDate ||
    filters.type !== 'All'
  );

  const isOtTab = activeTab === 'OtReturned';
  const queueCount = isOtTab ? otReturnedRows.length : filtered.length;
  const queueLoading = isOtTab ? otReturnedLoading : isLoading;
  const queueEmpty = isOtTab ? !otReturnedLoading && otReturnedRows.length === 0 : !isLoading && filtered.length === 0;

  // Reset to page 1 when the visible queue scope changes (client-side pagination only).
  useEffect(() => {
    setPage(1);
  }, [activeTab, filters.type, debouncedQuickSearch, appliedFilters.patientName, appliedFilters.mrd, pageSize]);

  useEffect(() => {
    const totalPages = getWaitingListTotalPages(queueCount, pageSize);
    if (page > totalPages) setPage(totalPages);
  }, [queueCount, pageSize, page]);

  const pagedPatients = useMemo(
    () => sliceWaitingListPage(filtered, page, pageSize),
    [filtered, page, pageSize],
  );
  const pagedOtRows = useMemo(
    () => sliceWaitingListPage(otReturnedRows, page, pageSize),
    [otReturnedRows, page, pageSize],
  );

  const emptyContent = isOtTab ? (
    <>
      <p className="text-sm font-medium text-counselling-foreground">No OT-returned patients</p>
      <p className="max-w-sm text-xs leading-relaxed text-counselling-muted-foreground">
        Empty until OT returns a patient with a reason to Ready for Surgery.
      </p>
    </>
  ) : (
    <>
      <p className="text-sm font-medium text-counselling-foreground">
        {activeTab === 'RepeatCounselling'
          ? 'No repeat counselling patients'
          : 'No patients match your filters or search'}
      </p>
      <p className="max-w-md text-xs leading-relaxed text-counselling-muted-foreground">
        {activeTab === 'RepeatCounselling'
          ? 'Create via session: Patient Decision → Not Interested or Needs Time → Save Session.'
          : 'Try adjusting your filters or search'}
      </p>
    </>
  );

  const handlePageSizeChange = useCallback((next: WaitingListPageSize) => {
    setPageSize(next);
    setPage(1);
  }, []);

  return (
    <div
      className={cn(
        counsellingSessionTokens.shellPage,
        'staff-page-fit h-full overflow-hidden gap-0.5 px-2.5 pb-1 pt-0.5',
        'min-[1600px]:gap-2.5 min-[1600px]:px-4 min-[1600px]:pb-4 min-[1600px]:pt-2.5',
      )}
    >
      <header className="flex shrink-0 flex-col justify-center px-0.5 py-0 leading-none min-[1600px]:py-0.5">
        <h1 className="staff-page-title font-semibold tracking-tight text-counselling-foreground max-[1599px]:text-base max-[1599px]:leading-5 min-[1600px]:text-[1.375rem]">
          Waiting List
        </h1>
      </header>

      <WaitingListSummaryWidget
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabCounts={tabCounts}
      />

      <WaitingListQueueWidget
        className="min-h-0 flex-1"
        title={isOtTab ? 'OT Returned' : activeTab === 'PreAuthQueue' ? 'Pre-Auth Queue' : 'Patient Queue'}
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
            onFiltersChange={setFilters}
            onApply={handleSearch}
            onReset={handleReset}
            hasActiveFilters={hasActiveFilters}
            onAddPatient={() => setIsAddModalOpen(true)}
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
          ? pagedOtRows.map((row, idx) => (
              <WaitingListOtReturnedRow
                key={row.id}
                row={row}
                index={(page - 1) * pageSize + idx}
                onNavigate={(href) => router.push(href)}
              />
            ))
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
                  onRowClick={handleRowClick}
                  onDemographics={handleDemographics}
                  onPreAuth={handlePreAuth}
                />
              );
            })}
      </WaitingListQueueWidget>

      <WaitingListPatientDetailSheet
        patient={demographicsPatient}
        open={!!demographicsPatient}
        onClose={() => setDemographicsPatient(null)}
      />

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
