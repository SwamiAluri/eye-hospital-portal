'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Tent, X, AlertTriangle, Search,
  Stethoscope, SquareCheck, Square, Ban, RotateCcw,
} from 'lucide-react';
import { ActionMenu, ActionMenuItem } from '@/components/ip-management/preop/primitives/ActionMenu';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import JourneyModal from '@/components/ip-management/JourneyModal';
import {
  ipManagementApi,
  PatientJourneyRowDto,
  formatApiError,
  WardDashboardSummaryDto,
} from '@/lib/api/ip-management.api';
import { useAuthStore } from '@/lib/auth-store';
import { resolveIpRoleActions } from '@/lib/ip-management/ip-role-actions';
import { resolveIpPersona } from '@/lib/ip-management/ip-persona';
import { canUnmarkReady, UNMARK_READY_MIN_REASON_LENGTH } from '@/lib/ip-management/unmark-ready';
import { ReasonConfirmDialog } from '@/components/ip-management/ReasonConfirmDialog';
import { StatusChip } from '@/components/ip-management/preop/primitives/StatusChip';
import { toast } from '@/lib/toast';
import {
  WardPreOpWorkspaceModal,
  WardPreOpTopTab,
} from '@/components/ip-management/WardPreOpWorkspaceModal';
import { WardChecklistSection } from '@/components/ip-management/WardChecklistStepper';
import { WardPostOpWorkspaceModal } from '@/components/ip-management/WardPostOpWorkspaceModal';
import { WardDischargeWorkspaceModal } from '@/components/ip-management/WardDischargeWorkspaceModal';
import { WardReadinessMeter } from '@/components/ip-management/WardReadinessMeter';
import { WardPatientDrawer, WardDrawerSurface } from '@/components/ip-management/WardPatientDrawer';
import { WardKpiStrip } from '@/components/ip-management/WardKpiStrip';
import { WardPreOpGateBanner } from '@/components/ip-management/WardPreOpGateBanner';
import { useIpChecklistPermissions } from '@/hooks/use-ip-checklist-permissions';
import { transitionClinicalWithGates } from '@/lib/ip-checklist/transition-gates';
import { canCancelAdmission, canCancelTodaySurgery, journeyRowFromDetail } from '@/lib/ip-management/ward-journey-helpers';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';
import { IpOverlayDialog } from '@/components/ip-management/IpOverlayDialog';
import { useWardBoardQuery, patchWardJourney, useWardBedsQuery } from '@/hooks/use-ward-board-query';
import { ipRealtimeQueryKeys } from '@/lib/ip-management/ip-realtime-events';
import { WardBedMap } from '@/components/ip-management/WardBedMap';
import { operativeEyeDisplay } from '@/lib/ip-management/operative-eye-display';
import {
  WARD_BOARD_QUEUES,
  type WardBoardQueue,
  blockingSummary,
  clinicalStateToChip,
  countWardQueue,
  defaultWardQueue,
  isDayCareWard,
  journeyOnSelectedWard,
  matchesWardKpi,
  matchesWardQueue,
  occupancySummary,
  otStateToChip,
  resolveEffectiveWardQueue,
  resolveWardNextAction,
  returnedFromOtCount,
  stayLabel,
} from '@/lib/ip-management/ward-board-queues';

// ─── Types ────────────────────────────────────────────────────────────────────

type ClinicalTab = 'All' | 'Expected' | 'Admitted' | 'ReadyForSurgery' | 'InOT' | 'SurgeryCompleted' | 'PostOp' | 'ReadyForDischarge' | 'Discharged' | 'CancelledSurgery';
type ModalType = 'workspace' | 'emergencyFc' | 'sendToOT' | 'cancelToday' | 'cancelAdmission' | 'postOpWard' | 'discharge' | 'journey';
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

const LIST_COLSPAN = 8;

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: LIST_COLSPAN }).map((_, i) => (
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
      const result = await ipManagementApi.cancelTodaySurgery(journey.id, reason.trim(), journey.updatedAt);
      if (result) {
        onSaved(journeyRowFromDetail(journey, result));
        onClose();
      }
    } catch (err: unknown) {
      const conflict = Boolean((err as { concurrencyConflict?: boolean })?.concurrencyConflict);
      if (conflict) {
        const latest = await ipManagementApi.getJourneyDetail(journey.id);
        if (latest) onSaved(journeyRowFromDetail(journey, latest));
      }
      setError(err instanceof Error ? err.message : 'Could not cancel today\'s surgery.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <IpOverlayDialog
      onClose={onClose}
      size="md"
      title="Cancel Today's Surgery"
      testId={WARD_PREOP_TEST_IDS.cancelTodayModal}
    >
      <div>
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
    </IpOverlayDialog>
  );
}

function CancelAdmissionModal({ journey, onClose, onSaved }: {
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
      const result = await ipManagementApi.cancelAdmission(journey.id, reason.trim(), journey.updatedAt);
      if (result) {
        onSaved(journeyRowFromDetail(journey, result));
        onClose();
      }
    } catch (err: unknown) {
      const conflict = Boolean((err as { concurrencyConflict?: boolean })?.concurrencyConflict);
      if (conflict) {
        const latest = await ipManagementApi.getJourneyDetail(journey.id);
        if (latest) onSaved(journeyRowFromDetail(journey, latest));
      }
      setError(err instanceof Error ? err.message : 'Could not cancel this admission.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <IpOverlayDialog onClose={onClose} size="md" title="Cancel Admission">
      <div>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Ban className="h-4 w-4 text-rose-600" />
            <h2 className="text-base font-semibold text-gray-900">Cancel Admission</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-xs text-gray-600">
            Allowed only while the patient is still <span className="font-semibold">Expected</span>.
            Any reserved bed is released in Auth occupancy. This does not rebook surgery.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Why is this admission being cancelled?"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
            />
          </div>
          {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Close</button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium disabled:opacity-60"
            >
              {saving ? 'Cancelling…' : 'Confirm cancel admission'}
            </button>
          </div>
        </form>
      </div>
    </IpOverlayDialog>
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
        onSaved({
          ...journey,
          financialState: result.financialState,
          isEmergencyFc: true,
          emergencyFcReason: reason.trim(),
        });
        onClose();
      } else {
        setError('Failed to apply Emergency FC. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <IpOverlayDialog onClose={onClose} size="md" title="Emergency Financial Category">
      <div>
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
            <textarea
              data-testid="ward-emergency-fc-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              required
              rows={3}
              placeholder="Describe the emergency financial situation…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button
              type="submit"
              disabled={saving}
              data-testid="ward-emergency-fc-submit"
              className="px-5 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-60"
            >
              {saving ? 'Applying…' : 'Apply Emergency FC'}
            </button>
          </div>
        </form>
      </div>
    </IpOverlayDialog>
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
      const result = await transitionClinicalWithGates(journey.id, {
        newState: 'SentToOT',
        expectedUpdatedAt: journey.updatedAt,
      });
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
    <IpOverlayDialog
      onClose={onClose}
      size="sm"
      title="Send to Operation Theatre"
      testId={WARD_PREOP_TEST_IDS.sendToOtModal}
    >
      <div>
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
    </IpOverlayDialog>
  );
}

// ─── Row Icon Action Bar ───────────────────────────────────────────────────────

function InlineRowActions({ journey, onAction, canApplyEmergencyFc }: {
  journey: PatientJourneyRowDto;
  onAction: (action: RowAction) => void;
  canApplyEmergencyFc: boolean;
}) {
  const isSurgeryCancelled = journey.clinicalState === 'CancelledSurgery';
  const isTerminalCancel = isSurgeryCancelled || journey.clinicalState === 'AdmissionCancelled';

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
  if (canCancelAdmission(journey)) {
    items.push({
      id: 'cancelAdmission',
      label: 'Cancel admission',
      icon: Ban,
      destructive: true,
      onSelect: () => onAction('cancelAdmission'),
    });
  }
  if (canApplyEmergencyFc && !journey.isLocked && journey.clinicalState !== 'Discharged' && !isTerminalCancel) {
    items.push({
      id: 'emergencyFc',
      label: 'Emergency FC',
      icon: AlertTriangle,
      onSelect: () => onAction('emergencyFc'),
    });
  }

  return (
    <div className="flex items-center justify-end gap-1.5 flex-nowrap">
      {isSurgeryCancelled && (
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

// ─── Role-based dashboard defaults (Phase 8) ────────────────────────────────────
// Applied once on first load; never overrides a user's subsequent interactions.
// Queue default (Needs me / On ward) is persona emphasis, not these tab defaults.

const ROLE_DASHBOARD_DEFAULTS: { test: RegExp; view: { tab?: ClinicalTab; kpi?: string } }[] = [
  { test: /ANAE|ANES/i,                   view: { kpi: 'pacPending' } },
  { test: /BILL|FINAN|ACCOUNT|CASH|TPA/i, view: { kpi: 'financialPending' } },
];

function defaultDashboardView(roles: string[] | undefined): { tab?: ClinicalTab; kpi?: string } | null {
  for (const role of roles ?? []) {
    const match = ROLE_DASHBOARD_DEFAULTS.find(r => r.test.test(role));
    if (match) return match.view;
  }
  return null;
}

function mapWardLoadError(err: unknown): string {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === 401 || status === 403) {
    return 'Session expired. Please refresh the page or log in again.';
  }
  if (status === 400) {
    return 'Invalid request. Branch configuration may be missing.';
  }
  return 'Could not load ward data. The service may be starting up — please try again.';
}

// Incremental render window: how many rows to add each time the sentinel scrolls in.
const ROW_PAGE = 50;

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WardManagementPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading ward…</div>}>
      <WardManagementPageInner />
    </Suspense>
  );
}

function WardManagementPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const permissions = useAuthStore(s => s.permissions);
  const ipActions = resolveIpRoleActions(permissions);
  const { canApplyEmergencyFc } = useIpChecklistPermissions();
  const roles = useAuthStore(s => s.roles);
  const persona = useMemo(() => resolveIpPersona(permissions, roles), [permissions, roles]);
  const branchId = user?.branchId;
  const appliedRoleDefault = useRef(false);
  const appliedQueueDefault = useRef(false);

  const [activeTab, setActiveTab] = useState<ClinicalTab>('All');
  const [queue, setQueue] = useState<WardBoardQueue>(() => defaultWardQueue('ward'));
  const [queueActive, setQueueActive] = useState(true);
  const [boardView, setBoardView] = useState<'list' | 'floor'>('list');
  const [filters, setFilters] = useState({ surgeryDate: '', search: '', otRoom: '', anaesthetist: '', surgeon: '', kpi: '' });
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
  const [mapWardId, setMapWardId] = useState('');
  const [unmarkTarget, setUnmarkTarget] = useState<PatientJourneyRowDto | null>(null);
  const [unmarkBusy, setUnmarkBusy] = useState(false);
  const [unmarkError, setUnmarkError] = useState('');
  const sendOtOrigin = useRef<'workspace' | 'board'>('board');

  const pauseRefresh = !!(
    selectedJourney || drawerJourney || rebookTarget || activeModal || cancelReturnModal || transitionLoading
  );
  const { board, summary: summaryQuery, queryClient } = useWardBoardQuery(branchId, { pauseRefresh });
  const journeys = useMemo(() => board.data?.journeys ?? [], [board.data]);
  const wards = useMemo(() => board.data?.wards ?? [], [board.data]);
  const summary = summaryQuery.data ?? null;
  const canViewBedMap = permissions.includes('*')
    || permissions.includes('ip.view')
    || permissions.includes('ip_management.view');
  const bedsQuery = useWardBedsQuery(canViewBedMap ? mapWardId || undefined : undefined, { pauseRefresh });
  const isLoading = Boolean(branchId) && board.isPending;
  const loadError = !branchId
    ? 'Your account has no branch assigned. Please contact your administrator.'
    : !board.data && board.isError
      ? mapWardLoadError(board.error)
      : null;

  useEffect(() => {
    if (appliedRoleDefault.current || !roles || roles.length === 0) return;
    appliedRoleDefault.current = true;
    const view = defaultDashboardView(roles);
    if (!view) return;
    if (view.tab) setActiveTab(view.tab);
    if (view.kpi) setFilters(f => ({ ...f, kpi: view.kpi! }));
  }, [roles]);

  useEffect(() => {
    if (appliedQueueDefault.current) return;
    if (!roles?.length && !permissions?.length) return;
    appliedQueueDefault.current = true;
    setQueue(defaultWardQueue(resolveIpPersona(permissions, roles)));
  }, [roles, permissions]);

  useEffect(() => {
    if (!wards.length) return;
    if (mapWardId && wards.some(w => w.id === mapWardId)) return;
    const dayCare = wards.find(w =>
      /day\s*care/i.test(w.wardType) || /day\s*care/i.test(w.wardName));
    setMapWardId((dayCare ?? wards[0]).id);
  }, [wards, mapWardId]);

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
    if (!branchId) return;
    patchWardJourney(queryClient, branchId, updated.id, updated);
  }

  async function handleUnmarkReady(reason: string) {
    const target = unmarkTarget;
    if (!target) return;
    setUnmarkBusy(true);
    setUnmarkError('');
    try {
      const detail = await ipManagementApi.transitionClinical(target.id, {
        newState: 'Admitted',
        reason,
        expectedUpdatedAt: target.updatedAt,
      });
      handleRowUpdated(journeyRowFromDetail(target, detail));
      setUnmarkTarget(null);
      setDrawerJourney(prev => prev && prev.id === target.id ? journeyRowFromDetail(target, detail) : prev);
    } catch (err) {
      setUnmarkError(err instanceof Error ? err.message : formatApiError(err, 'Could not revert Ready for OT.'));
    } finally {
      setUnmarkBusy(false);
    }
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
      if (branchId) {
        void ipManagementApi.fetchWardDashboardSummary(branchId)
          .then(next => {
            queryClient.setQueryData(ipRealtimeQueryKeys.wardSummary(branchId), next);
          })
          .catch(() => {});
      }
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

  async function handleMarkReady(journey: PatientJourneyRowDto) {
    setTransitionLoading(journey.id);
    try {
      const detail = await transitionClinicalWithGates(journey.id, {
        newState: 'ReadyForSurgery',
        reason: 'Marked ready from ward board',
        expectedUpdatedAt: journey.updatedAt,
      });
      handleRowUpdated(journeyRowFromDetail(journey, detail));
      toast.success('Marked ready for OT');
    } catch (err) {
      const warnings = (err as { warnings?: { severity?: string; message: string }[] }).warnings ?? [];
      const hard = warnings.filter(w => w.severity === 'block');
      if (hard.length) {
        toast.error(hard.map(w => w.message).join(' '), { description: 'Hard stop — open pre-op to resolve.' });
        openWorkspace(journey);
      } else if (err instanceof Error && err.message.includes('cancelled due to checklist warnings')) {
        toast.error('Mark ready cancelled. Warnings must be acknowledged.');
      } else {
        toast.error(formatApiError(err, 'Could not mark ready for OT.'));
      }
    } finally {
      setTransitionLoading(null);
    }
  }

  function runNextAction(journey: PatientJourneyRowDto) {
    const next = resolveWardNextAction(journey, persona, ipActions);
    switch (next.kind) {
      case 'markReady':
        void handleMarkReady(journey);
        return;
      case 'sendToOt':
        sendOtOrigin.current = 'board';
        openModal(journey, 'sendToOT');
        return;
      case 'postop':
        openModal(journey, 'postOpWard');
        return;
      case 'discharge':
        openModal(journey, 'discharge');
        return;
      case 'rebook':
        setRebookTarget(journey);
        return;
      case 'otBoard':
        router.push(`/dashboard/ip-management/operation-theatre?patient=${encodeURIComponent(journey.id)}`);
        return;
      case 'journey':
        openModal(journey, 'journey');
        return;
      case 'preop':
      default:
        openWorkspace(journey);
    }
  }

  const deepLinkConsumed = useRef(false);
  useEffect(() => {
    if (deepLinkConsumed.current || journeys.length === 0) return;
    const patient = searchParams.get('patient');
    if (!patient) {
      deepLinkConsumed.current = true;
      return;
    }
    const match = journeys.find(j => j.id === patient);
    if (!match) return;
    deepLinkConsumed.current = true;
    const intent = searchParams.get('intent');
    if (intent === 'postop') openModal(match, 'postOpWard');
    else if (intent === 'discharge') openModal(match, 'discharge');
    else if (intent === 'transfer') openWorkspace(match);
    else setDrawerJourney(match);
  }, [journeys, searchParams]);

  function selectKpi(key: string) {
    setActiveTab('All');
    setQueueActive(false);
    setFilters(f => ({ ...f, kpi: f.kpi === key ? '' : key }));
  }

  function selectTab(key: ClinicalTab) {
    setActiveTab(key);
    setQueueActive(false);
    setFilters(f => ({ ...f, kpi: '' }));
  }

  function selectQueue(key: WardBoardQueue) {
    setQueue(key);
    setQueueActive(true);
    setActiveTab('All');
    setFilters(f => ({ ...f, kpi: '' }));
  }

  const selectedWard = useMemo(() => wards.find(w => w.id === mapWardId) ?? null, [wards, mapWardId]);
  const dayCare = isDayCareWard(selectedWard);
  const wardJourneys = useMemo(
    () => journeys.filter(j => journeyOnSelectedWard(j, selectedWard)),
    [journeys, selectedWard],
  );
  const queueCounts = useMemo(() => {
    const map: Record<WardBoardQueue, number> = {
      need: 0, ward: 0, arrive: 0, ot: 0, rec: 0, more: 0,
    };
    for (const q of WARD_BOARD_QUEUES) {
      map[q.key] = countWardQueue(wardJourneys, q.key);
    }
    return map;
  }, [wardJourneys]);
  const effective = useMemo(
    () => resolveEffectiveWardQueue(queue, wardJourneys),
    [queue, wardJourneys],
  );

  const displayJourneys = useMemo(() => {
    let list = wardJourneys;
    if (activeTab !== 'Discharged' && !(queueActive && effective.queue === 'more')) {
      list = list.filter(j => j.clinicalState !== 'Discharged');
    }
    if (activeTab === 'CancelledSurgery') {
      list = list.filter(j =>
        j.clinicalState === 'CancelledSurgery' || j.clinicalState === 'AdmissionCancelled');
    } else if (activeTab !== 'All') {
      list = list.filter(j => j.clinicalState === activeTab);
    } else if (queueActive) {
      list = list.filter(j => matchesWardQueue(j, effective.queue));
    }
    if (filters.kpi) list = list.filter(j => matchesWardKpi(j, filters.kpi));
    if (filters.surgeryDate) list = list.filter(j => j.surgeryScheduledAt?.startsWith(filters.surgeryDate));
    if (filters.otRoom) list = list.filter(j => j.operationTheatreName === filters.otRoom);
    if (filters.anaesthetist) list = list.filter(j => j.anaesthetistName === filters.anaesthetist);
    if (filters.surgeon) list = list.filter(j => j.surgeonName === filters.surgeon);
    const q = filters.search.trim().toLowerCase();
    if (q) {
      list = list.filter(j =>
        (j.patientName ?? '').toLowerCase().includes(q)
        || (j.uhid ?? '').toLowerCase().includes(q)
        || (j.bedNumber ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [wardJourneys, activeTab, queueActive, effective.queue, filters]);

  // Incremental windowing — render `visibleCount` rows, growing as the sentinel scrolls
  // into view. Keeps instant client-side filtering while bounding the DOM for large lists.
  const visibleJourneys = useMemo(
    () => displayJourneys.slice(0, visibleCount),
    [displayJourneys, visibleCount],
  );
  const hasMoreRows = visibleCount < displayJourneys.length;

  useEffect(() => { setVisibleCount(ROW_PAGE); }, [activeTab, filters, queue]);

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
    const map: Record<string, number> = { All: wardJourneys.length };
    STATUS_TABS.slice(1).forEach(({ key }) => {
      if (key === 'CancelledSurgery') {
        map[key] = wardJourneys.filter(j =>
          j.clinicalState === 'CancelledSurgery' || j.clinicalState === 'AdmissionCancelled').length;
      } else {
        map[key] = wardJourneys.filter(j => j.clinicalState === key).length;
      }
    });
    return map;
  }, [wardJourneys]);

  const thisWardSummary = useMemo((): WardDashboardSummaryDto | null => {
    if (isLoading && !wardJourneys.length && !summary) return null;
    const count = (key: string) => wardJourneys.filter(j => matchesWardKpi(j, key)).length;
    return {
      stageCounts: counts,
      otLoadToday: count('otLoadToday'),
      pacPending: count('pacPending'),
      criticalLabs: count('criticalLabs'),
      financialPending: count('financialPending'),
      delayed: count('delayed'),
      cancelledToday: summary?.cancelledToday ?? 0,
      rebookRequired: count('rebookRequired'),
      emergencyCount: summary?.emergencyCount ?? 0,
      facets: summary?.facets ?? { otRooms: [], anaesthetists: [], payers: [], surgeons: [] },
    };
  }, [isLoading, wardJourneys, summary, counts]);

  const occ = occupancySummary(bedsQuery.data ?? []);
  const returnedOt = returnedFromOtCount(wardJourneys);
  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
  const listHeaders = dayCare
    ? ['Patient', 'Procedure', 'Chair', 'Slot / admitted', 'OT state', 'Blocking', 'Next', '']
    : ['Patient', 'Procedure', 'Bed', 'Admitted / stay', 'OT state', 'Blocking', 'Next', ''];

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
    <div className="ip-target pb-6" data-testid={WARD_PREOP_TEST_IDS.wardPage}>
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
          onUnmarkReady={canUnmarkReady(drawerJourney, ipActions)
            ? (j) => { setDrawerJourney(null); setUnmarkError(''); setUnmarkTarget(j); }
            : undefined}
          canPrintWristband={ipActions.canPrintSafetyToken}
          persona={persona}
        />
      )}
      {unmarkTarget && (
        <ReasonConfirmDialog
          open
          onOpenChange={open => { if (!open) { setUnmarkTarget(null); setUnmarkError(''); } }}
          title={'Revert "Ready for OT"?'}
          patientName={unmarkTarget.patientName ?? undefined}
          patientMeta={[unmarkTarget.uhid, unmarkTarget.wardName, unmarkTarget.bedNumber].filter(Boolean).join(' · ')}
          consequence={
            <>
              The OT team will be notified and the patient returns to <b>Admitted</b>. The slot stays reserved.
            </>
          }
          confirmLabel="Revert to Admitted"
          minReasonLength={UNMARK_READY_MIN_REASON_LENGTH}
          busy={unmarkBusy}
          error={unmarkError || undefined}
          onConfirm={reason => void handleUnmarkReady(reason)}
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
          onRequestSendToOt={() => {
            sendOtOrigin.current = 'workspace';
            setActiveModal('sendToOT');
          }}
          onRequestCancelToday={() => {
            setCancelReturnModal('workspace');
            setActiveModal('cancelToday');
          }}
        />
      )}
      {selectedJourney && activeModal === 'cancelAdmission' && (
        <CancelAdmissionModal
          journey={selectedJourney}
          onClose={closeModal}
          onSaved={u => {
            handleRowUpdated(u);
            closeModal();
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
          onClose={() => {
            if (sendOtOrigin.current === 'workspace') setActiveModal('workspace');
            else closeModal();
          }}
          onSaved={u => { handleRowUpdated(u); closeModal(); }}
        />
      )}
      {selectedJourney && activeModal === 'postOpWard' && (
        <WardPostOpWorkspaceModal journey={selectedJourney} onClose={closeModal}
          onSaved={u => { handleRowUpdated(u); closeModal(); }} />
      )}
      {selectedJourney && activeModal === 'discharge' && (
        <WardDischargeWorkspaceModal journey={selectedJourney} onClose={closeModal}
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
            if (!branchId) return;
            patchWardJourney(queryClient, branchId, selectedJourney.id, partial);
          }}
        />
      )}

      <div className="frame">
      <div className="app-header">
        <h1>Ward</h1>
        <span className="scope">
          {selectedWard?.wardName ?? 'Select a ward'}
          {' · '}
          {todayLabel}
          {' · '}
          {thisWardSummary?.otLoadToday ?? 0} on today&apos;s OT
        </span>
        <span className="spacer" />
        <div className="seg" role="group" aria-label="List or floor view">
          <button
            type="button"
            data-testid={WARD_PREOP_TEST_IDS.wardViewList}
            className={boardView === 'list' ? 'on' : ''}
            aria-pressed={boardView === 'list'}
            onClick={() => setBoardView('list')}
          >
            List
          </button>
          <button
            type="button"
            data-testid={WARD_PREOP_TEST_IDS.wardViewFloor}
            className={boardView === 'floor' ? 'on' : ''}
            aria-pressed={boardView === 'floor'}
            onClick={() => setBoardView('floor')}
          >
            Floor
          </button>
        </div>
        {loadError
          ? <span className="badge danger no-dot">Error</span>
          : board.isFetching && !board.isPending
            ? <span className="badge no-dot">Refreshing</span>
            : <span className="badge ok no-dot">Live</span>}
        <button
          type="button"
          className="btn sm"
          onClick={() => {
            void board.refetch();
            void summaryQuery.refetch();
            void bedsQuery.refetch();
          }}
        >
          ↻ Refresh
        </button>
        <Link href="/dashboard/ip-management/slots" className="btn sm">Slot board</Link>
      </div>

      <WardKpiStrip
        summary={thisWardSummary}
        returnedFromOt={returnedOt}
        persona={persona}
        activeKey={filters.kpi}
        onSelect={selectKpi}
      />

      {canViewBedMap && (
        <div className="occ" data-testid={WARD_PREOP_TEST_IDS.wardOccupancy}>
          <span className="stat">
            {dayCare ? 'Chairs' : 'Beds'} {occ.occupied} / {occ.total || '—'} occupied
          </span>
          <span className="sep">|</span>
          <span>
            {occ.cleaning} cleaning · {occ.available} free · {occ.reserved} reserved
          </span>
          <span className="spacer" style={{ flex: 1 }} />
          <span className="small">
            {boardView === 'list' ? 'List keeps occupancy collapsed. Open Floor for the map.' : 'Floor uses the existing bed map.'}
          </span>
        </div>
      )}

      <div className="filters">
        {canViewBedMap && wards.length > 0 && (
          <label className="filter-field">
            <span>Ward</span>
            <select
              value={mapWardId}
              onChange={e => setMapWardId(e.target.value)}
              className="input"
              aria-label="Ward"
            >
              {wards.map(w => (
                <option key={w.id} value={w.id}>{w.wardName}</option>
              ))}
            </select>
          </label>
        )}
        <label className="filter-field grow">
          <span>Search</span>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[color:var(--ip-faint)]" />
            <input
              ref={searchRef}
              data-testid={WARD_PREOP_TEST_IDS.search}
              type="text"
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              placeholder="Patient, UHID, bed…"
              className="input"
              style={{ width: '100%', paddingLeft: 28 }}
            />
          </div>
        </label>
        <label className="filter-field">
          <span>Surgery date</span>
          <input
            type="date"
            value={filters.surgeryDate}
            onChange={e => setFilters(f => ({ ...f, surgeryDate: e.target.value }))}
            className="input"
            aria-label="Surgery date"
          />
        </label>
        {facets.otRooms.length > 0 && (
          <label className="filter-field">
            <span>OT room</span>
            <select
              data-testid={WARD_PREOP_TEST_IDS.filterOtRoom}
              value={filters.otRoom}
              onChange={e => setFilters(f => ({ ...f, otRoom: e.target.value }))}
              className="input"
              aria-label="OT room"
            >
              <option value="">All rooms</option>
              {facets.otRooms.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        )}
        {facets.anaesthetists.length > 0 && (
          <label className="filter-field">
            <span>Anaesthetist</span>
            <select
              data-testid={WARD_PREOP_TEST_IDS.filterAnaesthetist}
              value={filters.anaesthetist}
              onChange={e => setFilters(f => ({ ...f, anaesthetist: e.target.value }))}
              className="input"
              aria-label="Anaesthetist"
            >
              <option value="">All</option>
              {facets.anaesthetists.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
        )}
        {facets.surgeons.length > 0 && (
          <label className="filter-field">
            <span>Surgeon</span>
            <select
              data-testid={WARD_PREOP_TEST_IDS.filterSurgeon}
              value={filters.surgeon}
              onChange={e => setFilters(f => ({ ...f, surgeon: e.target.value }))}
              className="input"
              aria-label="Surgeon"
            >
              <option value="">All</option>
              {facets.surgeons.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="tabs" role="tablist" aria-label="Ward queues">
        {WARD_BOARD_QUEUES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={queueActive && queue === key && activeTab === 'All'}
            onClick={() => selectQueue(key)}
            data-testid={WARD_PREOP_TEST_IDS.wardQueueTab(key)}
            className={`qtab ${queueActive && queue === key && activeTab === 'All' ? 'active' : ''}`}
          >
            {queueCounts[key] > 0 && key === 'need' ? <span className="sr-only">Has items. </span> : null}
            {label}
            <span className="count">{queueCounts[key]}</span>
          </button>
        ))}
      </div>

      {effective.fellThrough && queueActive && activeTab === 'All' && !filters.kpi && (
        <p className="fallthrough" data-testid={WARD_PREOP_TEST_IDS.wardFallthroughNote}>
          Needs me is empty. Showing On ward.
        </p>
      )}

      <div className="tabs stage-tabs" role="tablist" aria-label="Clinical stage">
        {STATUS_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            onClick={() => selectTab(key)}
            data-testid={WARD_PREOP_TEST_IDS.wardStatusTab(key)}
            className={`tab ${activeTab === key ? 'active' : ''}`}
          >
            {label}
            <span className="count">{counts[key] ?? 0}</span>
          </button>
        ))}
      </div>

      {boardView === 'floor' && loadError && (
        <div className="px-6 py-10 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
          <p className="text-sm font-medium text-gray-700 mb-1">Failed to load ward data</p>
          <p className="text-xs text-gray-400 mb-4">{loadError}</p>
          <button
            type="button"
            onClick={() => { void board.refetch(); void summaryQuery.refetch(); }}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Try Again
          </button>
        </div>
      )}

      {boardView === 'floor' && canViewBedMap && mapWardId && !loadError && (
        <WardBedMap
          beds={bedsQuery.data ?? []}
          loading={bedsQuery.isPending}
          selectedJourneyId={drawerJourney?.id}
          onOccupiedClick={journeyId => {
            const row = journeys.find(j => j.id === journeyId);
            if (row) setDrawerJourney(row);
          }}
        />
      )}

      {boardView === 'list' && (
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
          <table className="grid">
            <thead>
              <tr>
                {listHeaders.map((h, i) => (
                  <th key={h || `actions-${i}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                : loadError
                ? (
                  <tr>
                    <td colSpan={LIST_COLSPAN} className="py-14 text-center">
                      <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
                      <p className="text-sm font-medium text-gray-700 mb-1">Failed to load ward data</p>
                      <p className="text-xs text-gray-400 mb-4">{loadError}</p>
                      <button
                        onClick={() => { void board.refetch(); void summaryQuery.refetch(); }}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                        Try Again
                      </button>
                    </td>
                  </tr>
                )
                : displayJourneys.length === 0
                ? (
                  <tr>
                    <td colSpan={LIST_COLSPAN} className="py-14 text-center text-gray-400">
                      <Tent className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">
                        {journeys.length === 0 ? 'No patients on this ward' : 'No patients found in this category'}
                      </p>
                    </td>
                  </tr>
                )
                : (<>{visibleJourneys.map((j) => {
                  const patientAge = j.patientAge
                    ?? (j.patientDob
                      ? Math.floor((Date.now() - new Date(j.patientDob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
                      : null);
                  const ageGender = [
                    patientAge !== null ? `${patientAge}y` : null,
                    j.patientGender ? j.patientGender[0].toUpperCase() : null,
                  ].filter(Boolean).join(' / ') || '—';
                  const eye = operativeEyeDisplay(j.eyeOperated);
                  const clinical = clinicalStateToChip(j.clinicalState);
                  const otChip = otStateToChip(j.otState);
                  const blockers = blockingSummary(j);
                  const next = resolveWardNextAction(j, persona, ipActions);
                  const slotOrStay = dayCare
                    ? (j.slotLabel || j.slotSession || fmtTime(j.admittedAt) || '—')
                    : `${fmt(j.admittedAt)}${j.admittedAt ? ` · ${stayLabel(j.admittedAt)}` : ''}`;
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
                    className={`clickable ${
                      drawerJourney?.id === j.id ? 'row-selected' : ''
                    } ${transitionLoading === j.id ? 'opacity-50 pointer-events-none' : ''}`}>
                    <td className="px-3 py-3">
                      <div className={j.isPatientMerged ? 'line-through text-gray-400' : 'font-medium text-gray-900'}>
                        {j.patientName ?? '—'}
                      </div>
                      <div className={`font-mono text-xs ${j.isPatientMerged ? 'line-through text-gray-400' : 'text-blue-700'}`}>
                        {j.uhid ?? '—'}
                      </div>
                      <div className="text-xs text-gray-500">{ageGender}{j.admissionType ? ` · ${j.admissionType}` : ''}</div>
                      {j.isPatientMerged && (
                        <span
                          data-testid={WARD_PREOP_TEST_IDS.mergedMrBadge}
                          className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5 mt-1 whitespace-nowrap"
                        >
                          Merged MR
                          {j.canonicalUhid ? ` → ${j.canonicalUhid}` : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {eye.kind === 'eye' ? (
                        <span className="eye-inline">
                          <span>{eye.word}</span>
                          <span className="abbr">{eye.code}</span>
                        </span>
                      ) : (
                        <span className="flag">Eye not set</span>
                      )}
                      <div className="text-xs text-gray-700">{j.procedureName ?? '—'}</div>
                      {j.surgeonName && <div className="text-[11px] text-gray-500">{j.surgeonName}</div>}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-700 whitespace-nowrap">
                      {j.bedNumber ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {slotOrStay}
                    </td>
                    <td className="px-3 py-3">
                      <StatusChip status={clinical.status} label={clinical.label} size="sm" />
                      {j.otState && j.otState !== 'NotSent' && j.otState !== j.clinicalState && (
                        <div className="mt-1">
                          <StatusChip status={otChip.status} label={otChip.label} size="sm" />
                        </div>
                      )}
                      {j.otReturnReason && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-2 py-0.5 mt-1 whitespace-nowrap">
                          Returned from OT
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <WardReadinessMeter
                        clinicalState={j.clinicalState}
                        completed={j.readinessCompleted}
                        total={j.readinessTotal}
                        unverifiedCriticalCount={j.unverifiedCriticalCount}
                        pacCompleted={j.pacCompleted}
                        p2NeedsAttention={j.p2ClearanceNeedsAttention}
                      />
                      {blockers && <div className="text-[11px] text-rose-700 mt-1">{blockers}</div>}
                    </td>
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        data-testid={WARD_PREOP_TEST_IDS.wardNextAction}
                        className={`next-btn ${next.primary ? 'primary' : ''}`}
                        disabled={transitionLoading === j.id}
                        onClick={() => runNextAction(j)}
                      >
                        {next.label}
                      </button>
                    </td>
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <InlineRowActions
                        journey={j}
                        canApplyEmergencyFc={canApplyEmergencyFc}
                        onAction={action => handleRowAction(j, action)}
                      />
                    </td>
                  </tr>
                  );
                })}
                {hasMoreRows && (
                  <tr ref={loadMoreRef}>
                    <td colSpan={LIST_COLSPAN} className="py-4 text-center text-xs text-gray-400">Loading more…</td>
                  </tr>
                )}
                </>)
              }
            </tbody>
          </table>
        </div>
      )}

        {!isLoading && boardView === 'list' && displayJourneys.length > 0 && (
          <div className="listfoot">
            <p>
              Showing <b>{visibleJourneys.length}</b> of <b>{displayJourneys.length}</b>
              {displayJourneys.length !== wardJourneys.length && <> (filtered from {wardJourneys.length})</>} patients
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
