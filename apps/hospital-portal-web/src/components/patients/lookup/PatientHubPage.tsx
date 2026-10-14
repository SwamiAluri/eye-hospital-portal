"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Download,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { counsellingSessionTokens } from "@/lib/counsellors-desk/counselling-session-tokens";
import { toast } from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { AddPatientDialog } from "@/components/patients/AddPatientDialog";
import { PatientRegistrationSuccessDialog } from "@/components/patients/PatientRegistrationSuccessDialog";
import { PatientRegistrationCardSurfaceDialog } from "@/components/patients/PatientRegistrationCardSurfaceDialog";
import type { RegistrationSuccessPatient } from "@/components/patients/PatientRegistrationSuccessDialog";
import { regLife } from "@/lib/patients/registration-lifecycle-telemetry";
import { PatientHubClassificationTabs } from "@/components/patients/lookup/PatientHubClassificationTabs";
import { PatientHubPagination } from "@/components/patients/lookup/PatientHubPagination";
import { PatientHubEmptyBranch } from "@/components/patients/lookup/PatientHubEmptyBranch";
import { PatientHubTable } from "@/components/patients/lookup/PatientHubTable";
import { PatientPreviewDrawer } from "@/components/patients/lookup/PatientPreviewDrawer";
import { PatientPreviewSplitPane } from "@/components/patients/lookup/PatientPreviewSplitPane";
import { PatientDirectorySearch } from "@/components/patients/lookup/PatientDirectorySearch";
import { PatientDirectoryToolbarFilters } from "@/components/patients/lookup/PatientDirectoryToolbarFilters";
import { PatientHubMobileCards } from "@/components/patients/lookup/PatientHubMobileCards";
import { useBranchContext } from "@/hooks/use-branch-context";
import { usePatientHubPreviewMode } from "@/hooks/use-patient-hub-preview-mode";
import { useHasPermission } from "@/hooks/use-permissions";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  patientLookupKeys,
  usePatientLookupQuery,
  usePatientLookupStatsQuery,
} from "@/hooks/use-patient-lookup-queries";
import { useOptionalPatientWorkspace } from "@/components/patients/record/PatientWorkspaceProvider";
import { usePatientHubRealtime } from "@/hooks/use-patient-hub-realtime";
import { patientLookupApi } from "@/lib/api/patient-lookup.api";
import { resolveCreatedPatientPreviewRow } from "@/lib/patients/created-patient-preview-handoff";
import {
  countActiveFilters,
  parseLookupUrlParams,
  toPatientLookupFilters,
  type PatientLookupSortBy,
  type PatientLookupUrlState,
} from "@/lib/patients/patient-lookup-filters";
import { patientLookupTestIds } from "@/lib/patients/patient-lookup-test-ids";
import {
  readDirectoryUrlStateFromLocation,
  replaceDirectoryUrlState,
  shouldHydrateSearchFromUrl,
} from "@/lib/patients/patient-directory-url-sync";
import { savePatientRecordNav } from "@/lib/patients/patient-record-nav";
import type {
  PatientLookupRow,
  PatientLookupTab,
} from "@/types/patient-lookup";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

export default function PatientHubPage() {
  const workspace = useOptionalPatientWorkspace();
  const searchParams = useSearchParams();
  const { branchId, branches, isReady, isLoading: branchLoading } = useBranchContext();
  const canExport = useHasPermission("patient.export");
  const canCreate = useHasPermission("patient.create");
  const queryClient = useQueryClient();
  const [addPatientOpen, setAddPatientOpen] = useState(false);
  /** Dedicated post-create surfaces — never nested in Register New Patient. */
  const [registrationSuccessPatient, setRegistrationSuccessPatient] =
    useState<RegistrationSuccessPatient | null>(null);
  const [registrationCardOpen, setRegistrationCardOpen] = useState(false);
  /** Preview handoff runs only on Success Close (not when registration dialog ends). */
  const createdHandoffPatientId = useRef<string | null>(null);
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
  const searchFocusedRef = useRef(false);
  const searchHasQuery = search.trim().length >= 2;
  const [previewPatient, setPreviewPatient] = useState<PatientLookupRow | null>(
    null,
  );
  const [exporting, setExporting] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 300);
  const urlStateRef = useRef(urlState);
  urlStateRef.current = urlState;
  const debouncedSearchRef = useRef(debouncedSearch);
  debouncedSearchRef.current = debouncedSearch;

  /** Hydrate from Next searchParams only when search is not being typed. */
  useEffect(() => {
    const parsed = parseLookupUrlParams(searchParams);
    setUrlState(parsed);
    setSearch((current) =>
      shouldHydrateSearchFromUrl({
        searchFocused: searchFocusedRef.current,
        localSearch: current,
        urlQ: parsed.q,
      })
        ? (parsed.q ?? "")
        : current,
    );
  }, [searchParams]);

  /** Back/forward: restore Directory URL without Next.js client navigation remounts. */
  useEffect(() => {
    const onPopState = () => {
      const parsed = readDirectoryUrlStateFromLocation();
      setUrlState(parsed);
      setSearch(parsed.q ?? "");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const syncUrl = (next: PatientLookupUrlState) => {
    replaceDirectoryUrlState({
      ...next,
      q: debouncedSearchRef.current || next.q,
    });
  };

  const applyState = (next: PatientLookupUrlState) => {
    setUrlState(next);
    syncUrl(next);
  };

  useEffect(() => {
    if (debouncedSearch !== (urlStateRef.current.q ?? "")) {
      applyState({
        ...urlStateRef.current,
        q: debouncedSearch || undefined,
        page: 1,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const filters = toPatientLookupFilters(urlState, {
    branchId: branchId ?? "",
    pageSize: PAGE_SIZE,
    q: debouncedSearch || undefined,
  });

  const currentSort: PatientLookupSortBy = urlState.sortBy ?? "name";
  const currentSortDir = urlState.sortDir ?? "asc";

  const handleSort = (sortKey: PatientLookupSortBy) => {
    const nextDir =
      currentSort === sortKey && currentSortDir === "asc" ? "desc" : "asc";
    applyState({ ...urlState, sortBy: sortKey, sortDir: nextDir, page: 1 });
  };

  const lookupQuery = usePatientLookupQuery(filters, isReady);
  const statsQuery = usePatientLookupStatsQuery(branchId, isReady);

  const stats = statsQuery.data;
  const tabCounts: Record<PatientLookupTab, number | undefined> = {
    all: stats?.all,
    current: stats?.current,
    new: stats?.new,
    discharged: stats?.discharged,
    high_priority: stats?.highPriority,
  };

  const rows = lookupQuery.data?.items ?? [];
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const totalPages = lookupQuery.data?.totalPages ?? 1;
  const totalCount = lookupQuery.data?.totalCount ?? 0;
  const previewId = urlState.previewPatientId;
  const activeFilterCount = countActiveFilters(urlState);
  const emptyTitle = searchHasQuery
    ? "No patients found"
    : activeFilterCount > 0
      ? "No patients match your filters."
      : "No patients in this census.";
  const emptyHint = searchHasQuery
    ? "Try another name, MRN, phone number, or email."
    : undefined;
  const previewOpen = !!previewPatient;
  const showDockedPreview = previewOpen && isDocked && canDock;
  const showFloatingPreview = previewOpen && isFloating;

  useEffect(() => {
    if (!previewId) {
      setPreviewPatient(null);
      return;
    }
    const row = rows.find((r) => r.id === previewId);
    if (row) {
      setPreviewPatient(row);
      return;
    }
    // Keep an already-opened Preview for this id when the patient is outside
    // the current filtered lookup page (post-registration handoff).
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
    applyState({ ...urlStateRef.current, previewPatientId: row.id });
  };

  const closePreview = () => {
    setPreviewPatient(null);
    applyState({ ...urlStateRef.current, previewPatientId: null });
  };

  /**
   * Post-registration handoff: open existing Preview for created patient.id.
   * Preserves current search/filter URL state. Uses existing summary when the
   * patient is outside the current filtered lookup page.
   */
  const openCreatedPatientPreview = async (patientId: string) => {
    const id = patientId.trim();
    if (!id || !branchId) return;

    const currentRows = rowsRef.current;
    const fromList = currentRows.find((row) => row.id === id);
    if (fromList) {
      openPreview(fromList);
      return;
    }

    try {
      const summary = await patientLookupApi.getSummary(id, branchId, {
        skipPhiAudit: true,
      });
      const resolved = resolveCreatedPatientPreviewRow({
        createdPatientId: id,
        rows: currentRows,
        summary,
      });
      if (resolved) openPreview(resolved);
    } catch {
      toast.error("Patient created. Preview could not open — search by MRN if needed.");
    }
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
      <div
        className={cn(counsellingSessionTokens.shellPage, "staff-page-fit")}
        data-testid={patientLookupTestIds.page}
      >
        <div
          className="flex flex-1 flex-col items-center justify-center gap-1 px-4 py-12 text-center"
          role="status"
        >
          <p className="inline-flex items-center gap-2 text-sm font-medium text-counselling-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading patients…
          </p>
        </div>
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

  /** Match Search / Gender / DOB control height; counselling outline avoids grey Button clash. */
  const toolbarOutlineButton = cn(
    "h-9 min-h-9 px-2.5 text-xs font-medium shadow-none",
    "border-counselling-border bg-counselling-card text-counselling-foreground",
    "hover:bg-counselling-muted/50 active:bg-counselling-muted/70",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-counselling-primary/30",
  );

  return (
    <div
      className={cn(
        counsellingSessionTokens.shellPage,
        "staff-page-fit h-full gap-2 px-2.5 pb-1 pt-0",
        "min-[1600px]:gap-2.5 min-[1600px]:px-4 min-[1600px]:pb-4",
      )}
      data-testid={patientLookupTestIds.page}
    >
      <div
        className="flex flex-wrap items-center gap-2 px-0.5 py-0.5"
        data-testid={patientLookupTestIds.toolbar}
      >
        <PatientDirectorySearch
          value={search}
          onChange={setSearch}
          onFocusChange={(focused) => {
            searchFocusedRef.current = focused;
          }}
        />
        <PatientDirectoryToolbarFilters state={urlState} onApply={applyState} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              applyState({
                branchId: urlState.branchId,
                tab: urlState.tab,
                q: urlState.q,
                previewPatientId: urlState.previewPatientId,
                page: 1,
              })
            }
            className={toolbarOutlineButton}
            data-testid={patientLookupTestIds.filterClear}
            aria-label="Clear filters"
          >
            Clear
          </Button>
          {canExport && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting}
              className={toolbarOutlineButton}
              data-testid={patientLookupTestIds.exportCsv}
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              lookupQuery.refetch();
              statsQuery.refetch();
            }}
            className={toolbarOutlineButton}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", lookupQuery.isFetching && "animate-spin")}
            />
            Refresh
          </Button>
          {lookupQuery.isFetching && (
            <span className="text-xs text-counselling-muted-foreground" role="status">
              Updating…
            </span>
          )}
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 gap-2.5 overflow-hidden">
        <section
          className={cn(
            counsellingSessionTokens.sessionWidget,
            "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
          )}
          aria-label="Patient directory worklist"
        >
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-counselling-border/50 px-2.5 py-1.5 sm:px-3">
            <PatientHubClassificationTabs
              activeTab={urlState.tab ?? "all"}
              tabCounts={tabCounts}
              onTabChange={(tab) => applyState({ ...urlState, tab, page: 1 })}
            />
            {canCreate && (
              <button
                type="button"
                onClick={() => {
                  regLife("HUB_SET_ADD_PATIENT_OPEN", {
                    next: true,
                    source: "census-bar",
                  });
                  setAddPatientOpen(true);
                }}
                className={cn(
                  counsellingSessionTokens.pillTab,
                  counsellingSessionTokens.pillTabCurrent,
                  "shrink-0 gap-1",
                )}
                data-testid={patientLookupTestIds.addPatient}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add Patient
              </button>
            )}
          </div>
          <div
            className="min-h-0 flex-1 overflow-auto overscroll-contain"
            data-testid={patientLookupTestIds.worklistScroll}
          >
            <PatientHubMobileCards
              rows={rows}
              previewId={previewId}
              isLoading={lookupQuery.isLoading}
              isError={lookupQuery.isError}
              isReady={isReady}
              onRowClick={handleRowClick}
              onOpenProfile={rememberNavForPatient}
              emptyTitle={emptyTitle}
              emptyHint={emptyHint}
            />
            <PatientHubTable
              rows={rows}
              previewId={previewId}
              isLoading={lookupQuery.isLoading}
              isError={lookupQuery.isError}
              isReady={isReady}
              currentSort={currentSort}
              currentSortDir={currentSortDir}
              onSort={handleSort}
              compactColumns={showDockedPreview || !canDock}
              onRowClick={handleRowClick}
              onOpenProfile={rememberNavForPatient}
              emptyTitle={emptyTitle}
              emptyHint={emptyHint}
            />
          </div>
          <div
            className="shrink-0 border-t border-counselling-border/50 bg-counselling-card px-2.5 py-1.5 sm:px-3"
            data-testid={patientLookupTestIds.worklistFooter}
          >
            <PatientHubPagination
              currentPage={urlState.page ?? 1}
              pageSize={PAGE_SIZE}
              totalCount={totalCount}
              totalPages={totalPages}
              onPageChange={(page) => applyState({ ...urlState, page })}
              className="mt-0"
            />
          </div>
        </section>

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

      <AddPatientDialog
        open={addPatientOpen}
        onOpenChange={(next) => {
          regLife("HUB_SET_ADD_PATIENT_OPEN", {
            next,
            source: "dialog-onOpenChange",
            prev: addPatientOpen,
          });
          setAddPatientOpen(next);
          // Preview is owned by Success Close — do not open Preview merely because
          // the registration dialog closed after a successful create.
        }}
        onCreated={() => {
          void queryClient.invalidateQueries({ queryKey: patientLookupKeys.all });
        }}
        onRegistrationComplete={(patient) => {
          createdHandoffPatientId.current = patient.id;
          setRegistrationCardOpen(false);
          setRegistrationSuccessPatient({
            id: patient.id,
            firstName: patient.firstName,
            lastName: patient.lastName,
            dateOfBirth: patient.dateOfBirth,
            gender: patient.gender,
            contactNumber: patient.contactNumber,
            bloodGroup: patient.bloodGroup,
            emergencyContactName: patient.emergencyContactName,
            emergencyContactPhone: patient.emergencyContactPhone,
            medicalRecordNumber: patient.medicalRecordNumber,
            photoUrl: patient.photoUrl,
            address: patient.address,
          });
          void queryClient.invalidateQueries({ queryKey: patientLookupKeys.all });
        }}
      />

      <PatientRegistrationSuccessDialog
        open={Boolean(registrationSuccessPatient) && !registrationCardOpen}
        patient={registrationSuccessPatient}
        onOpenChange={(next) => {
          if (!next) {
            const handoffId =
              createdHandoffPatientId.current ?? registrationSuccessPatient?.id ?? null;
            createdHandoffPatientId.current = null;
            setRegistrationSuccessPatient(null);
            setRegistrationCardOpen(false);
            if (handoffId) void openCreatedPatientPreview(handoffId);
          }
        }}
        onPrintRegistrationCard={() => setRegistrationCardOpen(true)}
        onClose={() => {
          const handoffId =
            createdHandoffPatientId.current ?? registrationSuccessPatient?.id ?? null;
          createdHandoffPatientId.current = null;
          setRegistrationSuccessPatient(null);
          setRegistrationCardOpen(false);
          if (handoffId) void openCreatedPatientPreview(handoffId);
        }}
      />

      <PatientRegistrationCardSurfaceDialog
        open={Boolean(registrationSuccessPatient) && registrationCardOpen}
        patient={registrationSuccessPatient}
        onOpenChange={(next) => {
          if (!next) setRegistrationCardOpen(false);
        }}
        onClose={() => setRegistrationCardOpen(false)}
      />

    </div>
  );
}
