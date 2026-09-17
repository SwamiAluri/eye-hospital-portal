"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Download,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Star,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "react-hot-toast";
import PatientFormModal from "@/components/patients/PatientFormModal";
import { PatientAdvancedFilterSheet } from "@/components/patients/lookup/PatientAdvancedFilterSheet";
import { PatientHubClassificationTabs } from "@/components/patients/lookup/PatientHubClassificationTabs";
import { PatientHubPagination } from "@/components/patients/lookup/PatientHubPagination";
import { PatientFilterChips } from "@/components/patients/lookup/PatientFilterChips";
import { PatientHubEmptyBranch } from "@/components/patients/lookup/PatientHubEmptyBranch";
import { PatientHubSelectionBar } from "@/components/patients/lookup/PatientHubSelectionBar";
import { PatientHubTable } from "@/components/patients/lookup/PatientHubTable";
import { PatientPreviewDrawer } from "@/components/patients/lookup/PatientPreviewDrawer";
import { PatientPreviewSplitPane } from "@/components/patients/lookup/PatientPreviewSplitPane";
import { PatientSearchAutosuggest } from "@/components/patients/lookup/PatientSearchAutosuggest";
import { PatientHubMobileCards } from "@/components/patients/lookup/PatientHubMobileCards";
import { useBranchContext } from "@/hooks/use-branch-context";
import { usePatientHubPreviewMode } from "@/hooks/use-patient-hub-preview-mode";
import { useHasPermission } from "@/hooks/use-permissions";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  usePatientLookupQuery,
  usePatientLookupStatsQuery,
  useTogglePatientFavoriteMutation,
} from "@/hooks/use-patient-lookup-queries";
import { useOptionalPatientWorkspace } from "@/components/patients/record/PatientWorkspaceProvider";
import { usePatientHubRealtime } from "@/hooks/use-patient-hub-realtime";
import { patientLookupApi } from "@/lib/api/patient-lookup.api";
import {
  buildLookupUrlParams,
  countActiveFilters,
  parseLookupUrlParams,
  type PatientLookupSortBy,
  type PatientLookupUrlState,
} from "@/lib/patients/patient-lookup-filters";
import { patientLookupTestIds } from "@/lib/patients/patient-lookup-test-ids";
import { savePatientRecordNav } from "@/lib/patients/patient-record-nav";
import { patientProfileUrl } from "@/lib/patients/patient-routes";
import type {
  PatientLookupRow,
  PatientLookupTab,
  PatientRecentViewEntry,
} from "@/types/patient-lookup";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

export default function PatientHubPage() {
  const workspace = useOptionalPatientWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { branchId, branches, isReady, isLoading: branchLoading } = useBranchContext();
  const canExport = useHasPermission("patient.export");
  usePatientHubRealtime(branchId, isReady);
  const {
    mode: previewMode,
    toggleMode: togglePreviewMode,
    canDock,
    isDocked,
    isFloating,
  } = usePatientHubPreviewMode();

  const [urlState, setUrlState] = useState<PatientLookupUrlState>(() =>
    parseLookupUrlParams(searchParams),
  );
  const [search, setSearch] = useState(urlState.q ?? "");
  const [filterOpen, setFilterOpen] = useState(false);
  const [previewPatient, setPreviewPatient] = useState<PatientLookupRow | null>(
    null,
  );
  const [exporting, setExporting] = useState(false);
  const [addPatientOpen, setAddPatientOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    setUrlState(parseLookupUrlParams(searchParams));
    setSearch(parseLookupUrlParams(searchParams).q ?? "");
  }, [searchParams]);

  const syncUrl = (next: PatientLookupUrlState) => {
    const params = buildLookupUrlParams({
      ...next,
      q: debouncedSearch || next.q,
    });
    const qs = params.toString();
    router.replace(qs ? `/dashboard/patients?${qs}` : "/dashboard/patients", {
      scroll: false,
    });
  };

  const applyState = (next: PatientLookupUrlState) => {
    setUrlState(next);
    syncUrl(next);
  };

  useEffect(() => {
    if (debouncedSearch !== (urlState.q ?? "")) {
      applyState({ ...urlState, q: debouncedSearch || undefined, page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const filters = {
    branchId: branchId ?? "",
    q: debouncedSearch || undefined,
    tab: urlState.tab ?? "all",
    page: urlState.page ?? 1,
    pageSize: PAGE_SIZE,
    sortBy: urlState.sortBy ?? "name",
    sortDir: urlState.sortDir ?? "asc",
    favoritesOnly: urlState.favoritesOnly,
    assignedToMe: urlState.assignedToMe,
    engagementTypes: urlState.engagementTypes,
    programCodes: urlState.programCodes,
    patientTypes: urlState.patientTypes,
    gender: urlState.gender,
    mrn: urlState.mrn,
    phone: urlState.phone,
  };

  const currentSort: PatientLookupSortBy = urlState.sortBy ?? "name";
  const currentSortDir = urlState.sortDir ?? "asc";

  const handleSort = (sortKey: PatientLookupSortBy) => {
    const nextDir =
      currentSort === sortKey && currentSortDir === "asc" ? "desc" : "asc";
    applyState({ ...urlState, sortBy: sortKey, sortDir: nextDir, page: 1 });
  };

  const lookupQuery = usePatientLookupQuery(filters, isReady);
  const statsQuery = usePatientLookupStatsQuery(branchId, isReady);
  const favoriteMutation = useTogglePatientFavoriteMutation(branchId);

  const stats = statsQuery.data;
  const tabCounts: Record<PatientLookupTab, number | undefined> = {
    all: stats?.all,
    current: stats?.current,
    new: stats?.new,
    discharged: stats?.discharged,
    high_priority: stats?.highPriority,
  };

  const rows = lookupQuery.data?.items ?? [];
  const totalPages = lookupQuery.data?.totalPages ?? 1;
  const totalCount = lookupQuery.data?.totalCount ?? 0;
  const allPageSelected =
    rows.length > 0 && rows.every((row) => selectedIds.has(row.id));
  const somePageSelected = rows.some((row) => selectedIds.has(row.id));
  const previewId = urlState.previewPatientId;
  const activeFilterCount = countActiveFilters(urlState);
  const previewOpen = !!previewPatient;
  const showDockedPreview = previewOpen && isDocked && canDock;
  const showFloatingPreview = previewOpen && isFloating;

  const handleToggleRow = (patientId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(patientId)) next.delete(patientId);
      else next.add(patientId);
      return next;
    });
  };

  const handleToggleAllPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        rows.forEach((row) => next.delete(row.id));
      } else {
        rows.forEach((row) => next.add(row.id));
      }
      return next;
    });
  };

  useEffect(() => {
    setSelectedIds(new Set());
  }, [
    urlState.tab,
    urlState.page,
    debouncedSearch,
    urlState.favoritesOnly,
    urlState.assignedToMe,
    urlState.engagementTypes?.join(","),
    urlState.programCodes?.join(","),
  ]);

  useEffect(() => {
    if (!previewId) {
      setPreviewPatient(null);
      return;
    }
    const row = rows.find((r) => r.id === previewId);
    if (row) setPreviewPatient(row);
  }, [previewId, rows]);

  useEffect(() => {
    if (!lookupQuery.isError) return;
    toast.error("Could not load patients. Please refresh or try again.");
  }, [lookupQuery.isError]);

  useEffect(() => {
    if (rows.length === 0) return;
    const ids = rows.map((r) => r.id);
    if (previewId && ids.includes(previewId)) {
      savePatientRecordNav(ids, previewId);
    }
  }, [rows, previewId]);

  const rememberNavForPatient = (patientId: string) => {
    if (rows.length === 0) return;
    savePatientRecordNav(
      rows.map((r) => r.id),
      patientId,
    );
    const row = rows.find((r) => r.id === patientId);
    if (row && workspace) {
      workspace.touchPatient({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        mrn: row.mrn,
      });
    }
  };

  const openPreview = (row: PatientLookupRow) => {
    setPreviewPatient(row);
    applyState({ ...urlState, previewPatientId: row.id });
  };

  const openPreviewFromRecent = (entry: PatientRecentViewEntry) => {
    setFilterOpen(false);
    openPreview({
      id: entry.patientId,
      firstName: entry.firstName,
      lastName: entry.lastName,
      mrn: entry.mrn,
      photoThumbnailUrl: entry.photoThumbnailUrl,
      dateOfBirth: "",
      gender: "",
      isFavorite: false,
      careProgramCodes: [],
      clinicalAcuity: "low",
      activeEngagements: [],
    });
  };

  const closePreview = () => {
    setPreviewPatient(null);
    applyState({ ...urlState, previewPatientId: null });
  };

  const handleRowClick = (row: PatientLookupRow) => {
    if (previewId === row.id) closePreview();
    else openPreview(row);
  };

  const handleExport = async () => {
    if (!branchId) return;
    try {
      setExporting(true);
      const blob = await patientLookupApi.exportCsv(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `patients-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  if (branchLoading) {
    return (
      <div className="p-6" data-testid={patientLookupTestIds.page}>
        <div className="h-8 w-48 bg-gray-100 rounded-lg animate-pulse mb-6" />
        <div className="h-64 bg-gray-50 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!isReady) {
    return (
      <div
        className="flex flex-col h-full min-h-0 bg-gray-50"
        data-testid={patientLookupTestIds.page}
      >
        <PatientHubEmptyBranch reason={branches.length === 0 ? 'none' : 'select'} />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full min-h-0"
      data-testid={patientLookupTestIds.page}
    >
      <div className="sticky top-0 z-20 shrink-0 border-b border-gray-100 bg-white px-6 pt-6 pb-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              Patients
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {lookupQuery.isFetching
                ? "Updating…"
                : `${totalCount.toLocaleString()} patients`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAddPatientOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition-colors"
              data-testid={patientLookupTestIds.addPatient}
            >
              <Plus className="w-4 h-4" />
              Add Patient
            </button>
            {canExport && (
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-emerald-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-emerald-200 transition-colors disabled:opacity-50"
              data-testid={patientLookupTestIds.exportCsv}
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            )}
            <Link
              href="/dashboard/patients/merge"
              className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-emerald-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-emerald-200 transition-colors"
              data-testid={patientLookupTestIds.mergeLink}
            >
              Merge
            </Link>
            <button
              type="button"
              onClick={() => {
                lookupQuery.refetch();
                statsQuery.refetch();
              }}
              className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-emerald-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-emerald-200 transition-colors"
            >
              <RefreshCw
                className={cn(
                  "w-4 h-4",
                  lookupQuery.isFetching && "animate-spin",
                )}
              />
              Refresh
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <PatientSearchAutosuggest
            branchId={branchId}
            value={search}
            onChange={setSearch}
            onSelectPatient={(patient) => {
              rememberNavForPatient(patient.id);
              router.push(patientProfileUrl(patient.id));
            }}
          />

          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className={cn(
              "inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition-colors",
              activeFilterCount > 0
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "border-gray-200 text-gray-600 hover:border-gray-300",
            )}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-emerald-600 text-white text-xs rounded-full px-1.5 min-w-[1.25rem]">
                {activeFilterCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              applyState({
                ...urlState,
                favoritesOnly: !urlState.favoritesOnly,
                page: 1,
              })
            }
            className={cn(
              "inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition-colors",
              urlState.favoritesOnly
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "border-gray-200 text-gray-600 hover:border-gray-300",
            )}
            data-testid={patientLookupTestIds.favoritesToggle}
          >
            <Star
              className={cn(
                "w-4 h-4",
                urlState.favoritesOnly && "fill-amber-500 text-amber-500",
              )}
            />
            Favorites
          </button>

          <button
            type="button"
            onClick={() =>
              applyState({
                ...urlState,
                assignedToMe: !urlState.assignedToMe,
                page: 1,
              })
            }
            className={cn(
              "inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition-colors",
              urlState.assignedToMe
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "border-gray-200 text-gray-600 hover:border-gray-300",
            )}
            data-testid={patientLookupTestIds.assignedToMeToggle}
          >
            <UserCheck className="w-4 h-4" />
            Assigned to me
          </button>
        </div>

        <PatientFilterChips state={urlState} onChange={applyState} />

        <PatientHubClassificationTabs
          activeTab={urlState.tab ?? "all"}
          tabCounts={tabCounts}
          onTabChange={(tab) => applyState({ ...urlState, tab, page: 1 })}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row overflow-hidden">
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col overflow-auto px-6 py-4",
            showDockedPreview && "xl:overflow-hidden",
          )}
        >
        <div className={cn("min-h-0 flex-1", showDockedPreview && "xl:overflow-auto")}>
        <PatientHubSelectionBar
          count={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
        />

        {!lookupQuery.isLoading && !lookupQuery.isError && rows.length > 0 && (
          <PatientHubMobileCards
            rows={rows}
            previewId={previewId}
            onRowClick={handleRowClick}
            onFavorite={(id) => favoriteMutation.mutate(id)}
            onOpenProfile={rememberNavForPatient}
            onPreview={openPreview}
          />
        )}

        <PatientHubTable
          rows={rows}
          previewId={previewId}
          isLoading={lookupQuery.isLoading}
          isError={lookupQuery.isError}
          isReady={isReady}
          compact={showDockedPreview}
          currentSort={currentSort}
          currentSortDir={currentSortDir}
          selectedIds={selectedIds}
          allPageSelected={allPageSelected}
          somePageSelected={somePageSelected}
          onSort={handleSort}
          onToggleRow={handleToggleRow}
          onToggleAllPage={handleToggleAllPage}
          onRowClick={handleRowClick}
          onFavorite={(id) => favoriteMutation.mutate(id)}
          onOpenProfile={rememberNavForPatient}
          onPreview={openPreview}
        />

        <PatientHubPagination
          currentPage={urlState.page ?? 1}
          pageSize={PAGE_SIZE}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={(page) => applyState({ ...urlState, page })}
        />
        </div>
        </div>

        {showDockedPreview && (
          <PatientPreviewSplitPane
            patient={previewPatient}
            branchId={branchId}
            open={previewOpen}
            onClose={closePreview}
            onOpenProfile={rememberNavForPatient}
            previewMode={previewMode}
            onPreviewModeToggle={togglePreviewMode}
          />
        )}
      </div>

      {showFloatingPreview && (
        <PatientPreviewDrawer
          patient={previewPatient}
          branchId={branchId}
          open={showFloatingPreview}
          onClose={closePreview}
          onOpenProfile={rememberNavForPatient}
          showDockToggle={canDock}
          previewMode={previewMode}
          onPreviewModeToggle={togglePreviewMode}
        />
      )}

      <PatientAdvancedFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        state={urlState}
        onApply={applyState}
        onRecentPatientSelect={openPreviewFromRecent}
      />

      <PatientFormModal
        isOpen={addPatientOpen}
        onClose={() => setAddPatientOpen(false)}
        onSave={() => {
          setAddPatientOpen(false);
          lookupQuery.refetch();
          statsQuery.refetch();
          toast.success("Patient registered");
        }}
      />
    </div>
  );
}
