'use client';

import { useState, useEffect, type ComponentType } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  Phone, History, RotateCcw, Search,
  AlertTriangle, Clock, CheckCircle, RefreshCw,
  Heart, Calendar, CalendarCheck, Send,
  Users, PhoneOff, XCircle, ExternalLink, ClipboardList,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import type {
  ActiveFollowupRecord,
  ColdLeadRecord,
  PostSurgeryFollowupRecord,
  PatientIntention,
  ReQueuePayload,
} from '@/types/counsellors-desk';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { SessionTypeSelect } from '@/components/counsellors-desk/SessionTypeSelect';
import { defaultSessionTypeCode } from '@/lib/counsellors-desk/counsellor-master-maps';
import {
  useActiveFollowupsQuery,
  useColdLeadsQuery,
  usePostSurgeryFollowupsQuery,
} from '@/hooks/use-counsellors-desk-queries';

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

// ============================================================================
// Constants
// ============================================================================

const TABS = [
  { id: 'active',       label: 'Active Follow-ups',  icon: Phone },
  { id: 'cold',         label: 'Cold Leads',          icon: AlertTriangle },
  { id: 'post-surgery', label: 'Post-Surgery',         icon: Heart },
] as const;

type TabId = (typeof TABS)[number]['id'];

const INTENTION_LABEL: Record<string, string> = {
  WillingWeek:          'Willing — This Week',
  WillingMonth:         'Willing — This Month',
  WillingQuarter:       'Willing — This Quarter',
  WillingCallToConfirm: 'Pending Call',
  Undecided:            'Undecided',
  WaitingFinancial:     'Waiting — Finance',
  WaitingFear:          'Waiting — Fear',
  Declined:             'Declined',
  ReferredElsewhere:    'Referred Elsewhere',
};

const INTENTION_COLOR: Record<string, string> = {
  WillingWeek:          'bg-emerald-100 text-emerald-800',
  WillingMonth:         'bg-green-100 text-green-800',
  WillingQuarter:       'bg-teal-100 text-teal-800',
  WillingCallToConfirm: 'bg-sky-100 text-sky-800',
  Undecided:            'bg-gray-100 text-gray-700',
  WaitingFinancial:     'bg-amber-100 text-amber-800',
  WaitingFear:          'bg-orange-100 text-orange-800',
  Declined:             'bg-red-100 text-red-800',
  ReferredElsewhere:    'bg-rose-100 text-rose-800',
};

const ALERT_BORDER: Record<string, string> = {
  Critical: 'border-l-red-500',
  High:     'border-l-orange-400',
  Medium:   'border-l-amber-400',
  Normal:   'border-l-blue-200',
};

// ── Date filter ──────────────────────────────────────────────────────────────

type DateFilter = 'all' | 'overdue' | 'this-week' | 'next-week' | 'next-2-weeks' | 'next-month';

const DATE_FILTERS: { id: DateFilter; label: string; activeColor: string }[] = [
  { id: 'all',          label: 'All',          activeColor: 'bg-gray-800 text-white border-gray-800' },
  { id: 'overdue',      label: 'Overdue',       activeColor: 'bg-red-500 text-white border-red-500' },
  { id: 'this-week',    label: 'This Week',     activeColor: 'bg-blue-600 text-white border-blue-600' },
  { id: 'next-week',    label: 'Next Week',     activeColor: 'bg-indigo-600 text-white border-indigo-600' },
  { id: 'next-2-weeks', label: 'Next 2 Weeks',  activeColor: 'bg-violet-600 text-white border-violet-600' },
  { id: 'next-month',   label: 'Next Month',    activeColor: 'bg-purple-600 text-white border-purple-600' },
];

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function today0(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function inDateFilter(due: Date, filter: DateFilter): boolean {
  if (filter === 'all') return true;
  const t = today0();
  if (filter === 'overdue')      return due < t;
  if (filter === 'this-week')    return due >= t && due < addDays(t, 7);
  if (filter === 'next-week')    return due >= addDays(t, 7) && due < addDays(t, 14);
  if (filter === 'next-2-weeks') return due >= addDays(t, 14) && due < addDays(t, 28);
  if (filter === 'next-month')   return due >= addDays(t, 28) && due < addDays(t, 60);
  return true;
}

function activeDue(r: { lastContactDate: string | null; sessionDate: string }): Date {
  if (r.lastContactDate) return addDays(new Date(r.lastContactDate), 7);
  return new Date(r.sessionDate);
}
function coldDue(r: { lastContactDate: string | null; sessionDate: string }): Date {
  if (r.lastContactDate) return addDays(new Date(r.lastContactDate), 30);
  return new Date(r.sessionDate);
}
function postDue(r: { dischargeDate: string | null }): Date {
  return r.dischargeDate ? addDays(new Date(r.dischargeDate), 14) : today0();
}

// ============================================================================
// Sub-components
// ============================================================================

function SkeletonRow() {
  return (
    <div className="animate-pulse flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
      <div className="w-1 h-8 rounded-full bg-gray-200" />
      <div className="h-8 w-8 rounded-full bg-gray-200 flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 bg-gray-200 rounded w-44" />
        <div className="h-3 bg-gray-100 rounded w-64" />
      </div>
      <div className="flex gap-1">
        {[1,2,3,4].map(i => <div key={i} className="h-8 w-8 rounded-lg bg-gray-100" />)}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <Phone className="w-10 h-10 text-gray-200 mb-3" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function KpiCard({
  label, value, icon: Icon, bgColor, textColor, borderColor,
}: {
  label: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
  bgColor: string;
  textColor: string;
  borderColor: string;
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${borderColor} ${bgColor} flex-1`}>
      <div className={`p-1.5 rounded-lg bg-white/70 ${textColor}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0">
        <div className={`text-lg font-bold leading-none ${textColor}`}>{value}</div>
        <div className="text-[11px] text-gray-500 mt-0.5 leading-tight">{label}</div>
      </div>
    </div>
  );
}

function ActionButtons({
  onCall, onReminder, onHistory, onReQueue, onScheduleVisit, onReevaluate,
}: {
  onCall: () => void;
  onReminder: () => void;
  onHistory: () => void;
  onReQueue?: () => void;
  onScheduleVisit?: () => void;
  onReevaluate?: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5 flex-shrink-0">
      {onReevaluate && (
        <button onClick={onReevaluate} title="Reevaluate / Open Session"
          className="p-2 rounded-lg hover:bg-cyan-50 text-cyan-600 transition-colors">
          <ClipboardList className="w-4 h-4" />
        </button>
      )}
      <button onClick={onCall} title="Log Contact"
        className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors">
        <Phone className="w-4 h-4" />
      </button>
      <button onClick={onReminder} title="Send Reminder"
        className="p-2 rounded-lg hover:bg-violet-50 text-violet-600 transition-colors">
        <Send className="w-4 h-4" />
      </button>
      <button onClick={onHistory} title="View History"
        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
        <History className="w-4 h-4" />
      </button>
      {onReQueue && (
        <button onClick={onReQueue} title="Re-queue to Waiting List"
          className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors">
          <RotateCcw className="w-4 h-4" />
        </button>
      )}
      {onScheduleVisit && (
        <button onClick={onScheduleVisit} title="Schedule Follow-up Visit"
          className="p-2 rounded-lg hover:bg-teal-50 text-teal-600 transition-colors">
          <CalendarCheck className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Re-queue Modal
// ============================================================================

function ReQueueModal({
  isOpen,
  sessionId,
  patientName,
  onClose,
  onQueued,
}: {
  isOpen: boolean;
  sessionId: string;
  patientName: string;
  onClose: () => void;
  onQueued: () => void;
}) {
  const [intention, setIntention] = useState<PatientIntention | ''>('WillingCallToConfirm');
  const [sessionTypeCode, setSessionTypeCode] = useState(defaultSessionTypeCode('requeue'));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const activeIntentions: PatientIntention[] = [
    'WillingWeek', 'WillingMonth', 'WillingQuarter', 'WillingCallToConfirm',
    'Undecided', 'WaitingFinancial', 'WaitingFear',
  ];

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload: ReQueuePayload = {
        newIntention: intention as PatientIntention || undefined,
        notes: notes || undefined,
        sessionType: sessionTypeCode,
      };
      const result = await counsellorsDeskApi.reQueueSession(sessionId, payload);
      toast.success(`Patient re-queued â€” Token: ${result.tokenNumber}`);
      onQueued();
      onClose();
      setNotes('');
      setIntention('WillingCallToConfirm');
      setSessionTypeCode(defaultSessionTypeCode('requeue'));
    } catch {
      toast.error('Failed to re-queue patient');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 to-teal-600">
          <h3 className="font-semibold text-white text-sm flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />
            Re-queue to Waiting List
          </h3>
          <p className="text-xs text-emerald-100 mt-0.5">{patientName}</p>
        </div>
        <div className="px-5 py-4 space-y-4">
          <SessionTypeSelect
            id="requeue-session-type"
            value={sessionTypeCode}
            onChange={setSessionTypeCode}
            context="requeue"
          />

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Updated Intention</label>
            <select
              value={intention}
              onChange={(e) => setIntention(e.target.value as PatientIntention)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="">â€” No change â€”</option>
              {activeIntentions.map((i) => (
                <option key={i} value={i}>{INTENTION_LABEL[i] ?? i}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for re-queuingâ€¦"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50/80 rounded-b-2xl">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? 'Queuingâ€¦' : 'Re-queue'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SurgeryFollowupPage() {
  const router = useRouter();
  const [activeTab,   setActiveTab]   = useState<TabId>('active');
  const [search,      setSearch]      = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [dateFilter,  setDateFilter]  = useState<DateFilter>('all');

  const [activePage, setActivePage] = useState(1);
  const [coldPage, setColdPage] = useState(1);
  const [postPage, setPostPage] = useState(1);

  const [tabFetched, setTabFetched] = useState<Record<TabId, boolean>>({
    active: true,
    cold: false,
    'post-surgery': false,
  });

  useEffect(() => {
    setTabFetched(prev => ({ ...prev, [activeTab]: true }));
    setDateFilter('all');
  }, [activeTab]);

  const activeQuery = useActiveFollowupsQuery(activePage, tabFetched.active);
  const coldQuery = useColdLeadsQuery(coldPage, tabFetched.cold);
  const postQuery = usePostSurgeryFollowupsQuery(postPage, tabFetched['post-surgery']);

  const activeItems = activeQuery.data?.items ?? [];
  const activeTotal = activeQuery.data?.total ?? 0;
  const coldItems = coldQuery.data?.items ?? [];
  const coldTotal = coldQuery.data?.total ?? 0;
  const postItems = postQuery.data?.items ?? [];
  const postTotal = postQuery.data?.total ?? 0;

  const currentQuery = activeTab === 'active' ? activeQuery : activeTab === 'cold' ? coldQuery : postQuery;
  const showSkeleton = currentQuery.isLoading && !currentQuery.data;
  const isRefreshing = currentQuery.isFetching && !!currentQuery.data;
  const error = currentQuery.isError
    ? (activeTab === 'active' ? 'Failed to load active follow-ups'
      : activeTab === 'cold' ? 'Failed to load cold leads'
      : 'Failed to load post-surgery patients')
    : null;

  const [historyDrawer, setHistoryDrawer] = useState<{ sessionId: string; patientName: string } | null>(null);
  const [contactModal,  setContactModal]  = useState<{ sessionId: string; patientName: string; phone: string | null } | null>(null);
  const [reQueueModal,  setReQueueModal]  = useState<{ sessionId: string; patientName: string } | null>(null);
  const [reminderModal, setReminderModal] = useState<{ patientId: string; patientName: string; phone: string | null; journeyId?: string } | null>(null);

  const PAGE_SIZE = 20;

  const handleRefresh = () => {
    void currentQuery.refetch();
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

  const searchLC = debouncedSearch.toLowerCase();

  // ── Filtered lists ────────────────────────────────────────────────────────
  const filteredActive = activeItems.filter(r =>
    (!search || r.patientName.toLowerCase().includes(searchLC) || (r.uhid ?? '').toLowerCase().includes(searchLC)) &&
    inDateFilter(activeDue(r), dateFilter)
  );
  const filteredCold = coldItems.filter(r =>
    (!search || r.patientName.toLowerCase().includes(searchLC) || (r.uhid ?? '').toLowerCase().includes(searchLC)) &&
    inDateFilter(coldDue(r), dateFilter)
  );
  const filteredPost = postItems.filter(r =>
    (!search || r.patientName.toLowerCase().includes(searchLC) || (r.uhid ?? '').toLowerCase().includes(searchLC)) &&
    inDateFilter(postDue(r), dateFilter)
  );

  // ── Stats ─────────────────────────────────────────────────────────────────
  const activeEscalated     = activeItems.filter(r => r.alertLevel === 'Critical' || r.alertLevel === 'High').length;
  const activeNeverContacted = activeItems.filter(r => !r.lastContactDate).length;
  const coldDeclined        = coldItems.filter(r => r.patientIntention === 'Declined').length;
  const coldReferred        = coldItems.filter(r => r.patientIntention === 'ReferredElsewhere').length;
  const postOver30          = postItems.filter(r => (r.daysSinceDischarge ?? 0) >= 30).length;

  const activeAvgAttempts   = activeItems.length
    ? (activeItems.reduce((s, r) => s + r.contactAttemptCount, 0) / activeItems.length).toFixed(1)
    : '0.0';
  const coldAvgAttempts     = coldItems.length
    ? (coldItems.reduce((s, r) => s + r.contactAttemptCount, 0) / coldItems.length).toFixed(1)
    : '0.0';
  const postPendingVisits   = postItems.reduce((s, r) => s + (r.pendingPostOpVisits ?? 0), 0);
  const postAvgDays         = postItems.length
    ? Math.round(postItems.reduce((s, r) => s + (r.daysSinceDischarge ?? 0), 0) / postItems.length)
    : 0;

  // Count per date filter for the active tab's data source
  const countForFilter = (f: DateFilter): number => {
    if (activeTab === 'active') return activeItems.filter(r =>
      (!search || r.patientName.toLowerCase().includes(searchLC) || (r.uhid ?? '').toLowerCase().includes(searchLC)) &&
      inDateFilter(activeDue(r), f)
    ).length;
    if (activeTab === 'cold') return coldItems.filter(r =>
      (!search || r.patientName.toLowerCase().includes(searchLC) || (r.uhid ?? '').toLowerCase().includes(searchLC)) &&
      inDateFilter(coldDue(r), f)
    ).length;
    return postItems.filter(r =>
      (!search || r.patientName.toLowerCase().includes(searchLC) || (r.uhid ?? '').toLowerCase().includes(searchLC)) &&
      inDateFilter(postDue(r), f)
    ).length;
  };

  const currentItems = activeTab === 'active' ? filteredActive : activeTab === 'cold' ? filteredCold : filteredPost;
  const currentTotal = activeTab === 'active' ? activeTotal    : activeTab === 'cold' ? coldTotal    : postTotal;
  const currentPage  = activeTab === 'active' ? activePage     : activeTab === 'cold' ? coldPage     : postPage;

  const handlePageChange = (p: number) => {
    if (activeTab === 'active') setActivePage(p);
    else if (activeTab === 'cold') setColdPage(p);
    else setPostPage(p);
  };

  return (
    <div className="flex flex-col bg-gray-50 rounded-2xl overflow-hidden" style={{ height: 'calc(100vh - 120px)' }}>

      {/* ── Compact tab bar ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex-shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const count = tab.id === 'active' ? activeTotal : tab.id === 'cold' ? coldTotal : postTotal;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSearch(''); }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-300'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {count > 0 && (
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold leading-none ${
                    activeTab === tab.id ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* search + refresh */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or MRN…"
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 w-52"
            />
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex-shrink-0 flex flex-wrap gap-3">
        {activeTab === 'active' && (
          <>
            <KpiCard label="Total Pending"   value={activeTotal}          icon={Users}         bgColor="bg-blue-50"    textColor="text-blue-700"    borderColor="border-blue-100" />
            <KpiCard label="Urgent / High"   value={activeEscalated}      icon={AlertTriangle}  bgColor="bg-orange-50"  textColor="text-orange-700"  borderColor="border-orange-100" />
            <KpiCard label="Never Contacted" value={activeNeverContacted} icon={PhoneOff}       bgColor="bg-amber-50"   textColor="text-amber-700"   borderColor="border-amber-100" />
            <KpiCard label="Avg Attempts"    value={activeAvgAttempts}    icon={Phone}          bgColor="bg-gray-100"   textColor="text-gray-600"    borderColor="border-gray-200" />
          </>
        )}
        {activeTab === 'cold' && (
          <>
            <KpiCard label="Total Cold"         value={coldTotal}       icon={Users}        bgColor="bg-slate-50"  textColor="text-slate-700"  borderColor="border-slate-100" />
            <KpiCard label="Declined"           value={coldDeclined}    icon={XCircle}      bgColor="bg-red-50"    textColor="text-red-700"    borderColor="border-red-100" />
            <KpiCard label="Referred Elsewhere" value={coldReferred}    icon={ExternalLink} bgColor="bg-rose-50"   textColor="text-rose-700"   borderColor="border-rose-100" />
            <KpiCard label="Avg Attempts"       value={coldAvgAttempts} icon={Phone}        bgColor="bg-gray-100"  textColor="text-gray-600"   borderColor="border-gray-200" />
          </>
        )}
        {activeTab === 'post-surgery' && (
          <>
            <KpiCard label="Total Post-Op"    value={postTotal}         icon={Heart}         bgColor="bg-emerald-50" textColor="text-emerald-700" borderColor="border-emerald-100" />
            <KpiCard label="Over 30 Days"     value={postOver30}        icon={Clock}         bgColor="bg-amber-50"   textColor="text-amber-700"   borderColor="border-amber-100" />
            <KpiCard label="Pending Visits"   value={postPendingVisits} icon={CalendarCheck} bgColor="bg-blue-50"    textColor="text-blue-700"    borderColor="border-blue-100" />
            <KpiCard label="Avg Days Post-Op" value={postAvgDays}       icon={Calendar}      bgColor="bg-gray-100"   textColor="text-gray-600"    borderColor="border-gray-200" />
          </>
        )}
      </div>

      {/* ── Quick date filter ── */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex-shrink-0 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {DATE_FILTERS.map((f) => {
            const cnt = countForFilter(f.id);
            const isActive = dateFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setDateFilter(f.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  isActive
                    ? f.activeColor
                    : 'border-gray-200 text-gray-500 bg-white hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {f.label}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                  isActive ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {cnt}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mx-4 mt-3 flex-shrink-0 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          {error}
        </div>
      )}

      {/* ── Scrollable list + pagination ── */}
      <div className="flex-1 min-h-0 px-4 py-3">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col h-full overflow-hidden">

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {showSkeleton ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            ) : currentItems.length === 0 ? (
              <EmptyState message={
                dateFilter !== 'all'
                  ? `No patients due in this period`
                  : activeTab === 'active' ? 'No active follow-ups found'
                  : activeTab === 'cold'   ? 'No cold leads found'
                  : 'No post-surgery patients found'
              } />
            ) : activeTab === 'active' ? (
              filteredActive.map((row) => (
                <div
                  key={row.sessionId}
                  className={`flex items-center gap-3 pl-0 pr-3 py-2.5 border-b border-gray-100 border-l-4 hover:bg-gray-50/80 transition-colors ${ALERT_BORDER[row.alertLevel] ?? 'border-l-blue-200'}`}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ml-3">
                    {row.patientName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{row.patientName}</span>
                      {row.uhid && <span className="text-xs text-gray-400 font-mono">#{row.uhid}</span>}
                      {row.phone && <span className="text-xs text-gray-400 font-mono">{row.phone}</span>}
                      {row.alertLevel !== 'Normal' && (
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                          row.alertLevel === 'Critical' ? 'bg-red-100 text-red-700' :
                          row.alertLevel === 'High'     ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'
                        }`}>{row.alertLevel}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 flex-wrap">
                      {row.patientIntention && (
                        <span className={`px-2 py-0.5 rounded-full font-medium text-[11px] ${INTENTION_COLOR[row.patientIntention] ?? 'bg-gray-100 text-gray-600'}`}>
                          {INTENTION_LABEL[row.patientIntention] ?? row.patientIntention}
                        </span>
                      )}
                      {row.recommendedSurgery && <><span className="text-gray-300">·</span><span>{row.recommendedSurgery}</span></>}
                      {row.lastContactDate ? (
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(row.lastContactDate)} · {row.contactAttemptCount} attempt{row.contactAttemptCount !== 1 ? 's' : ''}</span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="w-3 h-3" />Never contacted</span>
                      )}
                    </div>
                  </div>
                  <ActionButtons
                    onCall={() => setContactModal({ sessionId: row.sessionId, patientName: row.patientName, phone: row.phone })}
                    onReminder={() => setReminderModal({ patientId: row.patientId, patientName: row.patientName, phone: row.phone })}
                    onHistory={() => setHistoryDrawer({ sessionId: row.sessionId, patientName: row.patientName })}
                    onReQueue={() => setReQueueModal({ sessionId: row.sessionId, patientName: row.patientName })}
                    onReevaluate={() => router.push(`/dashboard/counsellors-desk/${row.sessionId}`)}
                  />
                </div>
              ))
            ) : activeTab === 'cold' ? (
              filteredCold.map((row) => (
                <div key={row.sessionId} className="flex items-center gap-3 pl-0 pr-3 py-2.5 border-b border-gray-100 border-l-4 border-l-rose-400 hover:bg-gray-50/80 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-400 to-red-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ml-3">
                    {row.patientName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{row.patientName}</span>
                      {row.uhid && <span className="text-xs text-gray-400 font-mono">#{row.uhid}</span>}
                      {row.phone && <span className="text-xs text-gray-400 font-mono">{row.phone}</span>}
                      {row.patientIntention && (
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${INTENTION_COLOR[row.patientIntention] ?? 'bg-gray-100 text-gray-600'}`}>
                          {INTENTION_LABEL[row.patientIntention] ?? row.patientIntention}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 flex-wrap">
                      {row.recommendedSurgery && <span>{row.recommendedSurgery}</span>}
                      {row.recommendedSurgery && <span className="text-gray-300">·</span>}
                      <span>Session: {fmtDate(row.sessionDate)}</span>
                      {row.lastContactDate && (
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Last: {fmtDate(row.lastContactDate)} · {row.contactAttemptCount} attempt{row.contactAttemptCount !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                  <ActionButtons
                    onCall={() => setContactModal({ sessionId: row.sessionId, patientName: row.patientName, phone: row.phone })}
                    onReminder={() => setReminderModal({ patientId: row.patientId, patientName: row.patientName, phone: row.phone })}
                    onHistory={() => setHistoryDrawer({ sessionId: row.sessionId, patientName: row.patientName })}
                    onReQueue={() => setReQueueModal({ sessionId: row.sessionId, patientName: row.patientName })}
                    onReevaluate={() => router.push(`/dashboard/counsellors-desk/${row.sessionId}`)}
                  />
                </div>
              ))
            ) : (
              filteredPost.map((row) => {
                const daysSince = row.daysSinceDischarge ?? 0;
                const urgent = daysSince >= 30;
                return (
                  <div key={row.journeyId} className={`flex items-center gap-3 pl-0 pr-3 py-2.5 border-b border-gray-100 border-l-4 hover:bg-gray-50/80 transition-colors ${urgent ? 'border-l-amber-400' : 'border-l-emerald-400'}`}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ml-3">
                      {row.patientName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">{row.patientName}</span>
                        {row.uhid && <span className="text-xs text-gray-400 font-mono">#{row.uhid}</span>}
                        {row.phone && <span className="text-xs text-gray-400 font-mono">{row.phone}</span>}
                        {urgent && <span className="text-[11px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">{daysSince}d post-op</span>}
                        {row.conditionAtDischarge && (
                          <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                            row.conditionAtDischarge === 'Good'     ? 'bg-emerald-100 text-emerald-700' :
                            row.conditionAtDischarge === 'Fair'     ? 'bg-amber-100 text-amber-700' :
                            row.conditionAtDischarge === 'Critical' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                          }`}>{row.conditionAtDischarge}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 flex-wrap">
                        {row.surgeryType && <span>{row.surgeryType}</span>}
                        {row.dischargeDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Discharged: {fmtDate(row.dischargeDate)}</span>}
                        {(row.pendingPostOpVisits ?? 0) > 0 && (
                          <span className="flex items-center gap-1 text-blue-600"><CheckCircle className="w-3 h-3" />{row.pendingPostOpVisits} visit{row.pendingPostOpVisits !== 1 ? 's' : ''} pending</span>
                        )}
                      </div>
                    </div>
                    <ActionButtons
                      onCall={() => setContactModal({ sessionId: row.sessionId ?? row.journeyId, patientName: row.patientName, phone: row.phone })}
                      onReminder={() => setReminderModal({ patientId: row.patientId, patientName: row.patientName, phone: row.phone, journeyId: row.journeyId })}
                      onHistory={() => setHistoryDrawer({ sessionId: row.sessionId ?? row.journeyId, patientName: row.patientName })}
                      onScheduleVisit={() => toast('Scheduler opening soon')}
                      onReevaluate={() => router.push(`/dashboard/counsellors-desk/${row.sessionId ?? row.journeyId}`)}
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* ── Pagination ── */}
          {currentTotal > PAGE_SIZE && (
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50/60">
              <span className="text-xs text-gray-500">
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, currentTotal)} of {currentTotal}
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  className="px-3 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>
                {Array.from({ length: Math.min(5, Math.ceil(currentTotal / PAGE_SIZE)) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-7 h-7 text-xs rounded-lg transition-colors ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'border border-gray-200 hover:bg-gray-100 text-gray-600'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  disabled={currentPage * PAGE_SIZE >= currentTotal}
                  onClick={() => handlePageChange(currentPage + 1)}
                  className="px-3 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals & drawers ── */}
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
