'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, Users, Scissors, RefreshCw, CheckCircle2,
  Activity, Calendar, RotateCcw, SlidersHorizontal,
  Clock, X, ExternalLink,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import { counsellingAzureApi } from '@/lib/api/counselling-azure.api';
import { ipManagementApi } from '@/lib/api/ip-management.api';
import type { PatientJourneyRowDto } from '@/lib/api/ip-management.api';
import { useAuthStore } from '@/lib/auth-store';
import { WaitingListRow } from '@/components/counsellors-desk/WaitingListRow';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useWaitingListQuery, useInvalidateCounsellorsDesk } from '@/hooks/use-counsellors-desk-queries';
import { useDeferredCcmsBadges } from '@/hooks/use-deferred-ccms-badges';
import { isCoveragePaymentTypeValue } from '@/lib/counsellors-desk/session-utils';
import { isWaitingListPreAuthQueue } from '@/lib/counsellors-desk/waiting-list-preauth';
import { applyWaitingListClientFilters } from '@/lib/counsellors-desk/waiting-list-client-filters';
import { resolveOtReturnedAction } from '@/lib/counsellors-desk/ot-returned-action';
import type { WaitingListPatient, WaitingListFilters, AddPatientFormData } from '@/types/counsellors-desk';

const AddPatientModal = dynamic(
  () => import('@/components/counsellors-desk/AddPatientModal').then(m => ({ default: m.AddPatientModal })),
  { ssr: false },
);

const STATUS_TABS = [
  { key: 'All',               label: 'All',                color: 'bg-slate-500',   activeClass: 'bg-slate-600   border-slate-600   text-white' },
  { key: 'Pending',           label: 'Pending',            color: 'bg-amber-500',   activeClass: 'bg-amber-500   border-amber-500   text-white' },
  { key: 'Processed',         label: 'Processed',          color: 'bg-blue-500',    activeClass: 'bg-blue-500    border-blue-500    text-white' },
  { key: 'Done',              label: 'Done',               color: 'bg-emerald-500', activeClass: 'bg-emerald-500 border-emerald-500 text-white' },
  { key: 'AddOnSurgery',      label: 'Add-on Surgery',     color: 'bg-violet-500',  activeClass: 'bg-violet-500  border-violet-500  text-white' },
  { key: 'RepeatCounselling', label: 'Repeat Counselling', color: 'bg-orange-500',  activeClass: 'bg-orange-500  border-orange-500  text-white' },
  { key: 'SurgeryDone',       label: 'Surgery Done',       color: 'bg-teal-500',    activeClass: 'bg-teal-600    border-teal-600    text-white' },
  { key: 'OtReturned',        label: 'OT Returned',        color: 'bg-rose-500',    activeClass: 'bg-rose-600    border-rose-600    text-white' },
  { key: 'PreAuthQueue',      label: 'Pre-Auth Queue',     color: 'bg-indigo-500',  activeClass: 'bg-indigo-600  border-indigo-600  text-white' },
];

// Skeleton loader row
function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 14 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="h-3 bg-gray-100 rounded-full animate-pulse"
            style={{ width: `${45 + (i * 13) % 40}%` }}
          />
        </td>
      ))}
    </tr>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-2">
      <div
        className={`h-full rounded-full transition-all duration-300 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Patient Demographics Panel ───────────────────────────────────────────────

function PatientDemographicsPanel({
  patient,
  onClose,
}: {
  patient: WaitingListPatient;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{patient.patientName}</h2>
            <span className="font-mono text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md">{patient.uhid}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Core demographics */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 font-medium mb-0.5">Date of Birth</p>
              <p className="text-sm text-gray-900">
                {patient.dob
                  ? new Date(patient.dob).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium mb-0.5">Blood Group</p>
              <p className="text-sm font-semibold text-gray-900">{patient.bloodGroup || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium mb-0.5">Gender</p>
              <p className="text-sm text-gray-900">{patient.gender || '—'}</p>
            </div>
          </div>

          {/* Contact & address */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
            <div>
              <p className="text-xs text-gray-500 font-medium mb-0.5">Contact Number</p>
              <p className="text-sm text-gray-900">{patient.contactNumber || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium mb-0.5">Address</p>
              <p className="text-sm text-gray-900 leading-snug">{patient.address || '—'}</p>
            </div>
          </div>

          {/* Emergency contact */}
          {(patient.emergencyContactName || patient.emergencyContactPhone) && (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Emergency Contact</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-0.5">Name</p>
                  <p className="text-sm text-gray-900">{patient.emergencyContactName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-0.5">Phone</p>
                  <p className="text-sm text-gray-900">{patient.emergencyContactPhone || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-0.5">Relationship</p>
                  <p className="text-sm text-gray-900">{patient.emergencyContactRelationship || '—'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CounsellorWaitingListPage() {
  const router = useRouter();
  const { invalidateWaitingList } = useInvalidateCounsellorsDesk();

  const [otReturnedRows, setOtReturnedRows]  = useState<PatientJourneyRowDto[]>([]);
  const [otReturnedLoading, setOtReturnedLoading] = useState(false);
  const [activeTab, setActiveTab]           = useState('All');
  const [selectedId, setSelectedId]         = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showFilters, setShowFilters]       = useState(false);
  const [quickSearch, setQuickSearch]       = useState('');
  const debouncedQuickSearch = useDebouncedValue(quickSearch, 300);
  const [demographicsPatient, setDemographicsPatient] = useState<WaitingListPatient | null>(null);

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
    }),
    [appliedFilters],
  );

  const waitingListQuery = useWaitingListQuery(apiFilters);
  const patients = waitingListQuery.data ?? [];
  const isLoading = waitingListQuery.isLoading && patients.length === 0;
  const isRefreshing = waitingListQuery.isFetching && patients.length > 0;

  const { user, selectedBranchId } = useAuthStore();
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

  const stats = useMemo(() => ({
    total:     patients.length,
    procedure: patients.filter(p => p.type === 'Procedure').length,
    surgery:   patients.filter(p => p.type === 'Surgery').length,
    repeat:    patients.filter(p => p.status === 'RepeatCounselling').length,
    completed: patients.filter(p => p.status === 'Done').length,
  }), [patients]);

  const tabCounts = useMemo(() => {
    const typeScoped =
      filters.type === 'All' ? patients : patients.filter((p) => p.type === filters.type);
    const map: Record<string, number> = { All: typeScoped.length };
    STATUS_TABS.slice(1).forEach(({ key }) => {
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
    appliedFilters.patientName || appliedFilters.mrd ||
    filters.type !== 'All'
  );

  const STAT_CARDS = [
    {
      label: 'Total Patients', value: stats.total,     pct: stats.total,
      bar: 'bg-blue-500',    iconBg: 'bg-blue-50',    iconFg: 'text-blue-600',
      icon: <Users className="h-4 w-4" strokeWidth={2} />,
    },
    {
      label: 'Procedure',      value: stats.procedure, pct: stats.procedure,
      bar: 'bg-violet-500',  iconBg: 'bg-violet-50',  iconFg: 'text-violet-600',
      icon: <Activity className="h-4 w-4" strokeWidth={2} />,
    },
    {
      label: 'Surgery',        value: stats.surgery,   pct: stats.surgery,
      bar: 'bg-indigo-500',  iconBg: 'bg-indigo-50',  iconFg: 'text-indigo-600',
      icon: <Scissors className="h-4 w-4" strokeWidth={2} />,
    },
    {
      label: 'Repeat Counselling', value: stats.repeat, pct: stats.repeat,
      bar: 'bg-orange-400',  iconBg: 'bg-orange-50',  iconFg: 'text-orange-500',
      icon: <RefreshCw className="h-4 w-4" strokeWidth={2} />,
    },
    {
      label: 'Completed',      value: stats.completed, pct: stats.completed,
      bar: 'bg-emerald-500', iconBg: 'bg-emerald-50', iconFg: 'text-emerald-600',
      icon: <CheckCircle2 className="h-4 w-4" strokeWidth={2} />,
    },
  ];

  return (
    <div className="space-y-4 pb-6">

      {/* ── STAT WIDGETS ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {STAT_CARDS.map(card => (
          <div
            key={card.label}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-3xl font-extrabold text-gray-900 tracking-tight">{card.value}</p>
                <p className="text-xs text-gray-500 mt-1 font-medium">{card.label}</p>
                <MiniBar value={card.pct} max={stats.total} color={card.bar} />
              </div>
              <div className={`w-9 h-9 rounded-xl ${card.iconBg} ${card.iconFg} flex items-center justify-center flex-shrink-0 ml-3`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── CONTROL BAR ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by patient, UHID, surgery, doctor…"
              value={quickSearch}
              onChange={e => setQuickSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
            />
            {quickSearch && (
              <button
                onClick={() => setQuickSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1" role="group" aria-label="Filter by type">
            {(['All', 'Procedure', 'Surgery'] as const).map(t => (
              <button
                key={t}
                type="button"
                aria-pressed={filters.type === t}
                onClick={() => setFilters(f => ({ ...f, type: t }))}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  filters.type === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl border transition-all ${
              showFilters || hasActiveFilters
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-blue-500 ml-0.5" />}
          </button>

          {(hasActiveFilters || quickSearch) && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
        </div>

        {showFilters && (
          <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
                <Calendar className="h-3 w-3" /> From Date
              </label>
              <input
                type="date"
                value={filters.fromDate}
                onChange={e => setFilters(f => ({ ...f, fromDate: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
                <Calendar className="h-3 w-3" /> To Date
              </label>
              <input
                type="date"
                value={filters.toDate}
                onChange={e => setFilters(f => ({ ...f, toDate: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
                <Users className="h-3 w-3" /> Patient Name
              </label>
              <input
                type="text"
                placeholder="Search by name…"
                value={filters.patientName}
                onChange={e => setFilters(f => ({ ...f, patientName: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
                <Search className="h-3 w-3" /> MRD / UHID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search by MRD / UHID…"
                  value={filters.mrd}
                  onChange={e => setFilters(f => ({ ...f, mrd: e.target.value }))}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                />
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── PATIENT TABLE ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        <div className="flex items-center justify-between px-4 pt-3 pb-0 gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-3 flex-1">
            {STATUS_TABS.map(({ key, label, color, activeClass }) => {
              const count = tabCounts[key] ?? 0;
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                    isActive
                      ? `${activeClass} shadow-sm`
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-white/80' : color}`} />
                  {label}
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>{count}</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md whitespace-nowrap mb-3"
          >
            <Plus className="h-4 w-4" />
            Add Patient
          </button>
        </div>

        {/* ── OT RETURNED TABLE ─────────────────────────── */}
        {activeTab === 'OtReturned' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-rose-50/70 border-y border-rose-100">
                  <th className="pl-4 pr-3 py-2.5 w-10 text-left text-[10px] font-extrabold text-rose-700 uppercase tracking-widest">#</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-rose-700 uppercase tracking-widest">UHID</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-rose-700 uppercase tracking-widest">Patient</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-rose-700 uppercase tracking-widest">Procedure</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-rose-700 uppercase tracking-widest">Return Reason</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-rose-700 uppercase tracking-widest">Surgery Date</th>
                  <th className="px-3 py-2.5 pr-4 text-[10px] font-extrabold text-rose-700 uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody>
                {otReturnedLoading ? (
                  Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
                ) : otReturnedRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center">
                          <RotateCcw className="h-5 w-5 text-rose-300" />
                        </div>
                        <p className="text-sm font-medium text-gray-600">No OT-returned patients</p>
                        <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
                          Empty is normal until OT returns a patient. Path: IP journey Send to OT →
                          Operation Theatre → Return Patient (with reason) → patient returns to Ready for Surgery.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : otReturnedRows.map((row, idx) => {
                  const sched = row.surgeryScheduledAt
                    ? new Date(row.surgeryScheduledAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '—';
                  // The return reason may contain " — notes" suffix: show primary reason bold + notes muted
                  const reasonParts = (row.otReturnReason ?? '').split(' — ');
                  const primaryReason = reasonParts[0];
                  const reasonNote   = reasonParts.slice(1).join(' — ');
                  const action = resolveOtReturnedAction({
                    journeyId: row.id,
                    counselingSessionId: row.counselingSessionId,
                  });
                  return (
                    <tr key={row.id} className={`border-l-4 border-l-rose-400 ${idx % 2 === 0 ? 'bg-white' : 'bg-rose-50/30'} hover:bg-rose-50/60 transition-colors`}>
                      <td className="pl-4 pr-3 py-3 text-xs text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-3">
                        <span className="font-mono text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{row.uhid ?? '—'}</span>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-gray-900 text-sm">{row.patientName ?? '—'}</p>
                        {row.eyeOperated && <p className="text-[10px] text-gray-500">{row.eyeOperated}</p>}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-700 whitespace-nowrap">{row.procedureName ?? '—'}</td>
                      <td className="px-3 py-3 max-w-[220px]">
                        <span className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">{primaryReason}</span>
                        {reasonNote && <p className="text-[10px] text-gray-500 mt-0.5 truncate">{reasonNote}</p>}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{sched}</td>
                      <td className="px-3 pr-4 py-3">
                        <button
                          type="button"
                          onClick={() => router.push(action.href)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors"
                        >
                          {action.kind === 'replan' ? (
                            <RotateCcw className="h-3 w-3" aria-hidden />
                          ) : (
                            <ExternalLink className="h-3 w-3" aria-hidden />
                          )}
                          {action.label}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/70 border-y border-gray-100">
                <th className="pl-4 pr-3 py-2.5 w-12 text-left text-[10px] font-extrabold text-gray-600 uppercase tracking-widest">#</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-gray-600 uppercase tracking-widest">UHID</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-gray-600 uppercase tracking-widest">Patient</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-gray-600 uppercase tracking-widest">Eye</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-gray-600 uppercase tracking-widest">Surgery / Procedure</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-gray-600 uppercase tracking-widest">Type</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-gray-600 uppercase tracking-widest">Patient Type</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-gray-600 uppercase tracking-widest">Age</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-gray-600 uppercase tracking-widest">Gender</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-gray-600 uppercase tracking-widest">Doctor</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-gray-600 uppercase tracking-widest">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Time</span>
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-gray-600 uppercase tracking-widest">Remarks</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest">Pre-Auth</th>
                <th className="px-3 py-2.5 pr-4 w-8" />
              </tr>
            </thead>
            <tbody>
              {isLoading && patients.length === 0
                ? Array.from({ length: 7 }).map((_, i) => <SkeletonRow key={i} />)
                : filtered.length === 0
                ? (
                  <tr>
                    <td colSpan={14} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                          <Users className="h-6 w-6 opacity-40" />
                        </div>
                        <p className="text-sm font-medium text-gray-600">
                          {activeTab === 'RepeatCounselling'
                            ? 'No repeat counselling patients'
                            : 'No patients found'}
                        </p>
                        <p className="text-xs text-gray-400 max-w-md leading-relaxed">
                          {activeTab === 'RepeatCounselling'
                            ? 'Create via session: open a Pending patient → Patient Decision → Not Interested or Needs Time → Save Session. Then return here. Follow-up Center Re-queue creates a new Pending row, not this tab.'
                            : 'Try adjusting your filters or search'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )
                : filtered.map((patient, idx) => {
                  const badge = ccmsBadges[patient.id];
                  const ccmsState = badge?.status === 'ready' ? badge.state : undefined;
                  return (
                  <WaitingListRow
                    key={patient.id}
                    patient={patient}
                    idx={idx}
                    isSelected={selectedId === patient.id}
                    ccmsState={ccmsState}
                    onRowClick={handleRowClick}
                    onDemographics={handleDemographics}
                    onPreAuth={handlePreAuth}
                  />
                  );
                })
              }
            </tbody>
          </table>
        </div>

        {!isLoading && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50">
            <p className="text-xs text-gray-400 flex items-center gap-2">
              {isRefreshing && (
                <RefreshCw className="h-3 w-3 animate-spin text-blue-500" aria-hidden />
              )}
              {filtered.length === 0
                ? 'No results'
                : (
                  <>Showing{' '}
                    <span className="font-semibold text-gray-600">{filtered.length}</span> of{' '}
                    <span className="font-semibold text-gray-600">{patients.length}</span> patients
                  </>
                )
              }
            </p>
          </div>
        )}
        </>
        )}
      </div>

      {isAddModalOpen && (
        <AddPatientModal
          isOpen
          onClose={() => setIsAddModalOpen(false)}
          onAdd={handleAddPatient}
          branchId={branchId}
        />
      )}

      {demographicsPatient && (
        <PatientDemographicsPanel
          patient={demographicsPatient}
          onClose={() => setDemographicsPatient(null)}
        />
      )}
    </div>
  );
}
