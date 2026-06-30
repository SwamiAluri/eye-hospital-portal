'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, User, Stethoscope, CreditCard, ClipboardList,
  FileText, Activity, Clock, Building2, Lock, AlertTriangle,
  Plus, CheckCircle2, X, IndianRupee,
} from 'lucide-react';
import {
  ipManagementApi,
  PatientJourneyDetailDto,
  BillingTransactionDto,
  IntraOpNoteDto,
  JourneyAuditLogDto,
  PostOpInstructionDto,
  AddBillingTransactionRequest,
  DischargeSummaryDto,
  SaveDischargeSummaryRequest,
  UpdateWardAssignmentRequest,
} from '@/lib/api/ip-management.api';
import { JourneyPreOpSummary } from '@/components/ip-management/JourneyPreOpSummary';
import { ChecklistPhaseStatusChips } from '@/components/ip-management/ChecklistPhaseStatusChips';

// ─── Types ────────────────────────────────────────────────────────────────────

type JourneyTab = 'overview' | 'ward' | 'preop' | 'billing' | 'ot' | 'postop' | 'discharge' | 'audit';

// ─── Stepper Config ───────────────────────────────────────────────────────────

const CLINICAL_STEPS: { key: string; label: string }[] = [
  { key: 'Expected',          label: 'Expected' },
  { key: 'PreOpInProgress',   label: 'Pre-Op' },
  { key: 'Admitted',          label: 'Admitted' },
  { key: 'ReadyForSurgery',   label: 'Ready for OT' },
  { key: 'SentToOT',          label: 'Sent to OT' },
  { key: 'InOT',              label: 'In OT' },
  { key: 'SurgeryCompleted',  label: 'Surgery Done' },
  { key: 'PostOpInProgress',  label: 'Post-Op' },
  { key: 'ReadyForDischarge', label: 'Ready D/C' },
  { key: 'Discharged',        label: 'Discharged' },
];

const STEP_COLORS: Record<string, { dot: string; line: string; text: string; bg: string }> = {
  Expected:          { dot: 'bg-blue-500   border-blue-500',   line: 'bg-blue-200',   text: 'text-blue-700',    bg: 'bg-blue-50' },
  PreOpInProgress:   { dot: 'bg-indigo-500 border-indigo-500', line: 'bg-indigo-200', text: 'text-indigo-700',  bg: 'bg-indigo-50' },
  Admitted:          { dot: 'bg-teal-500   border-teal-500',   line: 'bg-teal-200',   text: 'text-teal-700',    bg: 'bg-teal-50' },
  ReadyForSurgery:   { dot: 'bg-violet-500 border-violet-500', line: 'bg-violet-200', text: 'text-violet-700',  bg: 'bg-violet-50' },
  SentToOT:          { dot: 'bg-purple-500 border-purple-500', line: 'bg-purple-200', text: 'text-purple-700',  bg: 'bg-purple-50' },
  InOT:              { dot: 'bg-amber-500  border-amber-500',  line: 'bg-amber-200',  text: 'text-amber-700',   bg: 'bg-amber-50' },
  SurgeryCompleted:  { dot: 'bg-green-500  border-green-500',  line: 'bg-green-200',  text: 'text-green-700',   bg: 'bg-green-50' },
  PostOpInProgress:  { dot: 'bg-cyan-500   border-cyan-500',   line: 'bg-cyan-200',   text: 'text-cyan-700',    bg: 'bg-cyan-50' },
  ReadyForDischarge: { dot: 'bg-emerald-500 border-emerald-500', line: 'bg-emerald-200', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  Discharged:        { dot: 'bg-gray-400   border-gray-400',   line: 'bg-gray-200',   text: 'text-gray-600',    bg: 'bg-gray-100' },
};

const FINANCIAL_TRANSITIONS: Record<string, string[]> = {
  NotCreated:    ['Draft'],
  Draft:         ['Estimated', 'Confirmed'],
  Estimated:     ['Confirmed'],
  Confirmed:     ['PartiallyPaid'],
  PartiallyPaid: ['Paid'],
  Paid:          ['Settled'],
  Settled:       [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(dt: string | null | undefined): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function fmtDate(dt: string | null | undefined): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtINR(amount: number | null | undefined): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(amount ?? 0);
}

// ─── Small components ─────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
      <span className="text-xs text-gray-400 sm:w-44 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value ?? '—'}</span>
    </div>
  );
}

function SectionCard({ title, icon, children, action }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-blue-600">{icon}</span>
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        </div>
        {action}
      </div>
      <div className="px-5 py-4 space-y-3">{children}</div>
    </div>
  );
}

function TxBadge({ type }: { type: string }) {
  const isCredit = ['Payment', 'Advance'].includes(type);
  const isDebit = type === 'Refund';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
      isCredit ? 'bg-green-100 text-green-700' : isDebit ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
    }`}>
      {type}
    </span>
  );
}

function FsBadge({ state }: { state: string }) {
  const map: Record<string, string> = {
    NotCreated: 'bg-gray-100 text-gray-500',
    Draft: 'bg-slate-100 text-slate-600',
    Estimated: 'bg-blue-50 text-blue-600',
    Confirmed: 'bg-indigo-50 text-indigo-700 font-semibold',
    PartiallyPaid: 'bg-amber-50 text-amber-700',
    Paid: 'bg-green-50 text-green-700 font-semibold',
    Settled: 'bg-teal-50 text-teal-700',
  };
  const labels: Record<string, string> = {
    NotCreated: 'No Bill', Draft: 'Draft', Estimated: 'Estimated',
    Confirmed: 'Confirmed', PartiallyPaid: 'Partial', Paid: 'Paid', Settled: 'Settled',
  };
  return (
    <span className={`inline-flex px-2 py-1 rounded-lg text-xs ${map[state] ?? 'bg-gray-100 text-gray-500'}`}>
      {labels[state] ?? state}
    </span>
  );
}

// ─── Add Transaction (inline) ─────────────────────────────────────────────────

function AddTransactionForm({
  onClose, onSave,
}: {
  onClose: () => void;
  onSave: (req: AddBillingTransactionRequest) => Promise<void>;
}) {
  const [form, setForm] = useState<AddBillingTransactionRequest>({
    transactionType: 'Advance', amount: 0, paymentMode: 'Cash', referenceNumber: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (form.amount <= 0) return;
    setSaving(true);
    try { await onSave(form); onClose(); }
    finally { setSaving(false); }
  }

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3 mb-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-blue-800">New Transaction</p>
        <button onClick={onClose} className="p-1 text-blue-400 hover:text-blue-700">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select value={form.transactionType} onChange={e => setForm(f => ({ ...f, transactionType: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
            {['Advance', 'Payment', 'Refund', 'Package', 'Charge'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Mode</label>
          <select value={form.paymentMode ?? ''} onChange={e => setForm(f => ({ ...f, paymentMode: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
            {['Cash', 'Card', 'UPI', 'Cheque', 'NEFT', 'RTGS'].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₹) *</label>
          <input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: +e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Reference #</label>
          <input type="text" value={form.referenceNumber ?? ''} onChange={e => setForm(f => ({ ...f, referenceNumber: e.target.value }))}
            placeholder="UTR / Cheque"
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
      </div>
      <input type="text" placeholder="Notes (optional)" value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-white">Cancel</button>
        <button onClick={handleSave} disabled={saving || form.amount <= 0}
          className="px-4 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
          {saving ? 'Saving…' : 'Add'}
        </button>
      </div>
    </div>
  );
}

// ─── Audit Section (Bug #8 fix — calls real API) ─────────────────────────────

function AuditLogSection({ journeyId }: { journeyId: string }) {
  const [logs, setLogs] = useState<JourneyAuditLogDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ipManagementApi.getJourneyAudit(journeyId)
      .then(data => setLogs(Array.isArray(data) ? data : []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [journeyId]);

  if (loading) return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
      ))}
    </div>
  );

  if (logs.length === 0) return (
    <div className="flex flex-col items-center py-8 text-gray-400">
      <Activity className="h-8 w-8 opacity-20 mb-2" />
      <p className="text-sm">No audit events recorded yet</p>
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100">
            {['Field', 'Old Value', 'New Value', 'Changed At'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-gray-500 font-semibold uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {logs.map(l => (
            <tr key={l.id} className="hover:bg-gray-50">
              <td className="px-4 py-2.5 font-medium text-gray-700">{l.fieldChanged}</td>
              <td className="px-4 py-2.5 text-gray-500">{l.oldValue ?? '—'}</td>
              <td className="px-4 py-2.5 text-gray-700">{l.newValue ?? '—'}</td>
              <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{fmt(l.changedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function JourneyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params?.id as string;

  const [journey, setJourney] = useState<PatientJourneyDetailDto | null>(null);
  const [billing, setBilling] = useState<BillingTransactionDto[]>([]);
  const [intraOp, setIntraOp] = useState<IntraOpNoteDto | null>(null);
  const [dischargeSummary, setDischargeSummary] = useState<DischargeSummaryDto | null>(null);
  // Bug #7 fix: single object, not array
  const [postOpInstruction, setPostOpInstruction] = useState<PostOpInstructionDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<JourneyTab>(() => {
    const t = searchParams?.get('tab');
    return (t as JourneyTab) ?? 'overview';
  });
  const [showAddTx, setShowAddTx] = useState(() => searchParams?.get('action') === 'advance');
  const [transitioningTo, setTransitioningTo] = useState<string | null>(null);
  const [isEditingDischarge, setIsEditingDischarge] = useState(false);
  // Bug #6 fix: correct field names aligned with SaveDischargeSummaryRequest
  const [dsForm, setDsForm] = useState<SaveDischargeSummaryRequest>({ formatType: 'Short' });
  const [savingDs, setSavingDs] = useState(false);
  const [showWardEdit, setShowWardEdit] = useState(false);
  const [wardEditForm, setWardEditForm] = useState({
    bedNumber: '', admissionType: '', attendantName: '', attendantPhone: '', attendantRelationship: '',
  });
  const [savingWardEdit, setSavingWardEdit] = useState(false);

  // Load main data
  useEffect(() => {
    if (!id) return;
    (async () => {
      setIsLoading(true);
      try {
        const [journeyData, billingData, intraOpData] = await Promise.all([
          ipManagementApi.getJourneyDetail(id),
          ipManagementApi.listBilling(id),
          ipManagementApi.getIntraOpNote(id),
        ]);
        setJourney(journeyData);
        setBilling(billingData);
        setIntraOp(intraOpData);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [id]);

  // Lazy-load tab-specific data
  useEffect(() => {
    if (activeTab === 'discharge' && !dischargeSummary && id) {
      ipManagementApi.getDischargeSummary(id).then(d => setDischargeSummary(d));
    }
    // Bug #7 fix: correct method, store as single object
    if (activeTab === 'postop' && !postOpInstruction && id) {
      ipManagementApi.getPostOpInstructions(id).then(ins => setPostOpInstruction(ins));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id]);

  const handleAddTransaction = useCallback(async (req: AddBillingTransactionRequest) => {
    const added = await ipManagementApi.addBilling(id, req);
    if (added) setBilling(prev => [added, ...prev]);
  }, [id]);

  async function handleFinancialTransition(toState: string) {
    setTransitioningTo(toState);
    try {
      const updated = await ipManagementApi.transitionFinancial(id, { newState: toState });
      if (updated) setJourney(updated);
    } finally { setTransitioningTo(null); }
  }

  async function handleSaveWardEdit() {
    setSavingWardEdit(true);
    try {
      const req: UpdateWardAssignmentRequest = {
        bedNumber: wardEditForm.bedNumber || undefined,
        admissionType: wardEditForm.admissionType || undefined,
        attendantName: wardEditForm.attendantName || undefined,
        attendantPhone: wardEditForm.attendantPhone || undefined,
        attendantRelationship: wardEditForm.attendantRelationship || undefined,
      };
      const updated = await ipManagementApi.updateWardAssignment(id, req);
      if (updated) setJourney(updated);
      setShowWardEdit(false);
    } finally { setSavingWardEdit(false); }
  }

  async function handleSaveDischarge() {
    setSavingDs(true);
    try {
      await ipManagementApi.saveDischargeSummary(id, dsForm);
      const updated = await ipManagementApi.getDischargeSummary(id);
      setDischargeSummary(updated);
      setIsEditingDischarge(false);
    } finally { setSavingDs(false); }
  }

  async function handleFinalizeDischarge() {
    if (!confirm('Finalize discharge summary? This cannot be undone.')) return;
    const updated = await ipManagementApi.finalizeDischargeSummary(id);
    if (updated) setDischargeSummary(updated);
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex gap-6 p-4 animate-pulse">
        <div className="w-64 shrink-0 space-y-4">
          <div className="h-32 bg-gray-200 rounded-xl" />
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full bg-gray-200 shrink-0" />
                <div className="h-3 bg-gray-200 rounded flex-1" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 space-y-4">
          <div className="h-10 bg-gray-200 rounded-xl" />
          <div className="h-48 bg-gray-200 rounded-xl" />
          <div className="h-32 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!journey) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <User className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-base font-medium">Patient journey not found</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-blue-600 hover:text-blue-700">
          ← Go Back
        </button>
      </div>
    );
  }

  const currentStepIdx = CLINICAL_STEPS.findIndex(s => s.key === journey.clinicalState);
  const allowedFinancial = FINANCIAL_TRANSITIONS[journey.financialState] ?? [];
  const totalPaid = billing
    .filter(t => ['Payment', 'Advance'].includes(t.transactionType))
    .reduce((s, t) => s + t.amount, 0);

  const TABS: { id: JourneyTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview',  label: 'Overview',  icon: <User className="h-3.5 w-3.5" /> },
    { id: 'ward',      label: 'Ward',      icon: <Building2 className="h-3.5 w-3.5" /> },
    { id: 'preop',     label: 'Pre-Op',    icon: <ClipboardList className="h-3.5 w-3.5" /> },
    { id: 'billing',   label: 'Billing',   icon: <CreditCard className="h-3.5 w-3.5" /> },
    { id: 'ot',        label: 'Theatre',   icon: <Stethoscope className="h-3.5 w-3.5" /> },
    { id: 'postop',    label: 'Post-Op',   icon: <Activity className="h-3.5 w-3.5" /> },
    { id: 'discharge', label: 'Discharge', icon: <ClipboardList className="h-3.5 w-3.5" /> },
    { id: 'audit',     label: 'Audit Log', icon: <FileText className="h-3.5 w-3.5" /> },
  ];

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-0 min-h-screen -mx-4 -my-4">

      {/* ── Left Sidebar: Patient card + Vertical stepper ── */}
      <aside className="w-64 shrink-0 bg-white border-r border-gray-100 flex flex-col overflow-y-auto">

        {/* Back + patient name */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-3 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>

          {/* Patient avatar + name */}
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0">
              <span className="text-white text-sm font-bold">
                {(journey.patientName ?? 'P')[0].toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm leading-tight">{journey.patientName ?? '—'}</p>
              <p className="text-xs font-mono text-blue-600 mt-0.5">{journey.uhid ?? '—'}</p>
              <p className="text-xs text-gray-400">{journey.procedureName ?? '—'}</p>
            </div>
          </div>

          {/* Status chips */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {journey.isLocked && (
              <span className="inline-flex items-center gap-0.5 text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                <Lock className="h-2.5 w-2.5" /> Locked
              </span>
            )}
            {journey.isBillingLocked && (
              <span className="inline-flex items-center gap-0.5 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                <Lock className="h-2.5 w-2.5" /> Bill Lock
              </span>
            )}
            {journey.isEmergencyFc && (
              <span className="inline-flex items-center gap-0.5 text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                <AlertTriangle className="h-2.5 w-2.5" /> Emg FC
              </span>
            )}
          </div>
          <div className="mt-2">
            <ChecklistPhaseStatusChips
              phaseStatus={journey.checklistPhaseStatus}
              investigationSummary={journey.investigationPhaseSummary}
            />
          </div>
        </div>

        {/* Quick financials */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="bg-gray-50 rounded-lg py-2">
              <p className="text-[10px] text-gray-400">Package</p>
              <p className="text-xs font-bold text-gray-800">{fmtINR(journey.packageAmount)}</p>
            </div>
            <div className="bg-green-50 rounded-lg py-2">
              <p className="text-[10px] text-gray-400">Paid</p>
              <p className="text-xs font-bold text-green-700">{fmtINR(totalPaid)}</p>
            </div>
            <div className={`rounded-lg py-2 ${journey.balanceDue > 0 ? 'bg-red-50' : 'bg-teal-50'}`}>
              <p className="text-[10px] text-gray-400">Balance</p>
              <p className={`text-xs font-bold ${journey.balanceDue > 0 ? 'text-red-600' : 'text-teal-600'}`}>
                {journey.balanceDue > 0 ? fmtINR(journey.balanceDue) : 'Nil'}
              </p>
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5">
            <IndianRupee className="h-3 w-3 text-gray-400" />
            <FsBadge state={journey.financialState} />
          </div>
        </div>

        {/* Vertical stepper */}
        <div className="flex-1 px-4 py-4 overflow-y-auto">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-3">
            Clinical Journey
          </p>
          <div className="relative pl-3">
            {CLINICAL_STEPS.map((step, idx) => {
              const isDone = idx < currentStepIdx;
              const isCurrent = idx === currentStepIdx;
              const cfg = STEP_COLORS[step.key] ?? STEP_COLORS.Discharged;
              const isLast = idx === CLINICAL_STEPS.length - 1;

              return (
                <div key={step.key} className="flex gap-3 pb-0">
                  {/* dot + connector line */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center text-[9px] font-bold transition-all ${
                      isCurrent
                        ? `${cfg.dot} text-white`
                        : isDone
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'bg-white border-gray-200 text-gray-300'
                    }`}>
                      {isDone ? '✓' : idx + 1}
                    </div>
                    {!isLast && (
                      <div className={`w-0.5 flex-1 min-h-[20px] ${isDone ? 'bg-green-300' : 'bg-gray-100'}`} />
                    )}
                  </div>

                  {/* label */}
                  <div className={`pb-4 pt-0.5 min-w-0 ${isLast ? '' : ''}`}>
                    <p className={`text-xs font-medium leading-tight ${
                      isCurrent ? `${cfg.text} font-semibold` : isDone ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      {step.label}
                    </p>
                    {isCurrent && (
                      <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full mt-1 ${cfg.bg} ${cfg.text}`}>
                        Current
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tab nav (vertical pill list) */}
        <div className="border-t border-gray-100 p-3 space-y-0.5">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-y-auto bg-gray-50">

        {/* Sticky content header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-800">
              {TABS.find(t => t.id === activeTab)?.label}
            </h2>
            {activeTab === 'billing' && !journey.isLocked && (
              <button
                onClick={() => setShowAddTx(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  showAddTx
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
                {showAddTx ? 'Cancel' : 'Add Transaction'}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">
            Last updated: {fmt(journey.updatedAt)}
          </p>
        </div>

        <div className="p-6 space-y-4">

          {/* ── OVERVIEW ───────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard title="Clinical Details" icon={<Stethoscope className="h-4 w-4" />}>
                <InfoRow label="Eye Operated" value={journey.eyeOperated} />
                <InfoRow label="Procedure" value={journey.procedureName} />
                <InfoRow label="Clinical State" value={journey.clinicalState} />
                <InfoRow label="OT State" value={journey.otState} />
                <InfoRow label="Post-Op State" value={journey.postOpState} />
              </SectionCard>

              <SectionCard title="Admission Timeline" icon={<Clock className="h-4 w-4" />}>
                <InfoRow label="Admitted At" value={fmt(journey.admittedAt)} />
                <InfoRow label="Scheduled Surgery" value={fmt(journey.surgeryScheduledAt)} />
                <InfoRow label="Surgery Started" value={fmt(journey.surgeryStartedAt)} />
                <InfoRow label="Surgery Ended" value={fmt(journey.surgeryEndedAt)} />
                <InfoRow label="Discharged At" value={fmt(journey.dischargedAt)} />
              </SectionCard>

              <SectionCard title="Ward Assignment" icon={<Building2 className="h-4 w-4" />}>
                <InfoRow label="Ward" value={journey.wardName} />
                <InfoRow label="Room / Bed" value={journey.bedNumber} />
                <InfoRow label="Admission Type" value={journey.admissionType} />
              </SectionCard>

              <SectionCard title="Financial Summary" icon={<CreditCard className="h-4 w-4" />}>
                <InfoRow label="Financial State" value={journey.financialState} />
                <InfoRow label="Package Amount" value={fmtINR(journey.packageAmount)} />
                <InfoRow label="Total Billed" value={fmtINR(journey.totalBilled)} />
                <InfoRow label="Total Paid" value={fmtINR(totalPaid)} />
                <InfoRow label="Balance Due" value={fmtINR(journey.balanceDue)} />
                {journey.emergencyFcReason && (
                  <InfoRow label="Emergency FC Reason" value={journey.emergencyFcReason} />
                )}
              </SectionCard>
            </div>
          )}

          {/* ── WARD ──────────────────────────────────────────── */}
          {activeTab === 'ward' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard
                title="Ward & Room"
                icon={<Building2 className="h-4 w-4" />}
                action={
                  !journey.isLocked ? (
                    <button
                      onClick={() => {
                        setWardEditForm({
                          bedNumber: journey.bedNumber ?? '',
                          admissionType: journey.admissionType ?? '',
                          attendantName: journey.attendantName ?? '',
                          attendantPhone: journey.attendantPhone ?? '',
                          attendantRelationship: journey.attendantRelationship ?? '',
                        });
                        setShowWardEdit(w => !w);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      {showWardEdit ? <><X className="h-3 w-3" /> Cancel</> : '✎ Edit'}
                    </button>
                  ) : undefined
                }
              >
                {showWardEdit ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Room / Bed</label>
                        <input type="text" value={wardEditForm.bedNumber}
                          onChange={e => setWardEditForm(f => ({ ...f, bedNumber: e.target.value }))}
                          placeholder="e.g. Room 4 – Bed B"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Admission Type</label>
                        <select value={wardEditForm.admissionType}
                          onChange={e => setWardEditForm(f => ({ ...f, admissionType: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="">— Select —</option>
                          <option>DayCare</option><option>IPD</option><option>Emergency</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">Attendant / Guardian</p>
                      <div className="grid grid-cols-3 gap-2">
                        <input type="text" value={wardEditForm.attendantName}
                          onChange={e => setWardEditForm(f => ({ ...f, attendantName: e.target.value }))}
                          placeholder="Name"
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <input type="tel" value={wardEditForm.attendantPhone}
                          onChange={e => setWardEditForm(f => ({ ...f, attendantPhone: e.target.value }))}
                          placeholder="Phone"
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <input type="text" value={wardEditForm.attendantRelationship}
                          onChange={e => setWardEditForm(f => ({ ...f, attendantRelationship: e.target.value }))}
                          placeholder="Relation"
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
                      <button onClick={() => setShowWardEdit(false)}
                        className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
                        Cancel
                      </button>
                      <button onClick={handleSaveWardEdit} disabled={savingWardEdit}
                        className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50">
                        {savingWardEdit ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <InfoRow label="Ward" value={journey.wardName} />
                    <InfoRow label="Room / Bed" value={journey.bedNumber} />
                    <InfoRow label="Admitted At" value={fmt(journey.admittedAt)} />
                    <InfoRow label="Admission Type" value={journey.admissionType} />
                    {journey.attendantName && (
                      <InfoRow
                        label="Attendant"
                        value={`${journey.attendantName}${journey.attendantRelationship ? ` (${journey.attendantRelationship})` : ''}`}
                      />
                    )}
                    {journey.attendantPhone && (
                      <InfoRow label="Attendant Phone" value={journey.attendantPhone} />
                    )}
                  </>
                )}
              </SectionCard>

              <SectionCard title="Clinical State" icon={<Activity className="h-4 w-4" />}>
                <InfoRow label="Current State" value={journey.clinicalState} />
                <InfoRow label="OT State" value={journey.otState} />
                <InfoRow label="Post-Op State" value={journey.postOpState} />
                <InfoRow label="Locked" value={journey.isLocked ? 'Yes' : 'No'} />
              </SectionCard>
            </div>
          )}

          {/* ── PRE-OP ────────────────────────────────────────── */}
          {activeTab === 'preop' && journey && (
            <JourneyPreOpSummary
              journeyId={id}
              counselingSessionId={journey.counselingSessionId}
              paymentMode={journey.paymentMode ?? undefined}
              clinicalState={journey.clinicalState}
              onOpenWorkspace={() => router.push('/dashboard/ip-management/ward')}
            />
          )}

          {/* ── BILLING ───────────────────────────────────────── */}
          {activeTab === 'billing' && (
            <>
              {showAddTx && (
                <AddTransactionForm
                  onClose={() => setShowAddTx(false)}
                  onSave={handleAddTransaction}
                />
              )}

              <SectionCard title="Financial State" icon={<CreditCard className="h-4 w-4" />}>
                <div className="flex flex-wrap items-center gap-3">
                  <FsBadge state={journey.financialState} />
                  {journey.isBillingLocked && (
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      <Lock className="h-2.5 w-2.5" /> Billing Locked
                    </span>
                  )}
                  {journey.isEmergencyFc && (
                    <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="h-2.5 w-2.5" /> Emergency FC
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-0.5">Package</p>
                    <p className="text-base font-bold text-gray-800">{fmtINR(journey.packageAmount)}</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-0.5">Total Paid</p>
                    <p className="text-base font-bold text-green-700">{fmtINR(totalPaid)}</p>
                  </div>
                  <div className={`text-center p-3 rounded-lg ${journey.balanceDue > 0 ? 'bg-red-50' : 'bg-teal-50'}`}>
                    <p className="text-xs text-gray-500 mb-0.5">Balance Due</p>
                    <p className={`text-base font-bold ${journey.balanceDue > 0 ? 'text-red-600' : 'text-teal-600'}`}>
                      {journey.balanceDue > 0 ? fmtINR(journey.balanceDue) : 'Nil'}
                    </p>
                  </div>
                </div>

                {allowedFinancial.length > 0 && !journey.isLocked && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                    <span className="text-xs text-gray-400">Advance to:</span>
                    {allowedFinancial.map(state => (
                      <button
                        key={state}
                        onClick={() => handleFinancialTransition(state)}
                        disabled={!!transitioningTo}
                        className="px-3 py-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium disabled:opacity-50"
                      >
                        {transitioningTo === state ? 'Saving…' : state}
                      </button>
                    ))}
                  </div>
                )}
              </SectionCard>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-blue-600" />
                    <h3 className="text-sm font-semibold text-gray-800">Transaction Ledger</h3>
                  </div>
                  <span className="text-xs text-gray-400">{billing.length} entries</span>
                </div>
                {billing.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No transactions recorded</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          {['Date', 'Type', 'Amount', 'Mode', 'Reference', 'Notes'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {billing.map(tx => {
                          const isCredit = ['Payment', 'Advance'].includes(tx.transactionType);
                          const isDebit = tx.transactionType === 'Refund';
                          return (
                            <tr key={tx.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmt(tx.createdAt)}</td>
                              <td className="px-4 py-3"><TxBadge type={tx.transactionType} /></td>
                              <td className={`px-4 py-3 text-sm font-semibold ${isCredit ? 'text-green-700' : isDebit ? 'text-red-600' : 'text-gray-800'}`}>
                                {isDebit ? '-' : isCredit ? '+' : ''}{fmtINR(tx.amount)}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500">{tx.paymentMode ?? '—'}</td>
                              <td className="px-4 py-3 text-xs font-mono text-gray-500">{tx.referenceNumber ?? '—'}</td>
                              <td className="px-4 py-3 text-xs text-gray-500 max-w-[160px] truncate">{tx.notes ?? '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── OT ────────────────────────────────────────────── */}
          {activeTab === 'ot' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard title="OT Details" icon={<Stethoscope className="h-4 w-4" />}>
                <InfoRow label="OT Room" value={journey.otRoomNumber} />
                <InfoRow label="Surgeon" value={journey.surgeonName} />
                <InfoRow label="Anesthesiologist" value={journey.anesthesiologistName} />
                <InfoRow label="Scrub Nurse" value={journey.scrubNurseName} />
                <InfoRow label="OT State" value={journey.otState} />
                {journey.isBillingLocked && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg">
                    <Lock className="h-3 w-3" /> Billing locked during surgery
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Surgery Timeline" icon={<Clock className="h-4 w-4" />}>
                <InfoRow label="Scheduled" value={fmt(journey.surgeryScheduledAt)} />
                <InfoRow label="Surgery Started" value={fmt(journey.surgeryStartedAt)} />
                <InfoRow label="Surgery Ended" value={fmt(journey.surgeryEndedAt)} />
                {journey.surgeryStartedAt && journey.surgeryEndedAt && (() => {
                  const mins = Math.round(
                    (new Date(journey.surgeryEndedAt!).getTime() - new Date(journey.surgeryStartedAt!).getTime()) / 60000
                  );
                  return <InfoRow label="Duration" value={`${mins} min`} />;
                })()}
              </SectionCard>

              {intraOp ? (
                <div className="lg:col-span-2">
                  <SectionCard title="Intra-Operative Note" icon={<FileText className="h-4 w-4" />}>
                    {intraOp.isSigned && (
                      <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Signed at {fmt(intraOp.signedAt)}
                      </div>
                    )}
                    <InfoRow label="Note" value={intraOp.noteText} />
                    <InfoRow label="Complications" value={intraOp.complications} />
                    <InfoRow label="Implant Used" value={intraOp.implantUsed} />
                    <InfoRow label="Implant Batch #" value={intraOp.implantBatchNumber} />
                    <p className="text-xs text-gray-400">Last updated: {fmt(intraOp.updatedAt)}</p>
                  </SectionCard>
                </div>
              ) : (
                <div className="lg:col-span-2 flex items-center justify-center py-8 text-gray-400">
                  <p className="text-sm">No intra-operative note recorded</p>
                </div>
              )}
            </div>
          )}

          {/* ── POST-OP (Bug #7 fix) ───────────────────────────── */}
          {activeTab === 'postop' && (
            <div className="space-y-4">
              <SectionCard title="Post-Op Status" icon={<Activity className="h-4 w-4" />}>
                <InfoRow label="Clinical State" value={journey.clinicalState} />
                <InfoRow label="Post-Op State" value={journey.postOpState ?? '—'} />
                <InfoRow label="Surgery Ended" value={fmt(journey.surgeryEndedAt)} />
              </SectionCard>

              <SectionCard title="Post-Op Instructions" icon={<ClipboardList className="h-4 w-4" />}>
                {!postOpInstruction ? (
                  <p className="text-sm text-gray-400 py-2">No post-op instructions recorded</p>
                ) : (
                  <div className="space-y-3">
                    {postOpInstruction.medications && (
                      <InfoRow label="Medications" value={postOpInstruction.medications} />
                    )}
                    {postOpInstruction.activityRestrictions && (
                      <InfoRow label="Activity Restrictions" value={postOpInstruction.activityRestrictions} />
                    )}
                    {postOpInstruction.dietaryInstructions && (
                      <InfoRow label="Dietary Instructions" value={postOpInstruction.dietaryInstructions} />
                    )}
                    {postOpInstruction.eyeCareInstructions && (
                      <InfoRow label="Eye Care Instructions" value={postOpInstruction.eyeCareInstructions} />
                    )}
                    {postOpInstruction.warningSigns && (
                      <InfoRow label="Warning Signs" value={postOpInstruction.warningSigns} />
                    )}
                    {postOpInstruction.followupDate && (
                      <InfoRow label="Follow-up Date" value={fmtDate(postOpInstruction.followupDate)} />
                    )}
                    {postOpInstruction.isSaved && (
                      <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-lg mt-2">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Saved at {fmt(postOpInstruction.savedAt)}
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {/* ── DISCHARGE (Bug #6 fix) ─────────────────────────── */}
          {activeTab === 'discharge' && (
            <div className="space-y-4">
              {!dischargeSummary ? (
                <div className="flex items-center justify-center py-12 text-gray-400">
                  <p className="text-sm">Loading discharge summary…</p>
                </div>
              ) : (
                <>
                  <SectionCard
                    title="Discharge Summary"
                    icon={<ClipboardList className="h-4 w-4" />}
                    action={
                      dischargeSummary.summaryStatus === 'Finalized' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3 w-3" /> Finalized
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setIsEditingDischarge(true);
                            setDsForm({
                              conditionAtDischarge: dischargeSummary.conditionAtDischarge ?? '',
                              diagnosisCodes: dischargeSummary.diagnosisCodes ?? '',
                              proceduresPerformed: dischargeSummary.proceduresPerformed ?? '',
                              hospitalCourse: dischargeSummary.hospitalCourse ?? '',
                              dischargeInstructions: dischargeSummary.dischargeInstructions ?? '',
                              medicationsOnDischarge: dischargeSummary.medicationsOnDischarge ?? '',
                              followUpPlan: dischargeSummary.followUpPlan ?? '',
                              formatType: dischargeSummary.formatType ?? 'Short',
                            });
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Edit
                        </button>
                      )
                    }
                  >
                    {dischargeSummary.finalizedAt && (
                      <p className="text-xs text-gray-400">Finalized: {fmt(dischargeSummary.finalizedAt)}</p>
                    )}

                    {isEditingDischarge ? (
                      <div className="space-y-3">
                        {/* Format type */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Format</label>
                          <div className="flex gap-3">
                            {['Short', 'Detailed', 'Typed'].map(f => (
                              <label key={f} className="flex items-center gap-1.5 text-sm cursor-pointer">
                                <input
                                  type="radio"
                                  value={f}
                                  checked={dsForm.formatType === f}
                                  onChange={() => setDsForm(d => ({ ...d, formatType: f }))}
                                  className="text-blue-600"
                                />
                                {f}
                              </label>
                            ))}
                          </div>
                        </div>
                        {/* Correct field names per SaveDischargeSummaryRequest */}
                        {(
                          [
                            ['Condition at Discharge', 'conditionAtDischarge'],
                            ['Diagnosis Codes (ICD-10)', 'diagnosisCodes'],
                            ['Procedures Performed', 'proceduresPerformed'],
                            ['Hospital Course', 'hospitalCourse'],
                            ['Discharge Instructions', 'dischargeInstructions'],
                            ['Medications on Discharge', 'medicationsOnDischarge'],
                            ['Follow-Up Plan', 'followUpPlan'],
                          ] as [string, keyof SaveDischargeSummaryRequest][]
                        ).map(([label, field]) => (
                          <div key={field}>
                            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                            <textarea
                              rows={2}
                              value={(dsForm[field] as string) ?? ''}
                              onChange={e => setDsForm(f => ({ ...f, [field]: e.target.value }))}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                            />
                          </div>
                        ))}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Final Bill Amount (₹)</label>
                          <input
                            type="number" min="0"
                            value={dsForm.finalBillAmount ?? ''}
                            onChange={e => setDsForm(f => ({ ...f, finalBillAmount: e.target.value ? +e.target.value : undefined }))}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-48"
                          />
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                          <button onClick={() => setIsEditingDischarge(false)}
                            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                            Cancel
                          </button>
                          <button onClick={handleSaveDischarge} disabled={savingDs}
                            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                            {savingDs ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <InfoRow label="Format" value={dischargeSummary.formatType} />
                        <InfoRow label="Condition at Discharge" value={dischargeSummary.conditionAtDischarge} />
                        <InfoRow label="Diagnosis Codes" value={dischargeSummary.diagnosisCodes} />
                        <InfoRow label="Procedures Performed" value={dischargeSummary.proceduresPerformed} />
                        <InfoRow label="Hospital Course" value={dischargeSummary.hospitalCourse} />
                        <InfoRow label="Discharge Instructions" value={dischargeSummary.dischargeInstructions} />
                        <InfoRow label="Medications on Discharge" value={dischargeSummary.medicationsOnDischarge} />
                        <InfoRow label="Follow-Up Plan" value={dischargeSummary.followUpPlan} />
                        {dischargeSummary.finalBillAmount && (
                          <InfoRow label="Final Bill Amount" value={fmtINR(dischargeSummary.finalBillAmount)} />
                        )}
                        {dischargeSummary.summaryStatus !== 'Finalized' && (
                          <div className="pt-3 border-t border-gray-100">
                            <button
                              onClick={handleFinalizeDischarge}
                              className="px-4 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium"
                            >
                              ✔ Finalize Discharge Summary
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </SectionCard>

                  <SectionCard title="Discharge Timeline" icon={<Clock className="h-4 w-4" />}>
                    <InfoRow label="Admitted At" value={fmt(journey.admittedAt)} />
                    <InfoRow label="Discharged At" value={fmt(journey.dischargedAt)} />
                    {journey.dischargeOverrideReason && (
                      <InfoRow label="Override Reason" value={journey.dischargeOverrideReason} />
                    )}
                  </SectionCard>
                </>
              )}
            </div>
          )}

          {/* ── AUDIT LOG (Bug #8 fix) ─────────────────────────── */}
          {activeTab === 'audit' && (
            <SectionCard title="Audit Log" icon={<Activity className="h-4 w-4" />}>
              <AuditLogSection journeyId={id} />
            </SectionCard>
          )}

        </div>
      </main>
    </div>
  );
}



