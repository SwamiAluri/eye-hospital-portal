'use client';

import { useState, useMemo, useCallback, useEffect, useRef, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { StatusChip } from '@/components/ip-management/preop/primitives/StatusChip';
import {
  PatientJourneyRowDto,
  WardDto,
  ipManagementApi,
} from '@/lib/api/ip-management.api';
import { useAuthStore } from '@/lib/auth-store';
import { useIpJourneysQuery } from '@/hooks/use-ip-journeys-query';
import { useIpBillingDashboardQuery } from '@/hooks/use-ip-billing-dashboard-query';
import { deriveCensusDuesKpi } from '@/lib/ip-management/census-dues-kpi';
import { PatientQuickPanel } from '@/components/ip-management/PatientQuickPanel';
import { WardPreOpWorkspaceModal } from '@/components/ip-management/WardPreOpWorkspaceModal';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { IP_DASHBOARD_TABS, matchesIpDashboardTab, matchesIpFinancialFilter, type IpDashboardTab, type IpFinancialFilter } from '@/lib/ip-management/ip-dashboard-tabs';
import { buildCensusAttention, buildIpRowSituation } from '@/lib/ip-management/ip-row-situation';
import {
  censusAgeSex,
  censusClinicalChip,
  censusOtChip,
  censusProcedureLine,
  formatCensusAdmitted,
  formatCensusSlot,
} from '@/lib/ip-management/ip-census-display';
import { resolveCensusTabCount, useCensusTabCountsQuery } from '@/hooks/use-census-tab-counts-query';
import { useCensusPresentation } from '@/hooks/use-census-presentation';
import { parseIpCensusSearchParams, serializeIpCensusSearchParams } from '@/lib/ip-management/ip-census-url';
import { CENSUS_RAIL_WIDTH_PX, censusColumnsVisible } from '@/lib/ip-management/ip-census-layout';
import { isEditableKeyboardTarget, nextCensusIndex } from '@/lib/ip-management/ip-census-keyboard';
import { IP_CENSUS_TEST_IDS } from '@/lib/ip-management/ip-census-test-ids';
import type { PreOpStepKey } from '@/lib/ip-management/preop-steps';
import {
  matchesSlotSession,
  sortIpCensusRows,
  type IpSlotSessionFilter,
} from '@/lib/ip-management/ip-slot-display';
import {
  CENSUS_PAGE_SIZE,
  localDateKey,
  matchesAdmittedCensusFilter,
  matchesCensusSearch,
} from '@/lib/ip-management/ip-census-filters';

function fmtINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(amount);
}

function CensusEmpty({
  noSourceRows,
  onClear,
}: {
  noSourceRows: boolean;
  onClear?: () => void;
}) {
  if (noSourceRows) {
    return (
      <div className="empty" data-testid={IP_CENSUS_TEST_IDS.emptyCensus}>
        <div className="big">No patients on the census</div>
        There are no admissions in this branch for the current range.
      </div>
    );
  }
  return (
    <div className="empty" data-testid={IP_CENSUS_TEST_IDS.emptyFilter}>
      <div className="big">No patients match these filters</div>
      Try adjusting your filters or date range
      {onClear && (
        <div className="mt-3">
          <button type="button" onClick={onClear} className="btn sm ghost">Clear</button>
        </div>
      )}
    </div>
  );
}

function JourneyCells({
  journey,
}: {
  journey: PatientJourneyRowDto;
}) {
  const situation = buildIpRowSituation(journey);
  const attention = buildCensusAttention(journey);
  const slot = formatCensusSlot(journey.slotLabel);
  const clinical = censusClinicalChip(journey.clinicalState);
  const ot = censusOtChip(journey.otState);
  const procedure = censusProcedureLine(journey.procedureName, journey.eyeOperated);
  const ageSex = censusAgeSex(journey.patientDob, journey.patientAge, journey.patientGender);
  const attentionLabel = attention.level === 'information'
    ? attention.label
    : `${attention.level}: ${attention.label}`;
  return (
    <>
      <div role="cell">
        <StatusChip status={clinical.status} label={clinical.label} size="sm" />
      </div>
      <div role="cell">
        <div className="cell-primary">{journey.patientName ?? '—'}</div>
        <div className="cell-sub">{[journey.uhid ?? '—', ageSex].filter(Boolean).join(' · ')}</div>
      </div>
      <div role="cell" title={[procedure.procedure, procedure.laterality].filter(Boolean).join(' · ')}>
        <div className="cell-clip">{procedure.procedure}</div>
        {procedure.laterality ? (
          <div className="cell-sub">{procedure.laterality}</div>
        ) : (
          <div className="cell-sub">Eye not set</div>
        )}
      </div>
      <div role="cell" title={[journey.wardName, journey.bedNumber].filter(Boolean).join(' · ') || '—'}>
        {[journey.wardName, journey.bedNumber].filter(Boolean).join(' · ') || '—'}
      </div>
      <div
        role="cell"
        data-testid={IP_CENSUS_TEST_IDS.slotCell(journey.id)}
        className={slot.unassigned ? 'muted' : 'num'}
      >
        {slot.text}
      </div>
      <div role="cell" className="cell-sub">
        {formatCensusAdmitted(journey.admittedAt)}
      </div>
      <div role="cell">
        <StatusChip status={ot.status} label={ot.label} size="sm" />
      </div>
      <div role="cell" data-testid={IP_CENSUS_TEST_IDS.nextAction}>
        <div className="cell-primary">{situation.nextAction}</div>
        <div className="cell-sub">{situation.nextActionOwner}</div>
      </div>
      <div role="cell">
        <span
          data-testid={IP_CENSUS_TEST_IDS.attention}
          className={`badge ${attention.tone}`}
          title={attentionLabel}
        >
          {attention.label}
        </span>
      </div>
    </>
  );
}

function SkeletonRow({ columns }: { columns: number }) {
  return (
    <div className="census-grid census-row" role="row">
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} role="cell">
          <div
            className="h-3.5 bg-gray-100 rounded-full animate-pulse"
            style={{ width: `${40 + (i * 13) % 45}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function IpManagementPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const presentation = useCensusPresentation();
  const { user } = useAuthStore();
  const branchId = user?.branchId;
  const searchRef = useRef<HTMLInputElement>(null);

  const urlState = useMemo(() => parseIpCensusSearchParams(searchParams), [searchParams]);
  const activeTab = urlState.tab;
  const financialFilter = urlState.fin;
  const sessionFilter = urlState.session;
  const patientId = urlState.patient;

  const [filters, setFilters] = useState(() => {
    const today = localDateKey();
    return { fromDate: today, toDate: today, uhid: '', search: '' };
  });
  const [appliedFilters, setAppliedFilters] = useState(() => {
    const today = localDateKey();
    return { fromDate: today, toDate: today, uhid: '', search: '' };
  });
  const [page, setPage] = useState(1);
  const [preopStep, setPreopStep] = useState<PreOpStepKey | null>(null);
  const [wards, setWards] = useState<WardDto[]>([]);

  const journeysQuery = useIpJourneysQuery(
    branchId,
    { fromDate: '', toDate: '', uhid: '', search: '' },
    Boolean(branchId),
  );
  const tabCountsQuery = useCensusTabCountsQuery(branchId, Boolean(branchId));
  const journeys = useMemo(() => journeysQuery.data ?? [], [journeysQuery.data]);
  const showSkeleton = journeysQuery.isPending && journeys.length === 0;
  const loadFailed = journeysQuery.isError && journeys.length === 0;
  const refreshFailed = journeysQuery.isError && journeys.length > 0;
  const isRefreshing = journeysQuery.isFetching && !journeysQuery.isPending;
  const liveLabel = loadFailed || refreshFailed
    ? 'Error'
    : isRefreshing
      ? 'Updating'
      : 'Live';
  const liveTone = loadFailed || refreshFailed ? 'danger' : isRefreshing ? '' : 'ok';

  const duesQuery = useIpBillingDashboardQuery({
    branchId,
    preset: 'this_month',
    customFrom: '',
    customTo: '',
    enabled: Boolean(branchId),
  });
  const duesKpi = deriveCensusDuesKpi({
    isPending: duesQuery.isLoading,
    isError: duesQuery.isError,
    data: duesQuery.data,
  });

  const writeCensusUrl = useCallback((
    patch: Partial<{ tab: IpDashboardTab; patient: string | null; fin: IpFinancialFilter; session: IpSlotSessionFilter }>,
    mode: 'push' | 'replace',
  ) => {
    const next = {
      tab: patch.tab ?? activeTab,
      patient: patch.patient !== undefined ? patch.patient : patientId,
      fin: patch.fin ?? financialFilter,
      session: patch.session ?? sessionFilter,
    };
    const qs = serializeIpCensusSearchParams(next, searchParams);
    const href = qs ? `${pathname}?${qs}` : pathname;
    if (mode === 'push') router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
  }, [activeTab, patientId, financialFilter, sessionFilter, searchParams, pathname, router]);

  const clearPatient = useCallback(() => {
    writeCensusUrl({ patient: null }, 'replace');
  }, [writeCensusUrl]);

  function handleSearch() {
    setAppliedFilters({ ...filters });
  }

  function handleClearFilters() {
    const today = localDateKey();
    const next = { fromDate: today, toDate: today, uhid: '', search: '' };
    setFilters(next);
    setAppliedFilters(next);
  }

  const todayKey = localDateKey();
  const hasActiveFilters =
    appliedFilters.uhid !== ''
    || appliedFilters.search !== ''
    || appliedFilters.fromDate !== todayKey
    || appliedFilters.toDate !== todayKey;

  const scopedJourneys = useMemo(() => journeys.filter(j =>
    matchesAdmittedCensusFilter(j, appliedFilters.fromDate, appliedFilters.toDate)
    && matchesCensusSearch(j, appliedFilters.uhid, appliedFilters.search)
    && matchesIpFinancialFilter(j, financialFilter)
    && matchesSlotSession(j, sessionFilter),
  ), [journeys, appliedFilters, financialFilter, sessionFilter]);

  const displayJourneys = useMemo(() => {
    const filtered = scopedJourneys.filter(j => matchesIpDashboardTab(j, activeTab));
    return sortIpCensusRows(filtered, activeTab);
  }, [scopedJourneys, activeTab]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, financialFilter, sessionFilter, appliedFilters]);

  const pageCount = Math.max(1, Math.ceil(displayJourneys.length / CENSUS_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * CENSUS_PAGE_SIZE;
  const pagedJourneys = displayJourneys.slice(pageStart, pageStart + CENSUS_PAGE_SIZE);
  const showingFrom = displayJourneys.length === 0 ? 0 : pageStart + 1;
  const showingTo = Math.min(pageStart + CENSUS_PAGE_SIZE, displayJourneys.length);

  const selectedJourney = useMemo(
    () => (patientId ? journeys.find(j => j.id === patientId) ?? null : null),
    [journeys, patientId],
  );

  useEffect(() => {
    setPreopStep(null);
  }, [patientId]);

  useEffect(() => {
    if (!preopStep || !branchId) return;
    void ipManagementApi.listWards({ branchId }).then(setWards);
  }, [preopStep, branchId]);

  const visibleColumns = censusColumnsVisible();
  const paneOpen = Boolean(selectedJourney) && presentation !== 'cards';

  const tabCounts = useMemo(() => {
    const map: Partial<Record<IpDashboardTab, number>> = {};
    IP_DASHBOARD_TABS.forEach(({ key }) => {
      map[key] = resolveCensusTabCount(
        scopedJourneys.length === journeys.length ? tabCountsQuery.data : undefined,
        key,
        scopedJourneys.filter(j => matchesIpDashboardTab(j, key)).length,
        scopedJourneys.length,
      );
    });
    return map;
  }, [journeys.length, scopedJourneys, tabCountsQuery.data]);

  const kpiStats = useMemo(() => {
    const inHouse = journeys.filter(j =>
      !['Discharged', 'CancelledSurgery', 'AdmissionCancelled'].includes(j.clinicalState)).length;
    const inOT = journeys.filter(j => ['InOT', 'SentToOT'].includes(j.clinicalState)).length;
    const readyForOt = journeys.filter(j => j.clinicalState === 'ReadyForSurgery').length;
    return { inHouse, inOT, readyForOt };
  }, [journeys]);

  const handleJourneyUpdated = useCallback(() => {
    void journeysQuery.refetch();
  }, [journeysQuery]);

  useEffect(() => {
    if (presentation !== 'cards' || !patientId) return;
    router.replace(`/dashboard/ip-management/journey/${patientId}`);
  }, [presentation, patientId, router]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableKeyboardTarget(e.target)) return;

      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (presentation === 'cards') return;

      if (e.key === 'Escape') {
        if (presentation === 'sheet' && patientId) {
          e.preventDefault();
          clearPatient();
        }
        return;
      }

      const delta = e.key === 'j' || e.key === 'ArrowDown' ? 1
        : e.key === 'k' || e.key === 'ArrowUp' ? -1
        : 0;
      if (delta !== 0) {
        e.preventDefault();
        const current = pagedJourneys.findIndex(j => j.id === patientId);
        const next = nextCensusIndex(current === -1 ? null : current, delta, pagedJourneys.length);
        if (next !== null) {
          writeCensusUrl({ patient: pagedJourneys[next].id }, 'replace');
        }
        return;
      }

      if (e.key === 'Enter') {
        const current = pagedJourneys.findIndex(j => j.id === patientId);
        const target = current >= 0 ? pagedJourneys[current] : pagedJourneys[0];
        if (target) {
          e.preventDefault();
          writeCensusUrl({ patient: target.id }, 'push');
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [presentation, patientId, pagedJourneys, writeCensusUrl, clearPatient]);

  const onRowActivate = (journey: PatientJourneyRowDto) => {
    if (presentation === 'cards') return;
    if (patientId === journey.id) clearPatient();
    else writeCensusUrl({ patient: journey.id }, 'push');
  };

  const panel = selectedJourney ? (
    <PatientQuickPanel
      journey={selectedJourney}
      presentation={presentation === 'sheet' ? 'sheet' : 'docked'}
      onClose={clearPatient}
      onJourneyUpdated={handleJourneyUpdated}
      onOpenPreopStep={setPreopStep}
    />
  ) : null;

  return (
    <div className="ip-target pb-6">
      <div className="frame">
      <div className="app-header">
        <h1>IP Management</h1>
        <span className="scope">Clinical census · billing status is per patient, not a primary filter</span>
        <span className="spacer" />
        <span
          data-testid={IP_CENSUS_TEST_IDS.liveState}
          className={`badge ${liveTone}`.trim()}
          title={refreshFailed ? 'Last refresh failed. Showing last loaded census.' : undefined}
        >
          {liveLabel}
        </span>
        <button
          type="button"
          onClick={() => {
            void journeysQuery.refetch();
            void duesQuery.refetch();
            void tabCountsQuery.refetch();
          }}
          disabled={showSkeleton || isRefreshing}
          className="btn sm"
        >
          ↻ Refresh
        </button>
        <button
          type="button"
          onClick={() => router.push('/dashboard/ip-management/billing')}
          className="btn sm"
        >
          Billing dashboard
        </button>
        <Link href="/dashboard/ip-management/slots" className="btn sm">Slot board</Link>
      </div>

      <div className="kpis">
        <div className="kpi is-inhouse">
          <div className="label">In-house</div>
          <div className="value num">{kpiStats.inHouse}</div>
          <div className="src">patient_journey</div>
        </div>
        <div className="kpi is-ot">
          <div className="label">In OT</div>
          <div className="value num">{kpiStats.inOT}</div>
          <div className="src">patient_journey</div>
        </div>
        <div className="kpi">
          <div className="label">Ready for OT</div>
          <div className="value num">{kpiStats.readyForOt}</div>
          <div className="src">patient_journey</div>
        </div>
        <div
          className={`kpi ${duesKpi.status === 'unavailable' ? 'is-err' : 'is-alert'}`}
          data-testid={IP_CENSUS_TEST_IDS.kpiDues}
        >
          <div className="label">
            Patient dues
            {duesKpi.status === 'ok' && duesKpi.patientsWithDue > 0 ? ` · ${duesKpi.patientsWithDue}` : ''}
          </div>
          <div className="value num">
            {duesKpi.status === 'ok' ? fmtINR(duesKpi.patientOutstanding)
              : duesKpi.status === 'loading' ? '…'
              : '—'}
          </div>
          <div className="src">
            {duesKpi.status === 'ok' ? 'From billing ledger'
              : duesKpi.status === 'loading' ? 'Loading ledger…'
              : (
                <>
                  Dues unavailable ·{' '}
                  <button
                    type="button"
                    className="underline font-semibold"
                    data-testid={IP_CENSUS_TEST_IDS.kpiDuesRetry}
                    onClick={() => void duesQuery.refetch()}
                  >
                    retry
                  </button>
                </>
              )}
          </div>
        </div>
      </div>

      {duesKpi.status === 'unavailable' && (
        <div className="callout warn mx-4 my-3" data-testid={IP_CENSUS_TEST_IDS.kpiDuesCallout}>
          Outstanding amounts cannot be shown right now. Open a patient to collect using Billing. Do not use a substitute total.
        </div>
      )}
      {(loadFailed || refreshFailed) && (
        <div className="callout danger mx-4 my-3" data-testid={IP_CENSUS_TEST_IDS.loadError}>
          {loadFailed ? 'Failed to load the census.' : 'Could not refresh. Showing last loaded patients.'}
          {' '}
          <button
            type="button"
            className="underline font-semibold"
            data-testid={IP_CENSUS_TEST_IDS.loadRetry}
            onClick={() => void journeysQuery.refetch()}
          >
            Retry
          </button>
        </div>
      )}

      <div
        data-testid={IP_CENSUS_TEST_IDS.split}
        className={paneOpen && presentation === 'docked' ? 'split docked' : undefined}
      >
        <div className="list">
          <div className="filters toolbar">
            <label className="filter-field">
              <span>From</span>
              <input
                type="date"
                value={filters.fromDate}
                onChange={e => {
                  const fromDate = e.target.value;
                  setFilters(f => ({ ...f, fromDate }));
                  setAppliedFilters(f => ({ ...f, fromDate }));
                }}
                className="input"
                aria-label="From date"
              />
            </label>
            <label className="filter-field">
              <span>To</span>
              <input
                type="date"
                value={filters.toDate}
                onChange={e => {
                  const toDate = e.target.value;
                  setFilters(f => ({ ...f, toDate }));
                  setAppliedFilters(f => ({ ...f, toDate }));
                }}
                className="input"
                aria-label="To date"
              />
            </label>
            <label className="filter-field">
              <span>UHID</span>
              <input
                type="text"
                value={filters.uhid}
                onChange={e => setFilters(f => ({ ...f, uhid: e.target.value }))}
                placeholder="e.g. UAT-014"
                className="input"
              />
            </label>
            <label className="filter-field grow">
              <span>Search</span>
              <input
                id={IP_CENSUS_TEST_IDS.search}
                ref={searchRef}
                data-testid={IP_CENSUS_TEST_IDS.search}
                type="text"
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Name, procedure, bed…"
                className="input"
              />
            </label>
            <label className="filter-field">
              <span>Slot</span>
              <select
                data-testid={IP_CENSUS_TEST_IDS.sessionFilter}
                value={sessionFilter}
                onChange={e => writeCensusUrl({ session: e.target.value as IpSlotSessionFilter }, 'replace')}
                className="input"
                aria-label="Session"
              >
                <option value="All">All</option>
                <option value="Morning">AM</option>
                <option value="Afternoon">PM</option>
                <option value="Evening">Evening</option>
              </select>
            </label>
            <label className="filter-field">
              <span>Financial</span>
              <select
                value={financialFilter}
                onChange={e => writeCensusUrl({ fin: e.target.value as IpFinancialFilter }, 'replace')}
                className="input"
                aria-label="Financial"
              >
                <option value="All">All</option>
                <option value="HasBalance">Has patient dues</option>
                <option value="Cleared">No dues</option>
                <option value="EmergencyFc">Emergency FC</option>
              </select>
            </label>
            <div className="filter-actions">
              <button type="button" onClick={handleSearch} className="btn sm primary">Search</button>
              {hasActiveFilters && (
                <button type="button" onClick={handleClearFilters} className="btn sm ghost">Clear</button>
              )}
            </div>
          </div>

          <div className="tabs" role="tablist" aria-label="Clinical stage">
            {IP_DASHBOARD_TABS.map(({ key, label }) => {
              const count = tabCounts[key] ?? 0;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === key}
                  onClick={() => writeCensusUrl({ tab: key }, 'replace')}
                  className={`tab ${activeTab === key ? 'active' : ''}`}
                >
                  {label}
                  <span className="count">{count}</span>
                </button>
              );
            })}
          </div>

          {presentation === 'cards' ? (
            <div data-testid={IP_CENSUS_TEST_IDS.cardList} className="divide-y divide-gray-100">
              {showSkeleton ? (
                <p className="px-4 py-8 text-sm text-gray-400">Loading patients…</p>
              ) : loadFailed ? null : displayJourneys.length === 0 ? (
                <CensusEmpty
                  noSourceRows={journeys.length === 0 && !hasActiveFilters && activeTab === 'All' && financialFilter === 'All' && sessionFilter === 'All'}
                  onClear={hasActiveFilters ? handleClearFilters : undefined}
                />
              ) : (
                pagedJourneys.map(j => {
                  const situation = buildIpRowSituation(j);
                  const clinical = censusClinicalChip(j.clinicalState);
                  const procedure = censusProcedureLine(j.procedureName, j.eyeOperated);
                  return (
                    <Link
                      key={j.id}
                      href={`/dashboard/ip-management/journey/${j.id}`}
                      data-testid={IP_CENSUS_TEST_IDS.card(j.id)}
                      className="block px-4 py-3 hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900">{j.patientName ?? '—'}</p>
                          <p className="text-xs font-mono text-gray-400">
                            {j.uhid ?? '—'} · {censusAgeSex(j.patientDob, j.patientAge, j.patientGender)}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {procedure.procedure}
                            {' · '}
                            {[j.wardName, j.bedNumber].filter(Boolean).join(' · ') || 'No bed'}
                            {j.slotLabel ? ` · ${j.slotLabel}` : ''}
                          </p>
                        </div>
                        <StatusChip status={clinical.status} label={clinical.label} size="sm" />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {situation.nextAction}
                        {situation.nextActionOwner !== '—' ? ` · ${situation.nextActionOwner}` : ''}
                      </p>
                    </Link>
                  );
                })
              )}
            </div>
          ) : (
            <div className="table-scroll" role="table" aria-label="Inpatient census">
              <div className="census-grid census-head" role="row">
                {visibleColumns.map(col => (
                  <div key={col.key} role="columnheader" title={col.purpose}>{col.label}</div>
                ))}
              </div>
              {showSkeleton
                ? Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonRow key={i} columns={visibleColumns.length} />
                ))
                : loadFailed
                ? null
                : displayJourneys.length === 0
                ? (
                  <CensusEmpty
                    noSourceRows={journeys.length === 0 && !hasActiveFilters && activeTab === 'All' && financialFilter === 'All' && sessionFilter === 'All'}
                    onClear={hasActiveFilters ? handleClearFilters : undefined}
                  />
                )
                : pagedJourneys.map(j => {
                  const isSelected = selectedJourney?.id === j.id;
                  return (
                    <div
                      key={j.id}
                      id={IP_CENSUS_TEST_IDS.row(j.id)}
                      data-testid={IP_CENSUS_TEST_IDS.row(j.id)}
                      role="row"
                      aria-selected={isSelected}
                      aria-label={`${j.patientName ?? 'Patient'}. ${buildIpRowSituation(j).nextAction}. ${buildCensusAttention(j).label}`}
                      onClick={() => onRowActivate(j)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRowActivate(j);
                        }
                      }}
                      tabIndex={0}
                      className={`census-grid census-row clickable ${isSelected ? 'row-selected' : ''}`}
                    >
                      <JourneyCells journey={j} />
                    </div>
                  );
                })
              }
            </div>
          )}

          {!showSkeleton && displayJourneys.length > 0 && (
            <div className="listfoot">
              <p>
                Showing <b>{showingFrom}–{showingTo}</b> of <b>{displayJourneys.length}</b>
                {displayJourneys.length !== journeys.length ? ` (from ${journeys.length})` : ''} patients
              </p>
              <div className="pager">
                <button
                  type="button"
                  className="btn sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className="muted">Page {currentPage} of {pageCount}</span>
                <button
                  type="button"
                  className="btn sm"
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage(p => Math.min(pageCount, p + 1))}
                >
                  Next
                </button>
              </div>
              <p>
                {presentation === 'cards' ? 'Open a card for the full record' : 'Click a row to inspect without leaving the list. Press / to search, j/k to move.'}
              </p>
            </div>
          )}
        </div>

        {presentation === 'docked' && selectedJourney && (
          <aside
            className="rail sticky top-0 self-start overflow-hidden h-[calc(100vh-5.5rem)]"
            style={{ width: CENSUS_RAIL_WIDTH_PX }}
          >
            {panel}
          </aside>
        )}
      </div>
      </div>

      {presentation === 'sheet' && (
        <Sheet open={Boolean(selectedJourney)} onOpenChange={open => { if (!open) clearPatient(); }}>
          <SheetContent
            side="right"
            overlayClassName="bg-black/40"
            overlayTestId={IP_CENSUS_TEST_IDS.scrim}
            className="p-0 w-[520px] sm:max-w-[520px] [&>button]:hidden"
            aria-modal="true"
          >
            <SheetTitle className="sr-only">
              {selectedJourney?.patientName ?? 'Patient context'}
            </SheetTitle>
            {panel}
          </SheetContent>
        </Sheet>
      )}

      {selectedJourney && preopStep && (
        <WardPreOpWorkspaceModal
          key={`${selectedJourney.id}-${preopStep}`}
          journey={selectedJourney}
          wards={wards}
          branchId={branchId}
          initialStep={preopStep}
          onClose={() => setPreopStep(null)}
          onJourneyUpdated={() => {
            handleJourneyUpdated();
          }}
        />
      )}
    </div>
  );
}

export default function IpManagementPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-gray-500">Loading census…</div>
      }
    >
      <IpManagementPageInner />
    </Suspense>
  );
}
