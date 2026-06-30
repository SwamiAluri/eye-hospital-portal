'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Tent, X, AlertTriangle, Search,
  Stethoscope, LogOut, SquareCheck, Square, Ban, RotateCcw,
} from 'lucide-react';
import { ActionMenu, ActionMenuItem } from '@/components/ip-management/preop/primitives/ActionMenu';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { AnaesthesiaMonitoringPanel } from '@/components/ip-management/AnaesthesiaMonitoringPanel';
import JourneyModal from '@/components/ip-management/JourneyModal';
import {
  ipManagementApi,
  fetchWardData,
  fetchWardDashboardSummary,
  PatientJourneyRowDto,
  WardDto,
  WardDashboardSummaryDto,
  SaveDischargeSummaryRequest,
} from '@/lib/api/ip-management.api';
import { useAuthStore } from '@/lib/auth-store';
import { StatusBadge } from '@/components/counsellors-desk/StatusBadge';
import {
  WardPreOpWorkspaceModal,
  WardPreOpTopTab,
} from '@/components/ip-management/WardPreOpWorkspaceModal';
import { WardChecklistSection } from '@/components/ip-management/WardChecklistStepper';
import { WardPostOpWorkspaceModal } from '@/components/ip-management/WardPostOpWorkspaceModal';
import { WardReadinessMeter } from '@/components/ip-management/WardReadinessMeter';
import { WardPatientDrawer, WardDrawerSurface } from '@/components/ip-management/WardPatientDrawer';
import { WardKpiStrip } from '@/components/ip-management/WardKpiStrip';
import { WardPreOpGateBanner } from '@/components/ip-management/WardPreOpGateBanner';
import { useIpChecklistPermissions } from '@/hooks/use-ip-checklist-permissions';
import { useWardRealtime } from '@/hooks/use-ward-realtime';
import { transitionClinicalWithGates } from '@/lib/ip-checklist/transition-gates';
import { canCancelTodaySurgery, journeyRowFromDetail } from '@/lib/ip-management/ward-journey-helpers';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';

// ─── Types ────────────────────────────────────────────────────────────────────

type ClinicalTab = 'All' | 'Expected' | 'Admitted' | 'ReadyForSurgery' | 'InOT' | 'SurgeryCompleted' | 'PostOp' | 'ReadyForDischarge' | 'Discharged' | 'CancelledSurgery';
type ModalType = 'workspace' | 'emergencyFc' | 'sendToOT' | 'cancelToday' | 'postOpWard' | 'discharge' | 'journey';
type RowAction = ModalType | 'rebook';

const DEFAULT_WORKSPACE_CONFIG: { tab: WardPreOpTopTab; section: WardChecklistSection } = {
  tab: 'wardChecklist',
  section: 'investigations',
};

const STATUS_TABS: { key: ClinicalTab; label: string; color: string; activeClass: string }[] = [
  { key: 'All',               label: 'All',               color: 'bg-slate-500',   activeClass: 'bg-slate-600 border-slate-600 text-white' },
  { key: 'Expected',          label: 'Expected',          color: 'bg-sky-500',     activeClass: 'bg-sky-500 border-sky-500 text-white' },
  { key: 'Admitted',          label: 'Admitted',          color: 'bg-cyan-500',    activeClass: 'bg-cyan-500 border-cyan-500 text-white' },
  { key: 'ReadyForSurgery',   label: 'Ready for Surgery', color: 'bg-teal-500',    activeClass: 'bg-teal-500 border-teal-500 text-white' },
  { key: 'InOT',              label: 'In OT',             color: 'bg-amber-500',   activeClass: 'bg-amber-500 border-amber-500 text-white' },
  { key: 'SurgeryCompleted',  label: 'Surgery Done',      color: 'bg-lime-600',    activeClass: 'bg-lime-600 border-lime-600 text-white' },
  { key: 'PostOp',            label: 'Post-Op',           color: 'bg-violet-500',  activeClass: 'bg-violet-500 border-violet-500 text-white' },
  { key: 'ReadyForDischarge', label: 'Ready for D/C',     color: 'bg-emerald-500', activeClass: 'bg-emerald-500 border-emerald-500 text-white' },
  { key: 'Discharged',        label: 'Discharged',        color: 'bg-gray-400',    activeClass: 'bg-gray-500 border-gray-500 text-white' },
  { key: 'CancelledSurgery',  label: 'Cancelled',         color: 'bg-rose-500',    activeClass: 'bg-rose-500 border-rose-500 text-white' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function fmtDate(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function Checkbox({ checked, onChange, label, disabled }: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-2 text-sm select-none ${disabled ? 'cursor-default' : 'cursor-pointer'}`}>
      <span onClick={() => !disabled && onChange?.(!checked)}>
        {checked
          ? <SquareCheck className="h-4 w-4 text-blue-600" />
          : <Square className="h-4 w-4 text-gray-400" />}
      </span>
      <span className={disabled ? 'text-gray-500' : 'text-gray-700'}>{label}</span>
    </label>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: 13 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-3 bg-gray-200 rounded animate-pulse" style={{ width: `${50 + (i * 7) % 35}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Cancel Today's Surgery Modal (G1) ────────────────────────────────────────

function CancelTodayModal({ journey, onClose, onSaved }: {
  journey: PatientJourneyRowDto;
  onClose: () => void;
  onSaved: (updated: PatientJourneyRowDto) => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Cancel reason is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await ipManagementApi.cancelTodaySurgery(journey.id, reason.trim());
      if (result) {
        onSaved(journeyRowFromDetail(journey, result));
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not cancel today\'s surgery.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      data-testid={WARD_PREOP_TEST_IDS.cancelTodayModal}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Ban className="h-4 w-4 text-rose-600" />
            <h2 className="text-base font-semibold text-gray-900">Cancel Today&apos;s Surgery</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-xs text-gray-600">
            Reverts the journey to <span className="font-semibold">Expected</span>, releases the OT slot and bed assignment, and flags counselling to rebook. Pre-op checklist data is retained.
          </p>
          {journey.clinicalState === 'SentToOT' && journey.otState === 'Accepted' && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              Cancel is blocked after OT has accepted the patient.
            </p>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Document why today&apos;s surgery is being cancelled…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
            />
          </div>
          {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Close</button>
            <button
              type="submit"
              disabled={saving}
              data-testid={WARD_PREOP_TEST_IDS.cancelTodaySubmit}
              className="px-5 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium disabled:opacity-60"
            >
              {saving ? 'Cancelling…' : 'Confirm Cancel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Emergency FC Modal ───────────────────────────────────────────────────────

function EmergencyFcModal({ journey, onClose, onSaved }: {
  journey: PatientJourneyRowDto;
  onClose: () => void;
  onSaved: (updated: PatientJourneyRowDto) => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) { setError('Reason is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const result = await ipManagementApi.applyEmergencyFc(journey.id, { reason: reason.trim() });
      if (result) {
        onSaved({ ...journey, financialState: result.financialState });
        onClose();
      } else {
        setError('Failed to apply Emergency FC. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <h2 className="text-base font-semibold text-gray-900">Emergency Financial Category</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm">
            <p className="font-semibold text-orange-900">{journey.patientName}</p>
            <p className="text-orange-700 text-xs mt-0.5">Applying Emergency FC overrides the standard financial workflow.</p>
          </div>
          {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Reason <span className="text-red-500">*</span></label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} required rows={3}
              placeholder="Describe the emergency financial situation…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-60">
              {saving ? 'Applying…' : 'Apply Emergency FC'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Send To OT Modal ─────────────────────────────────────────────────────────

function SendToOTModal({ journey, onClose, onSaved }: {
  journey: PatientJourneyRowDto;
  onClose: () => void;
  onSaved: (updated: PatientJourneyRowDto) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSend() {
    setSaving(true);
    setError('');
    try {
      const result = await transitionClinicalWithGates(journey.id, { newState: 'SentToOT' });
      if (result) {
        onSaved({ ...journey, clinicalState: result.clinicalState });
        onClose();
      } else {
        setError('Could not send to OT. Patient may not be in ReadyForSurgery state.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      data-testid={WARD_PREOP_TEST_IDS.sendToOtModal}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-teal-600" />
            <h2 className="text-base font-semibold text-gray-900">Send to Operation Theatre</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {/* Patient context */}
          <div className="bg-teal-50 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-teal-200 flex items-center justify-center text-teal-700 font-bold text-sm shrink-0">
              {(journey.patientName ?? '?').charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-teal-900 text-sm">{journey.patientName ?? '—'}</p>
              <p className="text-teal-700 text-xs truncate">{journey.uhid} · {journey.procedureName ?? '—'}</p>
            </div>
          </div>

          {/* Context details */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {journey.eyeOperated && (
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-gray-400 font-medium uppercase tracking-wide text-[10px]">Eye</p>
                <p className="font-semibold text-gray-700 mt-0.5">{journey.eyeOperated}</p>
              </div>
            )}
            {journey.wardName && (
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-gray-400 font-medium uppercase tracking-wide text-[10px]">Ward / Bed</p>
                <p className="font-semibold text-gray-700 mt-0.5">{journey.wardName}{journey.bedNumber ? ` · ${journey.bedNumber}` : ''}</p>
              </div>
            )}
            {journey.surgeryScheduledAt && (
              <div className="bg-gray-50 rounded-lg px-3 py-2 col-span-2">
                <p className="text-gray-400 font-medium uppercase tracking-wide text-[10px]">Surgery Scheduled</p>
                <p className="font-semibold text-gray-700 mt-0.5">
                  {new Date(journey.surgeryScheduledAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )}
          </div>

          <p className="text-sm text-gray-600">
            This will notify the Operation Theatre team. OT details (anaesthetist, theatre room, surgical team) can be filled in from the <span className="font-medium text-teal-700">Operation Theatre</span> page.
          </p>

          {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <WardPreOpGateBanner journeyId={journey.id} clinicalState="ReadyForSurgery" />

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSend} disabled={saving}
              className="px-5 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium disabled:opacity-60 flex items-center gap-1.5">
              <Stethoscope className="h-3.5 w-3.5" />
              {saving ? 'Sending…' : 'Send to OT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Discharge Summary Modal (Ward-owned) ─────────────────────────────────────

function WardDischargeSummaryModal({ journey, onClose, onSaved }: {
  journey: PatientJourneyRowDto;
  onClose: () => void;
  onSaved: (updated: PatientJourneyRowDto) => void;
}) {
  const { canEditMonitoring } = useIpChecklistPermissions();
  const [form, setForm] = useState<SaveDischargeSummaryRequest>({
    conditionAtDischarge: '',
    diagnosisCodes: '',
    proceduresPerformed: '',
    hospitalCourse: '',
    dischargeInstructions: '',
    medicationsOnDischarge: '',
    followUpPlan: '',
    formatType: 'Standard',
  });
  const [isFinalized, setIsFinalized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [discharging, setDischarging] = useState(false);
  const [error, setError] = useState('');
  const [anaesClearanceComplete, setAnaesClearanceComplete] = useState<boolean | null>(null);
  const [nurseSummaryIssued, setNurseSummaryIssued] = useState(false);
  const [overrideApplying, setOverrideApplying] = useState(false);

  useEffect(() => {
    (async () => {
      const [data, postOp] = await Promise.all([
        ipManagementApi.getDischargeSummary(journey.id),
        ipManagementApi.getWardPostOpChecklist(journey.id),
      ]);
      if (data) {
        setForm({
          conditionAtDischarge:  data.conditionAtDischarge ?? '',
          diagnosisCodes:        data.diagnosisCodes ?? '',
          proceduresPerformed:   data.proceduresPerformed ?? '',
          hospitalCourse:        data.hospitalCourse ?? '',
          dischargeInstructions: data.dischargeInstructions ?? '',
          medicationsOnDischarge:data.medicationsOnDischarge ?? '',
          followUpPlan:          data.followUpPlan ?? '',
          formatType:            data.formatType ?? 'Standard',
        });
        setIsFinalized(data.summaryStatus === 'Final');
      }
      const issued = postOp?.items.find(i => i.itemKey === 'discharge_summary_issued');
      setNurseSummaryIssued(!!issued?.isCompleted || !!issued?.isBypassed);
      setLoading(false);
    })();
  }, [journey.id]);

  const fields: Array<{ label: string; key: keyof SaveDischargeSummaryRequest; type?: string; rows?: number; options?: string[] }> = [
    { label: 'Diagnosis Codes',          key: 'diagnosisCodes',        rows: 2 },
    { label: 'Procedures Performed',     key: 'proceduresPerformed',   rows: 2 },
    { label: 'Hospital Course',          key: 'hospitalCourse',        rows: 3 },
    { label: 'Condition at Discharge',   key: 'conditionAtDischarge',  type: 'select',
      options: ['', 'Good', 'Stable', 'Fair', 'Guarded'] },
    { label: 'Discharge Instructions',   key: 'dischargeInstructions', rows: 3 },
    { label: 'Medications on Discharge', key: 'medicationsOnDischarge',rows: 3 },
    { label: 'Follow-up Plan',           key: 'followUpPlan',          rows: 2 },
  ];

  async function handleSave() {
    setSaving(true);
    try {
      await ipManagementApi.saveDischargeSummary(journey.id, form);
    } finally {
      setSaving(false);
    }
  }

  async function handleFinalize() {
    setFinalizing(true);
    try {
      const result = await ipManagementApi.finalizeDischargeSummary(journey.id);
      if (result) setIsFinalized(true);
    } finally {
      setFinalizing(false);
    }
  }

  async function handleDischargeOverride() {
    const reason = window.prompt('Reason for discharge override (checklist gates incomplete):');
    if (!reason?.trim()) return;
    setOverrideApplying(true);
    try {
      await ipManagementApi.applyDischargeOverride(journey.id, { reason: reason.trim() });
      setError('');
    } catch {
      setError('Failed to apply discharge override.');
    } finally {
      setOverrideApplying(false);
    }
  }

  async function handleDischarge() {
    if (!isFinalized) { setError('Please finalize the discharge summary first.'); return; }
    setDischarging(true);
    setError('');
    try {
      const result = await transitionClinicalWithGates(journey.id, { newState: 'Discharged' });
      if (result) {
        onSaved({ ...journey, clinicalState: result.clinicalState });
        onClose();
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
               ?? (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.message
               ?? (e instanceof Error ? e.message : null)
               ?? 'Discharge failed.';
      setError(msg);
    } finally {
      setDischarging(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <LogOut className="h-4 w-4 text-emerald-600" />
            <div>
              <h2 className="text-base font-semibold text-gray-900">Discharge Summary</h2>
              <p className="text-xs text-gray-500">{journey.patientName ?? '—'} · {journey.uhid ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isFinalized && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Finalized</span>}
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className={`rounded-lg border px-3 py-2 ${isFinalized ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              <p className="font-semibold text-gray-700">Clinical summary</p>
              <p className={`mt-0.5 ${isFinalized ? 'text-green-800' : 'text-gray-600'}`}>
                {isFinalized ? 'Final — locked' : 'Draft — not finalized'}
              </p>
            </div>
            <div className={`rounded-lg border px-3 py-2 ${nurseSummaryIssued ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <p className="font-semibold text-gray-700">Nurse checklist (P10)</p>
              <p className={`mt-0.5 ${nurseSummaryIssued ? 'text-green-800' : 'text-amber-800'}`}>
                {nurseSummaryIssued ? 'discharge_summary_issued ✓' : 'discharge_summary_issued pending'}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}</div>
          ) : fields.map(({ label, key, type, rows, options }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
              {type === 'select' ? (
                <select value={(form[key] as string) ?? ''}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  disabled={isFinalized}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50 disabled:text-gray-400">
                  {(options ?? []).map(opt => (
                    <option key={opt} value={opt}>{opt || '— select —'}</option>
                  ))}
                </select>
              ) : (
                <textarea value={(form[key] as string) ?? ''}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  rows={rows ?? 2} disabled={isFinalized}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none disabled:bg-gray-50 disabled:text-gray-400" />
              )}
            </div>
          ))}

          <AnaesthesiaMonitoringPanel
            journeyId={journey.id}
            mode="discharge"
            readOnly={isFinalized || !canEditMonitoring}
            onClearanceChange={setAnaesClearanceComplete}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Close</button>
            <button onClick={handleDischargeOverride} disabled={overrideApplying}
              className="px-3 py-2 text-xs border border-amber-300 text-amber-800 rounded-lg hover:bg-amber-50 disabled:opacity-50">
              {overrideApplying ? 'Applying…' : 'Discharge override'}
            </button>
          </div>
          {!isFinalized && (
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-medium disabled:opacity-60">
                {saving ? 'Saving…' : 'Save Draft'}
              </button>
              <button onClick={handleFinalize} disabled={finalizing}
                className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium disabled:opacity-60">
                {finalizing ? 'Finalizing…' : 'Finalize & Lock'}
              </button>
            </div>
          )}
          <button onClick={handleDischarge} disabled={discharging || !isFinalized}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-60 disabled:cursor-not-allowed">
            <LogOut className="h-4 w-4" />
            {discharging ? 'Discharging…' : 'Discharge Patient'}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Row Icon Action Bar ───────────────────────────────────────────────────────

function InlineRowActions({ journey, onAction }: {
  journey: PatientJourneyRowDto;
  onAction: (action: RowAction) => void;
}) {
  const isCancelled = journey.clinicalState === 'CancelledSurgery';

  const items: ActionMenuItem[] = [];
  if (canCancelTodaySurgery(journey)) {
    items.push({
      id: 'cancelToday',
      label: 'Cancel today\'s surgery',
      icon: Ban,
      destructive: true,
      onSelect: () => onAction('cancelToday'),
    });
  }
  if (!journey.isLocked && journey.clinicalState !== 'Discharged' && !isCancelled) {
    items.push({
      id: 'emergencyFc',
      label: 'Emergency FC',
      icon: AlertTriangle,
      onSelect: () => onAction('emergencyFc'),
    });
  }

  return (
    <div className="flex items-center justify-end gap-1.5 flex-nowrap">
      {isCancelled && (
        <button
          data-testid={WARD_PREOP_TEST_IDS.rebookBtn}
          onClick={(e) => { e.stopPropagation(); onAction('rebook'); }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Rebook
        </button>
      )}
      <ActionMenu items={items} label="Patient actions" />
    </div>
  );
}

// ─── KPI → list filter predicate (mirrors backend WardDashboardMetrics) ─────────

const PRE_OP = new Set(['Expected', 'Admitted', 'ReadyForSurgery']);

function startOfDay(value?: string | null): number | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function matchesKpi(j: PatientJourneyRowDto, key: string): boolean {
  const preOp = PRE_OP.has(j.clinicalState);
  const active = j.clinicalState !== 'Discharged' && j.clinicalState !== 'CancelledSurgery';
  const today = startOfDay(new Date().toISOString())!;
  const sched = startOfDay(j.surgeryScheduledAt);
  switch (key) {
    case 'otLoadToday':      return active && sched === today;
    case 'pacPending':       return (j.clinicalState === 'Admitted' || j.clinicalState === 'ReadyForSurgery') && j.pacCompleted === false;
    case 'criticalLabs':     return preOp && (j.unverifiedCriticalCount ?? 0) > 0;
    case 'financialPending': return preOp && (j.balanceDue ?? 0) > 0;
    case 'delayed':          return preOp && ((sched !== null && sched < today) || !!j.otReturnReason);
    case 'rebookRequired':   return j.pendingRebook === true;
    default:                 return true;
  }
}

// ─── Role-based dashboard defaults (Phase 8) ────────────────────────────────────
// Applied once on first load; never overrides a user's subsequent interactions.

const ROLE_DASHBOARD_DEFAULTS: { test: RegExp; view: { tab?: ClinicalTab; kpi?: string } }[] = [
  { test: /ANAE|ANES/i,                          view: { kpi: 'pacPending' } },
  { test: /BILL|FINAN|ACCOUNT|CASH|TPA/i,        view: { kpi: 'financialPending' } },
  { test: /THEATRE|THEATER|\bOT\b|COORDINATOR/i, view: { kpi: 'otLoadToday' } },
  { test: /NURSE/i,                              view: { tab: 'Admitted' } },
];

function defaultDashboardView(roles: string[] | undefined): { tab?: ClinicalTab; kpi?: string } | null {
  for (const role of roles ?? []) {
    const match = ROLE_DASHBOARD_DEFAULTS.find(r => r.test.test(role));
    if (match) return match.view;
  }
  return null;
}

// Incremental render window: how many rows to add each time the sentinel scrolls in.
const ROW_PAGE = 50;

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WardManagementPage() {
  const { user, token } = useAuthStore();
  const roles = useAuthStore(s => s.roles);
  const branchId = user?.branchId;
  const appliedRoleDefault = useRef(false);

  const [journeys, setJourneys] = useState<PatientJourneyRowDto[]>([]);
  const [wards, setWards] = useState<WardDto[]>([]);
  const [isLoading, setIsLoading] = useState(
    () => !!(useAuthStore.getState().token && useAuthStore.getState().user?.branchId)
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ClinicalTab>('All');
  const [filters, setFilters] = useState({ surgeryDate: '', showDischarged: false, search: '', otRoom: '', anaesthetist: '', surgeon: '', kpi: '' });
  const [summary, setSummary] = useState<WardDashboardSummaryDto | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [visibleCount, setVisibleCount] = useState(ROW_PAGE);
  const loadMoreRef = useRef<HTMLTableRowElement>(null);

  const [selectedJourney, setSelectedJourney] = useState<PatientJourneyRowDto | null>(null);
  const [workspaceConfig, setWorkspaceConfig] = useState(DEFAULT_WORKSPACE_CONFIG);
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);
  const [cancelReturnModal, setCancelReturnModal] = useState<ModalType | null>(null);
  const [transitionLoading, setTransitionLoading] = useState<string | null>(null);
  const [rebookTarget, setRebookTarget] = useState<PatientJourneyRowDto | null>(null);
  const [rebookLoading, setRebookLoading] = useState(false);
  const [drawerJourney, setDrawerJourney] = useState<PatientJourneyRowDto | null>(null);

  async function loadData() {
    if (!branchId) {
      setIsLoading(false);
      setLoadError('Your account has no branch assigned. Please contact your administrator.');
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const [{ journeys: journeyData, wards: wardData }, summaryData] = await Promise.all([
        fetchWardData(branchId),
        fetchWardDashboardSummary(branchId).catch(() => null),
      ]);
      setJourneys(journeyData);
      setWards(wardData);
      setSummary(summaryData);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setLoadError('Session expired. Please refresh the page or log in again.');
      } else if (status === 400) {
        setLoadError('Invalid request. Branch configuration may be missing.');
      } else {
        setLoadError('Could not load ward data. The service may be starting up — please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  // Quiet background refresh (Phase 10): keep the board near-live without a spinner
  // and without disturbing an in-progress interaction. Paused while any overlay is open.
  const busyRef = useRef(false);
  busyRef.current = !!(selectedJourney || drawerJourney || rebookTarget || activeModal || cancelReturnModal || transitionLoading);

  async function refreshQuietly() {
    if (!branchId) return;
    try {
      const [{ journeys: journeyData }, summaryData] = await Promise.all([
        fetchWardData(branchId),
        fetchWardDashboardSummary(branchId).catch(() => null),
      ]);
      setJourneys(journeyData);
      setSummary(summaryData);
    } catch { /* silent — the next tick retries */ }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!token) return; loadData(); }, [token, branchId]);

  // Real-time: refresh on a ward-relevant SignalR event (skip while an overlay is open).
  useWardRealtime(() => { if (!busyRef.current) refreshQuietly(); });

  useEffect(() => {
    if (!token || !branchId) return;
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !busyRef.current) {
        refreshQuietly();
      }
    }, 45_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, branchId]);

  useEffect(() => {
    if (appliedRoleDefault.current || !roles || roles.length === 0) return;
    appliedRoleDefault.current = true;
    const view = defaultDashboardView(roles);
    if (!view) return;
    if (view.tab) setActiveTab(view.tab);
    if (view.kpi) setFilters(f => ({ ...f, kpi: view.kpi! }));
  }, [roles]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function handleRowUpdated(updated: PatientJourneyRowDto) {
    setJourneys(prev => prev.map(j => j.id === updated.id ? updated : j));
  }

  function openWorkspace(
    journey: PatientJourneyRowDto,
    tab?: WardPreOpTopTab,
    section?: WardChecklistSection,
  ) {
    const state = journey.clinicalState;
    setWorkspaceConfig({
      tab: tab ?? (state === 'Admitted' ? 'vitals' : 'wardChecklist'),
      section: section ?? 'investigations',
    });
    setSelectedJourney(journey);
    setActiveModal('workspace');
  }

  function openModal(journey: PatientJourneyRowDto, modal: ModalType) {
    if (modal === 'cancelToday') {
      setCancelReturnModal(null);
    }
    setSelectedJourney(journey);
    setActiveModal(modal);
  }

  function closeModal() {
    setSelectedJourney(null);
    setActiveModal(null);
  }

  function handleRowAction(journey: PatientJourneyRowDto, action: RowAction) {
    if (action === 'rebook') {
      setRebookTarget(journey);
      return;
    }
    openModal(journey, action);
  }

  async function handleRebookConfirm() {
    const target = rebookTarget;
    if (!target) return;
    setRebookLoading(true);
    try {
      const detail = await ipManagementApi.rebookCancelledSurgery(target.id);
      if (detail) handleRowUpdated(journeyRowFromDetail(target, detail));
      if (branchId) fetchWardDashboardSummary(branchId).then(setSummary).catch(() => {});
      setRebookTarget(null);
    } finally {
      setRebookLoading(false);
    }
  }

  function handleRowClick(journey: PatientJourneyRowDto) {
    setDrawerJourney(journey);
  }

  function openDrawerWorkspace(journey: PatientJourneyRowDto) {
    setDrawerJourney(null);
    openWorkspace(journey);
  }

  function openDrawerSurface(journey: PatientJourneyRowDto, surface: WardDrawerSurface) {
    setDrawerJourney(null);
    openModal(journey, surface);
  }

  function rebookFromDrawer(journey: PatientJourneyRowDto) {
    setDrawerJourney(null);
    setRebookTarget(journey);
  }

  function selectKpi(key: string) {
    setActiveTab('All');
    setFilters(f => ({ ...f, kpi: f.kpi === key ? '' : key }));
  }

  function selectTab(key: ClinicalTab) {
    setActiveTab(key);
    setFilters(f => ({ ...f, kpi: '' }));
  }

  const displayJourneys = useMemo(() => {
    let list = Array.isArray(journeys) ? journeys : [];
    if (!filters.showDischarged) list = list.filter(j => j.clinicalState !== 'Discharged');
    if (activeTab !== 'All') list = list.filter(j => j.clinicalState === activeTab);
    if (filters.kpi) list = list.filter(j => matchesKpi(j, filters.kpi));
    if (filters.surgeryDate) list = list.filter(j => j.surgeryScheduledAt?.startsWith(filters.surgeryDate));
    if (filters.otRoom) list = list.filter(j => j.operationTheatreName === filters.otRoom);
    if (filters.anaesthetist) list = list.filter(j => j.anaesthetistName === filters.anaesthetist);
    if (filters.surgeon) list = list.filter(j => j.surgeonName === filters.surgeon);
    const q = filters.search.trim().toLowerCase();
    if (q) {
      list = list.filter(j =>
        (j.patientName ?? '').toLowerCase().includes(q)
        || (j.uhid ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [journeys, activeTab, filters]);

  // Incremental windowing — render `visibleCount` rows, growing as the sentinel scrolls
  // into view. Keeps instant client-side filtering while bounding the DOM for large lists.
  const visibleJourneys = useMemo(
    () => displayJourneys.slice(0, visibleCount),
    [displayJourneys, visibleCount],
  );
  const hasMoreRows = visibleCount < displayJourneys.length;

  useEffect(() => { setVisibleCount(ROW_PAGE); }, [activeTab, filters]);

  useEffect(() => {
    if (!hasMoreRows) return;
    const el = loadMoreRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount(c => Math.min(c + ROW_PAGE, displayJourneys.length));
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMoreRows, displayJourneys.length]);

  const counts = useMemo(() => {
    if (summary?.stageCounts) return summary.stageCounts;
    const map: Record<string, number> = { All: journeys.length };
    STATUS_TABS.slice(1).forEach(({ key }) => {
      map[key] = journeys.filter(j => j.clinicalState === key).length;
    });
    return map;
  }, [journeys, summary]);

  const facets = useMemo(() => {
    if (summary?.facets) return summary.facets;
    const uniq = (vals: (string | null | undefined)[]) =>
      Array.from(new Set(vals.filter((v): v is string => !!v))).sort();
    return {
      otRooms: uniq(journeys.map(j => j.operationTheatreName)),
      anaesthetists: uniq(journeys.map(j => j.anaesthetistName)),
      payers: [] as string[],
      surgeons: uniq(journeys.map(j => j.surgeonName)),
    };
  }, [journeys, summary]);

  return (
    <div className="space-y-4" data-testid={WARD_PREOP_TEST_IDS.wardPage}>
      {/* Modals */}
      <ConfirmationDialog
        isOpen={!!rebookTarget}
        onClose={() => { if (!rebookLoading) setRebookTarget(null); }}
        onConfirm={handleRebookConfirm}
        title="Rebook patient"
        message={`Move ${rebookTarget?.patientName ?? 'this patient'} back to Expected for rescheduling?`}
        confirmText="Rebook"
        cancelText="Cancel"
        variant="success"
        isLoading={rebookLoading}
        dataTestId={WARD_PREOP_TEST_IDS.rebookConfirmModal}
        confirmTestId={WARD_PREOP_TEST_IDS.rebookConfirm}
      />
      {drawerJourney && (
        <WardPatientDrawer
          journey={drawerJourney}
          onClose={() => setDrawerJourney(null)}
          onOpenWorkspace={openDrawerWorkspace}
          onOpenSurface={openDrawerSurface}
          onRebook={rebookFromDrawer}
        />
      )}
      {selectedJourney && activeModal === 'workspace' && (
        <WardPreOpWorkspaceModal
          journey={selectedJourney}
          wards={wards}
          branchId={branchId}
          initialTopTab={workspaceConfig.tab}
          initialChecklistSection={workspaceConfig.section}
          onClose={closeModal}
          onJourneyUpdated={handleRowUpdated}
          onRequestSendToOt={() => setActiveModal('sendToOT')}
          onRequestCancelToday={() => {
            setCancelReturnModal('workspace');
            setActiveModal('cancelToday');
          }}
        />
      )}
      {selectedJourney && activeModal === 'cancelToday' && (
        <CancelTodayModal
          journey={selectedJourney}
          onClose={() => {
            if (cancelReturnModal) setActiveModal(cancelReturnModal);
            else closeModal();
            setCancelReturnModal(null);
          }}
          onSaved={u => {
            handleRowUpdated(u);
            if (cancelReturnModal) {
              setSelectedJourney(u);
              setActiveModal(cancelReturnModal);
            } else {
              closeModal();
            }
            setCancelReturnModal(null);
          }}
        />
      )}
      {selectedJourney && activeModal === 'emergencyFc' && (
        <EmergencyFcModal journey={selectedJourney} onClose={closeModal}
          onSaved={u => { handleRowUpdated(u); closeModal(); }} />
      )}
      {selectedJourney && activeModal === 'sendToOT' && (
        <SendToOTModal
          journey={selectedJourney}
          onClose={() => setActiveModal('workspace')}
          onSaved={u => { handleRowUpdated(u); closeModal(); }}
        />
      )}
      {selectedJourney && activeModal === 'postOpWard' && (
        <WardPostOpWorkspaceModal journey={selectedJourney} onClose={closeModal}
          onSaved={u => { handleRowUpdated(u); closeModal(); }} />
      )}
      {selectedJourney && activeModal === 'discharge' && (
        <WardDischargeSummaryModal journey={selectedJourney} onClose={closeModal}
          onSaved={u => { handleRowUpdated(u); closeModal(); }} />
      )}
      {selectedJourney && activeModal === 'journey' && (
        <JourneyModal
          journeyId={selectedJourney.id}
          clinicalState={selectedJourney.clinicalState}
          patientName={selectedJourney.patientName}
          onClose={closeModal}
          onDeepLink={target => {
            const j = selectedJourney;
            if (!j) return;
            if (target === 'preop-workspace') {
              openWorkspace(j);
            } else {
              setActiveModal('postOpWard');
            }
          }}
          onStateChange={partial => {
            setJourneys(prev => prev.map(j =>
              j.id === selectedJourney.id ? { ...j, ...partial } : j
            ));
          }}
        />
      )}

      <WardKpiStrip summary={summary} activeKey={filters.kpi} onSelect={selectKpi} />

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={searchRef}
                data-testid={WARD_PREOP_TEST_IDS.search}
                type="text"
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                placeholder="Patient name or MR No"
                className="w-full border border-gray-300 rounded-lg pl-9 pr-12 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5">⌘K</kbd>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Surgery Date</label>
            <input type="date" value={filters.surgeryDate} onChange={e => setFilters(f => ({ ...f, surgeryDate: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {facets.otRooms.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">OT Room</label>
              <select
                data-testid={WARD_PREOP_TEST_IDS.filterOtRoom}
                value={filters.otRoom}
                onChange={e => setFilters(f => ({ ...f, otRoom: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All</option>
                {facets.otRooms.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}
          {facets.anaesthetists.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Anaesthetist</label>
              <select
                data-testid={WARD_PREOP_TEST_IDS.filterAnaesthetist}
                value={filters.anaesthetist}
                onChange={e => setFilters(f => ({ ...f, anaesthetist: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All</option>
                {facets.anaesthetists.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          )}
          {facets.surgeons.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Surgeon</label>
              <select
                data-testid={WARD_PREOP_TEST_IDS.filterSurgeon}
                value={filters.surgeon}
                onChange={e => setFilters(f => ({ ...f, surgeon: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All</option>
                {facets.surgeons.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer select-none pb-2">
            <button
              type="button"
              role="switch"
              aria-checked={filters.showDischarged}
              aria-label="Show discharged patients"
              onClick={() => setFilters(f => ({ ...f, showDischarged: !f.showDischarged }))}
              className={`relative w-10 h-5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500 ${filters.showDischarged ? 'bg-blue-600' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${filters.showDischarged ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-gray-700 font-medium">Show Discharged</span>
          </label>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {/* Status tabs */}
        <div className="flex items-center px-4 pt-4 pb-3 overflow-x-auto gap-1.5">
          {STATUS_TABS.map(({ key, label, color, activeClass }) => (
            <button key={key} onClick={() => selectTab(key)}
              data-testid={WARD_PREOP_TEST_IDS.wardStatusTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                activeTab === key ? `${activeClass} shadow-sm` : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activeTab === key ? 'bg-white/80' : color}`} />
              {label}
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${activeTab === key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {counts[key] ?? 0}
              </span>
            </button>
          ))}
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-y border-gray-100">
                {['Status', '#', 'MR No', 'Patient Name', 'Age / Gender', 'Admission Type', 'Eye / Procedure', 'OT State', 'Ward / Bed', 'Admitted', 'Surgery Date', 'Surgery Time', ''].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wide whitespace-nowrap bg-gray-50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                : loadError
                ? (
                  <tr>
                    <td colSpan={13} className="py-14 text-center">
                      <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
                      <p className="text-sm font-medium text-gray-700 mb-1">Failed to load ward data</p>
                      <p className="text-xs text-gray-400 mb-4">{loadError}</p>
                      <button
                        onClick={() => loadData()}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                        Try Again
                      </button>
                    </td>
                  </tr>
                )
                : displayJourneys.length === 0
                ? (
                  <tr>
                    <td colSpan={13} className="py-14 text-center text-gray-400">
                      <Tent className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No patients found in this category</p>
                    </td>
                  </tr>
                )
                : (<>{visibleJourneys.map((j, idx) => {
                  const patientAge = j.patientDob
                    ? Math.floor((Date.now() - new Date(j.patientDob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
                    : null;
                  const ageGender = [
                    patientAge !== null ? `${patientAge}y` : null,
                    j.patientGender ? j.patientGender[0].toUpperCase() : null,
                  ].filter(Boolean).join(' / ') || '—';
                  return (
                  <tr key={j.id} onClick={() => handleRowClick(j)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${j.patientName ?? 'patient'} details`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRowClick(j);
                      }
                    }}
                    data-testid={WARD_PREOP_TEST_IDS.wardJourneyRow(j.id)}
                    data-clinical-state={j.clinicalState}
                    className={`transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
                      j.clinicalState === 'SurgeryCompleted' ? 'bg-green-50 hover:bg-green-100' :
                      j.clinicalState === 'InOT'            ? 'bg-amber-50 hover:bg-amber-100' :
                                                              'hover:bg-blue-50'
                    } ${transitionLoading === j.id ? 'opacity-50 pointer-events-none' : ''}`}>
                    <td className="px-3 py-3">
                      <StatusBadge status={j.clinicalState} size="sm" />
                      <WardReadinessMeter
                        clinicalState={j.clinicalState}
                        completed={j.readinessCompleted}
                        total={j.readinessTotal}
                        unverifiedCriticalCount={j.unverifiedCriticalCount}
                        pacCompleted={j.pacCompleted}
                        p2NeedsAttention={j.p2ClearanceNeedsAttention}
                      />
                      {j.isPatientMerged && (
                        <span
                          data-testid={WARD_PREOP_TEST_IDS.mergedMrBadge}
                          className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5 mt-1 whitespace-nowrap"
                        >
                          Merged MR
                          {j.canonicalUhid ? ` → ${j.canonicalUhid}` : ''}
                        </span>
                      )}
                      {j.clinicalState === 'ReadyForSurgery' && j.otReturnReason && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-2 py-0.5 mt-1 whitespace-nowrap">
                          ⚠ Returned from OT
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{idx + 1}</td>
                    <td className={`px-3 py-3 font-mono text-xs font-medium ${j.isPatientMerged ? 'line-through text-gray-400' : 'text-blue-700'}`}>{j.uhid ?? '—'}</td>
                    <td className={`px-3 py-3 font-medium whitespace-nowrap ${j.isPatientMerged ? 'line-through text-gray-400' : 'text-gray-900'}`}>{j.patientName ?? '—'}</td>
                    <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{ageGender}</td>
                    <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{j.admissionType ?? '—'}</td>
                    <td className="px-3 py-3 text-gray-700 text-xs whitespace-nowrap">
                      {j.eyeOperated ? <span className="font-medium">{j.eyeOperated}</span> : null}
                      {j.eyeOperated && j.procedureName ? <span className="text-gray-400"> · </span> : null}
                      {j.procedureName ?? (j.eyeOperated ? null : '—')}
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={j.otState} size="sm" /></td>
                    <td className="px-3 py-3 text-xs text-gray-600">
                      <span className="font-medium">{j.wardName ?? '—'}</span>
                      {j.bedNumber && <span className="text-gray-400"> · {j.bedNumber}</span>}
                    </td>
                    <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{fmt(j.admittedAt)}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(j.surgeryScheduledAt)}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtTime(j.surgeryScheduledAt)}</td>
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <InlineRowActions
                        journey={j}
                        onAction={action => handleRowAction(j, action)}
                      />
                    </td>
                  </tr>
                  );
                })}
                {hasMoreRows && (
                  <tr ref={loadMoreRef}>
                    <td colSpan={13} className="py-4 text-center text-xs text-gray-400">Loading more…</td>
                  </tr>
                )}
                </>)
              }
            </tbody>
          </table>
        </div>

        {!isLoading && displayJourneys.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing <span className="font-medium">{visibleJourneys.length}</span> of <span className="font-medium">{displayJourneys.length}</span>
              {displayJourneys.length !== journeys.length && <> (filtered from {journeys.length})</>} patients
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
