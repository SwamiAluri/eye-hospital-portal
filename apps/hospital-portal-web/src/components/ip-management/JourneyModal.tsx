'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  X, User, Stethoscope, CreditCard, ClipboardList,
  FileText, Activity, Clock, Building2, Lock, AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import {
  ipManagementApi,
  PatientJourneyDetailDto,
  BillingTransactionDto,
  IntraOpNoteDto,
  DischargeSummaryDto,
  PostOpInstructionDto,
  SaveDischargeSummaryRequest,
  UpdateWardAssignmentRequest,
  PatientJourneyRowDto,
} from '@/lib/api/ip-management.api';
import { StatusBadge } from '@/components/counsellors-desk/StatusBadge';
import { JourneyPreOpSummary } from '@/components/ip-management/JourneyPreOpSummary';
import { JourneyPostOpSummary } from '@/components/ip-management/JourneyPostOpSummary';
import { IpOverlayDialog } from '@/components/ip-management/IpOverlayDialog';

// ─── Types ────────────────────────────────────────────────────────────────────

type JourneyTab = 'overview' | 'ward' | 'preop' | 'billing' | 'ot' | 'postop' | 'discharge';

const CLINICAL_STEPS = [
  'Expected', 'Admitted', 'ReadyForSurgery', 'SentToOT',
  'InOT', 'SurgeryCompleted', 'PostOp', 'ReadyForDischarge', 'Discharged',
];

const STEP_LABELS: Record<string, string> = {
  Expected: 'Expected',
  Admitted: 'Admitted',
  ReadyForSurgery: 'Ready',
  SentToOT: 'Sent to OT',
  InOT: 'In OT',
  SurgeryCompleted: 'Surgery Done',
  PostOp: 'Post-Op',
  ReadyForDischarge: 'Ready D/C',
  Discharged: 'Discharged',
};

function getInitialTab(clinicalState: string): JourneyTab {
  if (['SentToOT', 'InOT'].includes(clinicalState)) return 'ot';
  if (['SurgeryCompleted', 'PostOp'].includes(clinicalState)) return 'postop';
  if (['ReadyForDischarge', 'Discharged'].includes(clinicalState)) return 'discharge';
  return 'overview';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(dt: string | null | undefined): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDate(dt: string | null | undefined): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtINR(amount: number | null | undefined): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount ?? 0);
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
      <span className="text-xs text-gray-400 sm:w-44 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value ?? '—'}</span>
    </div>
  );
}

function SectionCard({ title, icon, children, action }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-gray-100 bg-gray-50">
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
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${isCredit ? 'bg-green-100 text-green-700' : isDebit ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
      {type}
    </span>
  );
}

// ─── JourneyModal Props ───────────────────────────────────────────────────────

export type JourneyDeepLinkTarget = 'preop-workspace' | 'postop-workspace';

export interface JourneyModalProps {
  journeyId: string;
  /** Used to pick the opening tab and show optimistic state while data loads */
  clinicalState: string;
  /** Shown in header while detail is loading */
  patientName?: string | null;
  onClose: () => void;
  /** Called whenever a state-changing action (Mark Ready, Discharge, etc.) completes */
  onStateChange?: (updated: Partial<PatientJourneyRowDto>) => void;
  /** Deep link into ward workspace shells (Phase 3 G7) */
  onDeepLink?: (target: JourneyDeepLinkTarget) => void;
}

// ─── JourneyModal ─────────────────────────────────────────────────────────────

export default function JourneyModal({
  journeyId,
  clinicalState,
  patientName,
  onClose,
  onStateChange,
  onDeepLink,
}: JourneyModalProps) {
  const router = useRouter();
  const [journey, setJourney] = useState<PatientJourneyDetailDto | null>(null);
  const [billing, setBilling] = useState<BillingTransactionDto[]>([]);
  const [intraOp, setIntraOp] = useState<IntraOpNoteDto | null>(null);
  const [dischargeSummary, setDischargeSummary] = useState<DischargeSummaryDto | null>(null);
  // Bug #7 fix: single object, not array
  const [postOpInstruction, setPostOpInstruction] = useState<PostOpInstructionDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<JourneyTab>(() => getInitialTab(clinicalState));

  const [isEditingDischarge, setIsEditingDischarge] = useState(false);
  // Bug #6 fix: initialize with required formatType field
  const [dsForm, setDsForm] = useState<SaveDischargeSummaryRequest>({ formatType: 'Short' });
  const [savingDs, setSavingDs] = useState(false);
  const [showWardEdit, setShowWardEdit] = useState(false);
  const [wardEditForm, setWardEditForm] = useState({
    bedNumber: '', admissionType: '', attendantName: '', attendantPhone: '', attendantRelationship: '',
  });
  const [savingWardEdit, setSavingWardEdit] = useState(false);
  const [markingReady, setMarkingReady] = useState(false);
  const [discharging, setDischarging] = useState(false);
  const [feedbackCollected, setFeedbackCollected] = useState(false);
  const [postOpIssued, setPostOpIssued] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [dischargeDateTime, setDischargeDateTime] = useState('');

  // ── Data loading ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!journeyId) return;
    (async () => {
      setIsLoading(true);
      try {
        const [journeyData, billingData, intraOpData] = await Promise.all([
          ipManagementApi.getJourneyDetail(journeyId),
          ipManagementApi.listBilling(journeyId),
          ipManagementApi.getIntraOpNote(journeyId),
        ]);
        setJourney(journeyData);
        setBilling(billingData);
        setIntraOp(intraOpData);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [journeyId]);

  // Lazy load tab-specific data
  useEffect(() => {
    if (activeTab === 'discharge' && !dischargeSummary && journeyId) {
      ipManagementApi.getDischargeSummary(journeyId).then(d => setDischargeSummary(d));
    }
    // Bug #7 fix: API returns single object
    if (activeTab === 'postop' && !postOpInstruction && journeyId) {
      ipManagementApi.getPostOpInstructions(journeyId).then(ins => setPostOpInstruction(ins));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, journeyId]);

  // ── Actions ─────────────────────────────────────────────────────────────────

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
      const updated = await ipManagementApi.updateWardAssignment(journeyId, req);
      if (updated) {
        setJourney(updated);
        onStateChange?.({ wardName: updated.wardName, bedNumber: updated.bedNumber });
      }
      setShowWardEdit(false);
    } finally {
      setSavingWardEdit(false);
    }
  }

  async function handleSaveDischarge() {
    setSavingDs(true);
    try {
      await ipManagementApi.saveDischargeSummary(journeyId, dsForm);
      const updated = await ipManagementApi.getDischargeSummary(journeyId);
      setDischargeSummary(updated);
      setIsEditingDischarge(false);
    } finally {
      setSavingDs(false);
    }
  }

  async function handleFinalizeDischarge() {
    if (!confirm('Finalize discharge summary? This cannot be undone.')) return;
    const updated = await ipManagementApi.finalizeDischargeSummary(journeyId);
    if (updated) setDischargeSummary(updated);
  }

  async function handleMarkReady() {
    setMarkingReady(true);
    try {
      const updated = await ipManagementApi.transitionClinical(journeyId, {
        newState: 'ReadyForDischarge',
        expectedUpdatedAt: journey?.updatedAt,
      });
      if (updated) {
        setJourney(prev => prev ? { ...prev, clinicalState: updated.clinicalState } : null);
        onStateChange?.({ clinicalState: updated.clinicalState });
        setActiveTab('discharge');
      }
    } finally {
      setMarkingReady(false);
    }
  }

  async function handleFinalizeDischargeState() {
    setDischarging(true);
    try {
      // Bug #10 fix: persist followUpDate to discharge summary before transitioning
      const summaryPayload: SaveDischargeSummaryRequest = {
        ...dsForm,
        formatType: dsForm.formatType || 'Short',
        ...(followUpDate ? { followUpPlan: followUpDate } : {}),
      };
      await ipManagementApi.saveDischargeSummary(journeyId, summaryPayload);
      const updated = await ipManagementApi.transitionClinical(journeyId, {
        newState: 'Discharged',
        reason: [
          feedbackCollected ? 'Feedback collected' : '',
          postOpIssued ? 'Post-op instructions issued' : '',
          dischargeDateTime ? `Discharge time: ${dischargeDateTime}` : '',
        ].filter(Boolean).join('; ') || undefined,
        expectedUpdatedAt: journey?.updatedAt,
      });
      if (updated) {
        setJourney(prev => prev ? { ...prev, clinicalState: updated.clinicalState } : null);
        onStateChange?.({ clinicalState: updated.clinicalState });
      }
    } finally {
      setDischarging(false);
    }
  }

  // ── Derived state ───────────────────────────────────────────────────────────

  const journeyState = journey?.clinicalState ?? clinicalState;
  const currentStep = CLINICAL_STEPS.indexOf(journeyState);
  const isReadOnly = journeyState === 'Discharged';

  const TABS: { id: JourneyTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview',  label: 'Overview',  icon: <User className="h-3.5 w-3.5" /> },
    { id: 'ward',      label: 'Ward',      icon: <Building2 className="h-3.5 w-3.5" /> },
    { id: 'preop',     label: 'Pre-Op',    icon: <ClipboardList className="h-3.5 w-3.5" /> },
    { id: 'billing',   label: 'Billing',   icon: <CreditCard className="h-3.5 w-3.5" /> },
    { id: 'ot',        label: 'Theatre',   icon: <Stethoscope className="h-3.5 w-3.5" /> },
    { id: 'postop',    label: 'Post-Op',   icon: <Activity className="h-3.5 w-3.5" /> },
    { id: 'discharge', label: 'Discharge', icon: <ClipboardList className="h-3.5 w-3.5" /> },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <IpOverlayDialog
      onClose={onClose}
      size="6xl"
      title="Patient journey"
      testId="journey-modal"
      className="max-h-[92vh]"
    >
      <div className="flex flex-col max-h-[92vh] overflow-hidden">

          {/* ── Sticky Header ───────────────────────────────────────────── */}
          <div className="shrink-0 bg-white border-b border-gray-200">

            {/* Row 1: Patient info + close */}
            <div className="flex items-start gap-3 px-5 pt-4 pb-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                {((journey?.patientName ?? patientName) ?? '?').charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-gray-900 truncate">
                    {journey?.patientName ?? patientName ?? '—'}
                  </h2>
                  {journey && <StatusBadge status={journey.clinicalState} size="sm" />}
                  {journey?.isLocked && (
                    <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      <Lock className="h-3 w-3" /> Locked
                    </span>
                  )}
                  {journey?.isEmergencyFc && (
                    <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="h-3 w-3" /> Emergency FC
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-gray-500">
                  {journey?.uhid && (
                    <span className="font-mono font-medium text-blue-700">{journey.uhid}</span>
                  )}
                  {journey?.eyeOperated && (
                    <span>Eye: <span className="font-medium text-gray-700">{journey.eyeOperated}</span></span>
                  )}
                  {journey?.procedureName && (
                    <span>Procedure: <span className="font-medium text-gray-700">{journey.procedureName}</span></span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {journey && (
                  <div className="hidden sm:block text-right">
                    <p className="text-lg font-bold text-blue-700">{fmtINR(journey.balanceDue)}</p>
                    <p className="text-xs text-gray-400">Balance Due</p>
                  </div>
                )}
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Row 2: Clinical Progress Stepper */}
            <div className="px-5 pb-2 overflow-x-auto">
              <div className="flex items-center min-w-max py-1">
                {CLINICAL_STEPS.map((step, idx) => {
                  const isDone = idx < currentStep;
                  const isCurrent = idx === currentStep;
                  return (
                    <div key={step} className="flex items-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <div className={`h-7 w-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all
                          ${isCurrent
                            ? 'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-200'
                            : isDone
                              ? 'border-green-500 bg-green-500 text-white'
                              : 'border-gray-200 bg-white text-gray-400'
                          }`}>
                          {isDone ? '✓' : idx + 1}
                        </div>
                        <span className={`text-[9px] whitespace-nowrap font-medium leading-none
                          ${isCurrent ? 'text-blue-700' : isDone ? 'text-green-600' : 'text-gray-400'}`}>
                          {STEP_LABELS[step] ?? step}
                        </span>
                      </div>
                      {idx < CLINICAL_STEPS.length - 1 && (
                        <div className={`h-0.5 w-6 mx-0.5 mb-3.5 transition-all ${idx < currentStep ? 'bg-green-400' : 'bg-gray-200'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Row 3: Tab bar */}
            <div className="flex overflow-x-auto px-5 gap-0 border-t border-gray-100">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`journey-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap
                    ${activeTab === tab.id
                      ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}>
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Tab Content ─────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50/30">

            {/* Loading skeleton */}
            {isLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <div key={j} className="h-4 bg-gray-100 rounded animate-pulse"
                        style={{ width: `${60 + (j * 8) % 30}%` }} />
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Error state */}
            {!isLoading && !journey && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <User className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Could not load patient journey</p>
              </div>
            )}

            {/* Content */}
            {!isLoading && journey && (
              <>
                {/* ── OVERVIEW ─────────────────────────────────────────── */}
                {activeTab === 'overview' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SectionCard title="Clinical Details" icon={<Stethoscope className="h-4 w-4" />}>
                      <InfoRow label="Eye Operated" value={journey.eyeOperated} />
                      <InfoRow label="Procedure" value={journey.procedureName} />
                      <InfoRow label="Clinical State" value={journey.clinicalState} />
                      <InfoRow label="OT State" value={journey.otState} />
                      <InfoRow label="Post-Op State" value={journey.postOpState} />
                    </SectionCard>

                    <SectionCard title="Admission & Timeline" icon={<Clock className="h-4 w-4" />}>
                      <InfoRow label="Admitted At" value={fmt(journey.admittedAt)} />
                      <InfoRow label="Scheduled Surgery" value={fmt(journey.surgeryScheduledAt)} />
                      <InfoRow label="Surgery Started" value={fmt(journey.surgeryStartedAt)} />
                      <InfoRow label="Surgery Ended" value={fmt(journey.surgeryEndedAt)} />
                      <InfoRow label="Discharged At" value={fmt(journey.dischargedAt)} />
                    </SectionCard>

                    <SectionCard title="Ward Assignment" icon={<Building2 className="h-4 w-4" />}>
                      <InfoRow label="Ward" value={journey.wardName} />
                      <InfoRow label="Room / Bed" value={journey.bedNumber} />
                    </SectionCard>

                    <SectionCard title="Financial Summary" icon={<CreditCard className="h-4 w-4" />}>
                      <InfoRow label="Financial State" value={journey.financialState} />
                      <InfoRow label="Package Amount" value={fmtINR(journey.packageAmount)} />
                      <InfoRow label="Total Billed" value={fmtINR(journey.totalBilled)} />
                      <InfoRow label="Total Paid" value={fmtINR(journey.totalPaid)} />
                      <InfoRow label="Balance Due" value={fmtINR(journey.balanceDue)} />
                    </SectionCard>
                  </div>
                )}

                {/* ── WARD ─────────────────────────────────────────────── */}
                {activeTab === 'ward' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SectionCard title="Ward & Room" icon={<Building2 className="h-4 w-4" />}
                      action={!journey.isLocked ? (
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
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50"
                        >
                          {showWardEdit ? '✕ Cancel' : '✎ Edit'}
                        </button>
                      ) : undefined}>
                      {showWardEdit ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Room / Bed Number</label>
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
                              {savingWardEdit ? 'Saving…' : 'Save Changes'}
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
                            <InfoRow label="Attendant" value={`${journey.attendantName}${journey.attendantRelationship ? ` (${journey.attendantRelationship})` : ''}`} />
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

                {/* ── PRE-OP ─────────────────────────────────────────────── */}
                {activeTab === 'preop' && (
                  <JourneyPreOpSummary
                    journeyId={journeyId}
                    counselingSessionId={journey.counselingSessionId}
                    paymentMode={journey.paymentMode}
                    clinicalState={journey.clinicalState}
                    onOpenWorkspace={onDeepLink ? () => onDeepLink('preop-workspace') : undefined}
                  />
                )}

                {/* ── BILLING ────────────────────────────────────────────── */}
                {activeTab === 'billing' && (
                  <>
                    <SectionCard title="Financial State" icon={<CreditCard className="h-4 w-4" />}
                      action={(
                        <button
                          type="button"
                          onClick={() => router.push(`/dashboard/billing/opd?patientId=${journey.patientId}&journeyId=${journeyId}`)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium">
                          Open Billing
                        </button>
                      )}>
                      <div className="flex flex-wrap items-center gap-3">
                        <StatusBadge status={journey.financialState} size="sm" />
                        {journey.isBillingLocked && (
                          <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            <Lock className="h-3 w-3" /> Billing Locked
                          </span>
                        )}
                        {journey.isEmergencyFc && (
                          <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="h-3 w-3" /> Emergency FC
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-4 pt-2">
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500">Package</p>
                          <p className="text-base font-bold text-gray-800">{fmtINR(journey.packageAmount)}</p>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <p className="text-xs text-gray-500">Total Paid</p>
                          <p className="text-base font-bold text-green-700">{fmtINR(journey.totalPaid)}</p>
                        </div>
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <p className="text-xs text-gray-500">Balance Due</p>
                          <p className="text-base font-bold text-blue-700">{fmtINR(journey.balanceDue)}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => router.push(`/dashboard/billing/opd?patientId=${journey.patientId}&journeyId=${journeyId}`)}
                        className="mt-2 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                      >
                        Open Billing module →
                      </button>

                      {journey.isEmergencyFc && journey.emergencyFcReason && (
                        <InfoRow label="Emergency FC Reason" value={journey.emergencyFcReason} />
                      )}
                    </SectionCard>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 bg-gray-50">
                        <ClipboardList className="h-4 w-4 text-blue-600" />
                        <h3 className="text-sm font-semibold text-gray-800">Transaction Ledger</h3>
                        <span className="ml-auto text-xs text-gray-400">{billing.length} entries</span>
                      </div>
                      {billing.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">No transactions recorded</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-100">
                                {['Date', 'Type', 'Amount', 'Mode', 'Reference', 'Notes'].map(h => (
                                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
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
                                      {isDebit ? '−' : isCredit ? '+' : ''}{fmtINR(tx.amount)}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-500">{tx.paymentMode ?? '—'}</td>
                                    <td className="px-4 py-3 text-xs font-mono text-gray-500">{tx.referenceNumber ?? '—'}</td>
                                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px] truncate">{tx.notes ?? '—'}</td>
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

                {/* ── THEATRE (OT) ───────────────────────────────────────── */}
                {activeTab === 'ot' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SectionCard title="OT Details" icon={<Stethoscope className="h-4 w-4" />}>
                      <InfoRow label="OT Room" value={journey.otRoomNumber} />
                      <InfoRow label="Surgeon" value={journey.surgeonName} />
                      <InfoRow label="Anesthesiologist" value={journey.anesthesiologistName} />
                      <InfoRow label="Scrub Nurse" value={journey.scrubNurseName} />
                      <InfoRow label="Anaesthesia Type" value={journey.anaesthesiaType} />
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
                      <div className="md:col-span-2">
                        <SectionCard title="Intra-Operative Note" icon={<FileText className="h-4 w-4" />}>
                          {intraOp.isSigned && (
                            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Note signed at {fmt(intraOp.signedAt)}
                            </div>
                          )}
                          <InfoRow label="Note" value={intraOp.noteText} />
                          <InfoRow label="Complications" value={intraOp.complications} />
                          <InfoRow label="Implant Used" value={intraOp.implantUsed} />
                          <InfoRow label="Implant Batch #" value={intraOp.implantBatchNumber} />
                          <p className="text-xs text-gray-400 pt-1">Last updated: {fmt(intraOp.updatedAt)}</p>
                        </SectionCard>
                      </div>
                    ) : (
                      <div className="md:col-span-2 flex items-center justify-center py-8 text-gray-400">
                        <p className="text-sm">No intra-operative note recorded</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── POST-OP ────────────────────────────────────────────── */}
                {activeTab === 'postop' && (
                  <div className="space-y-4">
                    <JourneyPostOpSummary
                      journeyId={journeyId}
                      clinicalState={journey.clinicalState}
                      onOpenWorkspace={onDeepLink ? () => onDeepLink('postop-workspace') : undefined}
                    />

                    <SectionCard title="Post-Op Status" icon={<Activity className="h-4 w-4" />}>
                      <InfoRow label="Clinical State" value={journey.clinicalState} />
                      <InfoRow label="Post-Op State" value={journey.postOpState ?? '—'} />
                      <InfoRow label="Surgery Ended" value={fmt(journey.surgeryEndedAt)} />

                      {journey.clinicalState === 'PostOp' && !isReadOnly && (
                        <div className="pt-3 border-t border-gray-100">
                          <button
                            onClick={handleMarkReady}
                            disabled={markingReady}
                            className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50 shadow-sm"
                          >
                            {markingReady ? 'Updating…' : '✔ Mark Ready for Discharge'}
                          </button>
                          <p className="text-xs text-gray-400 mt-1.5">
                            Moves patient to ReadyForDischarge and opens the Discharge tab.
                          </p>
                        </div>
                      )}
                    </SectionCard>

                    <SectionCard title="Post-Op Instructions" icon={<ClipboardList className="h-4 w-4" />}>
                      {/* Bug #7 fix: single object, correct field names */}
                      {!postOpInstruction ? (
                        <p className="text-sm text-gray-400 py-2">No post-op instructions recorded</p>
                      ) : (
                        <div className="space-y-2">
                          {postOpInstruction.medications && <InfoRow label="Medications" value={postOpInstruction.medications} />}
                          {postOpInstruction.activityRestrictions && <InfoRow label="Activity" value={postOpInstruction.activityRestrictions} />}
                          {postOpInstruction.dietaryInstructions && <InfoRow label="Diet" value={postOpInstruction.dietaryInstructions} />}
                          {postOpInstruction.eyeCareInstructions && <InfoRow label="Eye Care" value={postOpInstruction.eyeCareInstructions} />}
                          {postOpInstruction.warningSigns && <InfoRow label="Warning Signs" value={postOpInstruction.warningSigns} />}
                          {postOpInstruction.followupDate && <InfoRow label="Follow-up Date" value={fmtDate(postOpInstruction.followupDate)} />}
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

                {/* ── DISCHARGE ──────────────────────────────────────────── */}
                {activeTab === 'discharge' && (
                  <div className="space-y-4">
                    {/* Discharge action area — only visible for ReadyForDischarge */}
                    {journey.clinicalState === 'ReadyForDischarge' && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                        <h3 className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" /> Discharge Checklist
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="flex items-center gap-2 text-sm text-emerald-800 cursor-pointer">
                            <input type="checkbox" checked={feedbackCollected}
                              onChange={e => setFeedbackCollected(e.target.checked)}
                              className="rounded border-emerald-300 text-emerald-600" />
                            Feedback Collected
                          </label>
                          <label className="flex items-center gap-2 text-sm text-emerald-800 cursor-pointer">
                            <input type="checkbox" checked={postOpIssued}
                              onChange={e => setPostOpIssued(e.target.checked)}
                              className="rounded border-emerald-300 text-emerald-600" />
                            Post-OP Instructions Issued
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-emerald-800 mb-1">Follow-up Date</label>
                            <input type="date" value={followUpDate}
                              onChange={e => setFollowUpDate(e.target.value)}
                              className="w-full border border-emerald-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-emerald-800 mb-1">Discharge Date/Time</label>
                            <input type="datetime-local" value={dischargeDateTime}
                              onChange={e => setDischargeDateTime(e.target.value)}
                              className="w-full border border-emerald-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white" />
                          </div>
                        </div>
                        <button
                          onClick={handleFinalizeDischargeState}
                          disabled={discharging}
                          className="w-full py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50 shadow-sm"
                        >
                          {discharging ? 'Processing…' : '🏠 Finalize Discharge'}
                        </button>
                      </div>
                    )}

                    {/* Discharge Summary */}
                    {!dischargeSummary ? (
                      <div className="flex items-center justify-center py-12 text-gray-400">
                        <p className="text-sm">Loading discharge summary…</p>
                      </div>
                    ) : (
                      <SectionCard title="Discharge Summary" icon={<ClipboardList className="h-4 w-4" />}
                        action={dischargeSummary.summaryStatus === 'Finalized' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3" /> Finalized
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setIsEditingDischarge(true);
                              // Bug #6 fix: map DTO fields to request fields correctly
                              setDsForm({
                                formatType: dischargeSummary.formatType || 'Short',
                                conditionAtDischarge: dischargeSummary.conditionAtDischarge ?? '',
                                diagnosisCodes: dischargeSummary.diagnosisCodes ?? '',
                                proceduresPerformed: dischargeSummary.proceduresPerformed ?? '',
                                hospitalCourse: dischargeSummary.hospitalCourse ?? '',
                                dischargeInstructions: dischargeSummary.dischargeInstructions ?? '',
                                medicationsOnDischarge: dischargeSummary.medicationsOnDischarge ?? '',
                                followUpPlan: dischargeSummary.followUpPlan ?? '',
                                finalBillAmount: dischargeSummary.finalBillAmount ?? undefined,
                              });
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50"
                          >
                            Edit
                          </button>
                        )}>
                        {dischargeSummary.summaryStatus === 'Finalized' && (
                          <p className="text-xs text-gray-400 pb-1">Finalized: {fmt(dischargeSummary.finalizedAt)}</p>
                        )}
                        {isEditingDischarge ? (
                          <div className="space-y-3">
                            {/* Bug #6 fix: correct field names per SaveDischargeSummaryRequest */}
                            {([
                              ['Condition at Discharge', 'conditionAtDischarge'],
                              ['Diagnosis Codes (ICD-10)', 'diagnosisCodes'],
                              ['Procedures Performed', 'proceduresPerformed'],
                              ['Hospital Course', 'hospitalCourse'],
                              ['Discharge Instructions', 'dischargeInstructions'],
                              ['Medications on Discharge', 'medicationsOnDischarge'],
                              ['Follow-Up Plan', 'followUpPlan'],
                            ] as [string, keyof SaveDischargeSummaryRequest][]).map(([label, field]) => (
                              <div key={field}>
                                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                                <textarea rows={2}
                                  value={(dsForm[field] as string) ?? ''}
                                  onChange={e => setDsForm(f => ({ ...f, [field]: e.target.value }))}
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
                              </div>
                            ))}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Final Bill Amount (₹)</label>
                              <input type="number" min="0"
                                value={dsForm.finalBillAmount ?? ''}
                                onChange={e => setDsForm(f => ({ ...f, finalBillAmount: e.target.value ? +e.target.value : undefined }))}
                                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-40" />
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
                            {/* Bug #6 fix: correct field names per DischargeSummaryDto */}
                            <InfoRow label="Condition at Discharge" value={dischargeSummary.conditionAtDischarge} />
                            <InfoRow label="Diagnosis Codes" value={dischargeSummary.diagnosisCodes} />
                            <InfoRow label="Procedures Performed" value={dischargeSummary.proceduresPerformed} />
                            <InfoRow label="Hospital Course" value={dischargeSummary.hospitalCourse} />
                            <InfoRow label="Discharge Instructions" value={dischargeSummary.dischargeInstructions} />
                            <InfoRow label="Medications" value={dischargeSummary.medicationsOnDischarge} />
                            <InfoRow label="Follow-Up Plan" value={dischargeSummary.followUpPlan} />
                            {dischargeSummary.finalBillAmount != null && (
                              <InfoRow label="Final Bill" value={fmtINR(dischargeSummary.finalBillAmount)} />
                            )}
                            {dischargeSummary.summaryStatus !== 'Finalized' && (
                              <div className="pt-3 border-t border-gray-100">
                                <button onClick={handleFinalizeDischarge}
                                  className="px-4 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium">
                                  ✔ Finalize Discharge Summary
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </SectionCard>
                    )}

                    {dischargeSummary && (
                      <SectionCard title="Discharge Timeline" icon={<Clock className="h-4 w-4" />}>
                        <InfoRow label="Admitted At" value={fmt(journey.admittedAt)} />
                        <InfoRow label="Discharged At" value={fmt(journey.dischargedAt)} />
                        {journey.dischargeOverrideReason && (
                          <InfoRow label="Override Reason" value={journey.dischargeOverrideReason} />
                        )}
                      </SectionCard>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="text-xs text-gray-400 text-right pt-2">
                  Created: {fmt(journey.createdAt)} · Last Updated: {fmt(journey.updatedAt)}
                </div>
              </>
            )}
          </div>
      </div>
    </IpOverlayDialog>
  );
}
