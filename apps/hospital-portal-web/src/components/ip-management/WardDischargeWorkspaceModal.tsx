'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LogOut, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  PatientJourneyRowDto,
  SaveDischargeSummaryRequest,
  ipManagementApi,
} from '@/lib/api/ip-management.api';
import { IpOverlayDialog } from '@/components/ip-management/IpOverlayDialog';
import { MergedMrGuardBanner } from '@/components/ip-management/MergedMrGuardBanner';
import { ReasonConfirmDialog } from '@/components/ip-management/ReasonConfirmDialog';
import { CollectPaymentDrawer } from '@/components/ip-management/CollectPaymentDrawer';
import { WardDischargeStepNav } from '@/components/ip-management/discharge/WardDischargeStepNav';
import type { DischargeStepStatus } from '@/components/ip-management/discharge/WardDischargeStepNav';
import { DischargeClearancePanel } from '@/components/ip-management/discharge/DischargeClearancePanel';
import { type DischargeStepKey } from '@/lib/ip-management/discharge-steps';
import { WARD_DISCHARGE_TEST_IDS } from '@/lib/ip-management/ward-discharge-test-ids';
import { transitionClinicalWithGates } from '@/lib/ip-checklist/transition-gates';
import { useIpChecklistPermissions } from '@/hooks/use-ip-checklist-permissions';
import { useAuthStore } from '@/lib/auth-store';
import { resolveIpRoleActions } from '@/lib/ip-management/ip-role-actions';
import { isoToDatetimeLocal } from '@/lib/ip-management/follow-up-appointment';
import { FollowUpAppointmentPanel } from '@/components/ip-management/postop/FollowUpAppointmentPanel';
import type { CollectFinSummary } from '@/lib/ip-management/collect-payment';

export interface WardDischargeWorkspaceModalProps {
  journey: PatientJourneyRowDto;
  onClose: () => void;
  onSaved: (updated: PatientJourneyRowDto) => void;
  initialStep?: DischargeStepKey;
}

const EMPTY_SUMMARY: SaveDischargeSummaryRequest = {
  conditionAtDischarge: '',
  diagnosisCodes: '',
  proceduresPerformed: '',
  hospitalCourse: '',
  dischargeInstructions: '',
  medicationsOnDischarge: '',
  followUpPlan: '',
  formatType: 'Standard',
};

export function WardDischargeWorkspaceModal({
  journey,
  onClose,
  onSaved,
  initialStep = 'clearance',
}: WardDischargeWorkspaceModalProps) {
  const { canEditMonitoring } = useIpChecklistPermissions();
  const permissions = useAuthStore(s => s.permissions);
  const collectedBy = useAuthStore(s =>
    [s.user?.firstName, s.user?.lastName].filter(Boolean).join(' ').trim(),
  );
  const roleActions = resolveIpRoleActions(permissions);
  const canCreateBill = permissions.includes('bill.create') || permissions.includes('bill.update');
  const canOverride =
    roleActions.canDischargeOverride ||
    permissions.includes('ip.admin') ||
    permissions.includes('admin');

  const [activeStep, setActiveStep] = useState<DischargeStepKey>(initialStep);
  const [stepStatus, setStepStatus] = useState<Partial<Record<DischargeStepKey, DischargeStepStatus>>>({});
  const [form, setForm] = useState<SaveDischargeSummaryRequest>(EMPTY_SUMMARY);
  const [isFinalized, setIsFinalized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [discharging, setDischarging] = useState(false);
  const [error, setError] = useState('');
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideApplying, setOverrideApplying] = useState(false);
  const [overrideError, setOverrideError] = useState('');
  const [dischargeType, setDischargeType] = useState<'Routine' | 'Lama' | 'Transfer' | 'Death' | 'Other'>('Routine');
  const [medsText, setMedsText] = useState('');
  const [followUpText, setFollowUpText] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [followupDoctorId, setFollowupDoctorId] = useState('');
  const [followupAppointmentId, setFollowupAppointmentId] = useState<string | null>(null);
  const [hardStopCount, setHardStopCount] = useState(0);
  const [followupBlocked, setFollowupBlocked] = useState(false);
  const [overrideApplied, setOverrideApplied] = useState(!!journey.dischargeOverrideApplied);
  const [patientDue, setPatientDue] = useState(0);
  const [collectOpen, setCollectOpen] = useState(false);
  const [finSummary, setFinSummary] = useState<CollectFinSummary>(null);
  const [tick, setTick] = useState(0);

  const isMergedReadOnly = !!journey.isPatientMerged;
  const reload = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [summary, instructions, gates, fin] = await Promise.all([
        ipManagementApi.getDischargeSummary(journey.id),
        ipManagementApi.getPostOpInstructions(journey.id),
        ipManagementApi.getTransitionGates(journey.id, 'Discharged'),
        ipManagementApi.getFinancialSummary(journey.id),
      ]);
      if (cancelled) return;

      if (summary) {
        setForm({
          conditionAtDischarge: summary.conditionAtDischarge ?? '',
          diagnosisCodes: summary.diagnosisCodes ?? '',
          proceduresPerformed: summary.proceduresPerformed ?? '',
          hospitalCourse: summary.hospitalCourse ?? '',
          dischargeInstructions: summary.dischargeInstructions ?? '',
          medicationsOnDischarge: summary.medicationsOnDischarge ?? '',
          followUpPlan: summary.followUpPlan ?? '',
          formatType: summary.formatType ?? 'Standard',
        });
        setIsFinalized(summary.summaryStatus === 'Final');
        setMedsText(summary.medicationsOnDischarge ?? '');
        setFollowUpText(summary.followUpPlan ?? '');
      }
      if (instructions) {
        if (!summary?.medicationsOnDischarge && instructions.medications) {
          setMedsText(instructions.medications);
        }
        setFollowupDate(isoToDatetimeLocal(instructions.followupDate));
        setFollowupDoctorId(instructions.followupDoctorId ?? '');
        setFollowupAppointmentId(instructions.followupAppointmentId ?? null);
      }

      const due = fin?.patientBalance ?? 0;
      setPatientDue(due);
      setFinSummary(fin);
      const gateBlocks = (gates?.warnings ?? []).filter(w => w.severity === 'block');
      const followupMissing = gateBlocks.some(w => w.code === 'followup_appointment_missing');
      setFollowupBlocked(followupMissing);
      const dueAlreadyInGates = gateBlocks.some(w => w.code === 'patient_obligation_outstanding');
      setHardStopCount(gateBlocks.length + (due > 0.5 && !dueAlreadyInGates ? 1 : 0));
      setOverrideApplied(!!journey.dischargeOverrideApplied);

      setStepStatus({
        clearance: gateBlocks.some(w => w.code === 'patient_obligation_outstanding') || due > 0.5 ? 'blocked' : 'done',
        summary: summary?.summaryStatus === 'Final' ? 'done' : summary ? 'idle' : 'idle',
        medications: !!(summary?.medicationsOnDischarge || instructions?.medications) ? 'done' : 'idle',
        followup: instructions?.followupAppointmentId ? 'done' : 'blocked',
        confirm: 'idle',
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [journey.id, tick]);

  async function handleSaveDraft() {
    if (isMergedReadOnly || isFinalized) return;
    setSaving(true);
    setError('');
    try {
      const payload: SaveDischargeSummaryRequest = {
        ...form,
        medicationsOnDischarge: medsText || form.medicationsOnDischarge,
        followUpPlan: followUpText || form.followUpPlan,
      };
      const saved = await ipManagementApi.saveDischargeSummary(journey.id, payload);
      if (!saved) {
        setError('Failed to save discharge summary.');
      } else {
        toast.success('Draft saved');
        setForm(payload);
        if (followupDate || medsText || followupAppointmentId) {
          await ipManagementApi.savePostOpInstructions(journey.id, {
            medications: medsText || undefined,
            followupDate: followupDate ? new Date(followupDate).toISOString() : undefined,
            followupDoctorId: followupDoctorId || undefined,
            followupAppointmentId: followupAppointmentId || undefined,
          });
        }
        reload();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function handleFinalize() {
    if (isMergedReadOnly) return;
    setFinalizing(true);
    setError('');
    try {
      await ipManagementApi.saveDischargeSummary(journey.id, {
        ...form,
        medicationsOnDischarge: medsText || form.medicationsOnDischarge,
        followUpPlan: followUpText || form.followUpPlan,
      });
      const result = await ipManagementApi.finalizeDischargeSummary(journey.id);
      if (result) {
        setIsFinalized(true);
        toast.success('Discharge summary finalized');
        reload();
      } else {
        setError('Finalize failed — save the draft first.');
      }
    } finally {
      setFinalizing(false);
    }
  }

  async function handleDischargeOverride(reason: string) {
    setOverrideApplying(true);
    setOverrideError('');
    try {
      await ipManagementApi.applyDischargeOverride(journey.id, { reason: reason.trim() });
      setOverrideOpen(false);
      setOverrideApplied(true);
      toast.success('Override applied — financial and follow-up gates are recorded on the journey audit.');
      reload();
    } catch {
      setOverrideError('Failed to apply discharge override.');
    } finally {
      setOverrideApplying(false);
    }
  }

  async function handleDischarge() {
    if (isMergedReadOnly) return;
    if (!isFinalized && dischargeType === 'Routine') {
      setError('Please finalize the discharge summary first.');
      setActiveStep('summary');
      return;
    }
    setDischarging(true);
    setError('');
    try {
      if (dischargeType !== 'Routine') {
        const result = await ipManagementApi.dischargeWithType(journey.id, {
          dischargeType,
          reason: form.dischargeInstructions || `${dischargeType} discharge`,
          confirmed: true,
          expectedUpdatedAt: journey.updatedAt,
        });
        toast.success(`${journey.patientName ?? 'Patient'} discharged (${dischargeType}).`);
        onSaved({ ...journey, clinicalState: result.clinicalState, updatedAt: result.updatedAt });
        onClose();
      } else {
        const result = await transitionClinicalWithGates(journey.id, {
          newState: 'Discharged',
          expectedUpdatedAt: journey.updatedAt,
        });
        if (result) {
          toast.success(
            `${journey.patientName ?? 'Patient'} has been discharged. Bill remains open until Billing finalises.`,
          );
          onSaved({ ...journey, clinicalState: result.clinicalState, updatedAt: result.updatedAt });
          onClose();
        }
      }
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error ??
        (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.message ??
        (e instanceof Error ? e.message : null) ??
        'Discharge failed.';
      setError(msg);
    } finally {
      setDischarging(false);
    }
  }

  const summaryFields: Array<{
    label: string;
    key: keyof SaveDischargeSummaryRequest;
    type?: string;
    rows?: number;
    options?: string[];
  }> = [
    { label: 'Diagnosis', key: 'diagnosisCodes', rows: 2 },
    { label: 'Procedures performed', key: 'proceduresPerformed', rows: 2 },
    { label: 'Course in hospital', key: 'hospitalCourse', rows: 3 },
    {
      label: 'Condition at discharge',
      key: 'conditionAtDischarge',
      type: 'select',
      options: ['', 'Good', 'Stable', 'Fair', 'Guarded'],
    },
    { label: 'Advice / instructions', key: 'dischargeInstructions', rows: 3 },
  ];

  function renderStep() {
    if (loading) {
      return (
        <div className="space-y-2 py-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      );
    }

    switch (activeStep) {
      case 'clearance':
        return (
          <DischargeClearancePanel
            journeyId={journey.id}
            readOnly={isMergedReadOnly || isFinalized}
            canEditMonitoring={canEditMonitoring}
            onCollectNow={() => setCollectOpen(true)}
          />
        );
      case 'summary':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Discharge summary</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Auto-draft from journey facts where available — edit narrative, not implant serials.
                </p>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isFinalized ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                }`}
              >
                {isFinalized ? 'Finalized · locked' : 'Draft · editable'}
              </span>
            </div>
            <div className="grid md:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-gray-200 p-3 space-y-1.5">
                <p className="font-semibold uppercase tracking-wide text-gray-500">Episode</p>
                <dl className="space-y-1 text-sm text-gray-800">
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Procedure</dt>
                    <dd className="text-right">{journey.procedureName ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Eye</dt>
                    <dd>{journey.eyeOperated ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Ward / bed</dt>
                    <dd>
                      {[journey.wardName, journey.bedNumber].filter(Boolean).join(' · ') || '—'}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-xs text-indigo-900">
                <b>One summary per journey.</b> Finalize locks the clinical narrative. Discharge still does not finalise the bill.
              </div>
            </div>
            {summaryFields.map(({ label, key, type, rows, options }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                {type === 'select' ? (
                  <select
                    value={(form[key] as string) ?? ''}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    disabled={isFinalized || isMergedReadOnly}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50"
                  >
                    {(options ?? []).map(opt => (
                      <option key={opt} value={opt}>
                        {opt || '— select —'}
                      </option>
                    ))}
                  </select>
                ) : (
                  <textarea
                    value={(form[key] as string) ?? ''}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    rows={rows ?? 2}
                    disabled={isFinalized || isMergedReadOnly}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none disabled:bg-gray-50"
                  />
                )}
              </div>
            ))}
            {!isFinalized && !isMergedReadOnly && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleSaveDraft()}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs border border-blue-300 bg-blue-50 text-blue-700 rounded-lg font-medium disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save draft'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleFinalize()}
                  disabled={finalizing}
                  className="px-3 py-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium disabled:opacity-60"
                >
                  {finalizing ? 'Finalizing…' : 'Finalize summary'}
                </button>
              </div>
            )}
          </div>
        );
      case 'medications':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Discharge medications</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Stored on the discharge summary / post-op instructions. Pharmacy charges post to the same bill.
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <b>Anything dispensed at discharge must be on the bill before finalisation</b>, or it becomes leakage.
            </div>
            <label className="block text-xs">
              <span className="font-medium text-gray-700">Medications on discharge</span>
              <textarea
                value={medsText}
                onChange={e => setMedsText(e.target.value)}
                disabled={isFinalized || isMergedReadOnly}
                rows={8}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm resize-none disabled:bg-gray-50"
                placeholder={'Drug · dose · frequency · duration\n…'}
              />
            </label>
            {!isFinalized && !isMergedReadOnly && (
              <button
                type="button"
                onClick={() => void handleSaveDraft()}
                disabled={saving}
                className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save medications'}
              </button>
            )}
          </div>
        );
      case 'followup':
        return (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Follow-up</h3>
            <FollowUpAppointmentPanel
              journeyId={journey.id}
              patientId={journey.patientId}
              patientName={journey.patientName}
              followupDate={followupDate}
              followupDoctorId={followupDoctorId}
              followupAppointmentId={followupAppointmentId}
              canBook={roleActions.canBookFollowUp}
              canLink={roleActions.canLinkFollowUp}
              readOnly={isMergedReadOnly}
              testIds
              onFollowupDateChange={setFollowupDate}
              onLinked={next => {
                setFollowupAppointmentId(next.followupAppointmentId);
                setFollowupDate(next.followupDate);
                setFollowupDoctorId(next.followupDoctorId);
                reload();
              }}
            />
            <label className="block text-xs">
              <span className="font-medium text-gray-700">Follow-up plan (notes)</span>
              <textarea
                value={followUpText}
                onChange={e => setFollowUpText(e.target.value)}
                disabled={isFinalized || isMergedReadOnly}
                rows={5}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm resize-none disabled:bg-gray-50"
                placeholder="Day-1 / week-1 reviews, clinic, SMS reminder notes…"
              />
            </label>
            {!isMergedReadOnly && (
              <button
                type="button"
                onClick={() => void handleSaveDraft()}
                disabled={saving}
                className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save follow-up notes'}
              </button>
            )}
          </div>
        );
      case 'confirm':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Confirm &amp; discharge</h3>
              {hardStopCount > 0 ? (
                <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-medium">Blocked</span>
              ) : (
                <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Ready</span>
              )}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-200 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Discharge details</p>
                <label className="block text-xs">
                  <span className="font-medium text-gray-700">Discharge type</span>
                  <select
                    value={dischargeType}
                    disabled={isMergedReadOnly}
                    onChange={e => setDischargeType(e.target.value as typeof dischargeType)}
                    className="mt-1 w-full border rounded-lg px-2.5 py-1.5 text-sm"
                  >
                    <option value="Routine">Routine</option>
                    <option value="Lama">Against medical advice (AMA / LAMA)</option>
                    <option value="Transfer">Transfer</option>
                    <option value="Death">Death</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                {dischargeType === 'Lama' && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    AMA bypasses clinical clearance but requires a recorded reason. The bed is still released and the bill still stands.
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-gray-200 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">What happens on confirm</p>
                <ul className="text-sm text-gray-700 space-y-1.5">
                  <li>✓ Journey moves to <code className="text-xs bg-gray-100 px-1 rounded">Discharged</code></li>
                  <li>✓ Bed released to Auth bed inventory</li>
                  <li>✓ <code className="text-xs bg-gray-100 px-1 rounded">PatientClinicallyDischarged</code> published</li>
                  <li>✓ Bill remains open until finalised by Billing</li>
                </ul>
              </div>
            </div>
            {hardStopCount > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
                <b>
                  {followupBlocked
                    ? 'Blocked — follow-up not booked.'
                    : patientDue > 0.5
                    ? `Blocked by patient due ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(patientDue)}.`
                    : 'Blocked by clearance gates.'}
                </b>{' '}
                {followupBlocked
                  ? 'Book or link a clinic visit, or an admin may override with a reason.'
                  : 'Collect through payment, or an admin may override financial blocks with a reason.'}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  }

  const footerHint = useMemo(() => {
    if (hardStopCount > 0) {
      return (
        <span className="text-red-700">
          <b>{hardStopCount} hard stop{hardStopCount === 1 ? '' : 's'}</b>
          {followupBlocked ? ' · follow-up not booked' : ''}
          {patientDue > 0.5
            ? ` · patient due ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(patientDue)}`
            : ''}
        </span>
      );
    }
    return <span className="text-emerald-700">Clearance open — discharge will release the bed</span>;
  }, [hardStopCount, patientDue, followupBlocked]);

  return (
    <IpOverlayDialog
      onClose={onClose}
      size="6xl"
      title="Discharge workspace"
      testId={WARD_DISCHARGE_TEST_IDS.workspace}
      className="max-h-[92vh] h-[92vh]"
    >
      <div className="flex flex-col h-full max-h-[92vh]">
        <div className="ws-head shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="name truncate">{journey.patientName ?? '—'}</span>
              <span className="mono">{journey.uhid ?? '—'}</span>
              <span className="badge ok">
                {journey.clinicalState === 'ReadyForDischarge' ? 'Ready for discharge' : journey.clinicalState}
              </span>
              {isFinalized && (
                <span className="badge inhouse">Summary final</span>
              )}
            </div>
            <p className="ident truncate">
              {[journey.procedureName, journey.eyeOperated, journey.wardName, journey.bedNumber]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <span className="spacer" />
          <button type="button" onClick={onClose} className="btn sm ghost" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          <aside className="shrink-0 border-b lg:border-b-0 lg:border-r border-gray-100 lg:w-56 p-2 bg-gray-50/50">
            <WardDischargeStepNav
              activeStep={activeStep}
              onStepChange={setActiveStep}
              stepStatus={stepStatus}
            />
          </aside>
          <div className="flex-1 overflow-y-auto p-5">
            {isMergedReadOnly && (
              <MergedMrGuardBanner
                canonicalPatientId={journey.canonicalPatientId}
                canonicalUhid={journey.canonicalUhid}
                className="mb-4"
              />
            )}
            {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>}
            {renderStep()}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3 border-t border-gray-100 shrink-0">
          <div className="flex-1 text-xs min-w-0">{footerHint}</div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canOverride && !isMergedReadOnly && (
              <button
                type="button"
                data-testid={WARD_DISCHARGE_TEST_IDS.btnOverride}
                onClick={() => {
                  setOverrideError('');
                  setOverrideOpen(true);
                }}
                disabled={overrideApplying}
                className="px-3 py-2 text-xs border border-amber-300 text-amber-800 rounded-lg hover:bg-amber-50 disabled:opacity-50"
              >
                Override with reason (admin)
              </button>
            )}
            {!isFinalized && !isMergedReadOnly && (
              <button
                type="button"
                data-testid={WARD_DISCHARGE_TEST_IDS.btnSave}
                onClick={() => void handleSaveDraft()}
                disabled={saving}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
            {!isMergedReadOnly && (
              <button
                type="button"
                data-testid={WARD_DISCHARGE_TEST_IDS.btnDischarge}
                onClick={() => void handleDischarge()}
                disabled={
                  discharging
                  || (dischargeType === 'Routine' && !isFinalized)
                  || (hardStopCount > 0 && !overrideApplied)
                }
                className="flex items-center gap-2 px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <LogOut className="h-4 w-4" />
                {discharging ? 'Discharging…' : 'Discharge patient'}
              </button>
            )}
          </div>
        </div>
      </div>

      <ReasonConfirmDialog
        open={overrideOpen}
        onOpenChange={open => {
          if (!open) {
            setOverrideOpen(false);
            setOverrideError('');
          }
        }}
        title={followupBlocked ? 'Discharge without a booked follow-up?' : 'Apply discharge override?'}
        patientName={journey.patientName ?? undefined}
        patientMeta={[journey.uhid, journey.wardName].filter(Boolean).join(' · ')}
        consequence={
          followupBlocked ? (
            <>
              The patient will leave <b>without a reserved clinic slot</b>. This is reported on the journey audit.
              Financial gates that still block are overridden with the same reason. This does not settle the bill.
            </>
          ) : (
            <>
              Checklist / financial gates that still block discharge will be <b>overridden with an audit trail</b>.
              Use only when clinically justified — this does not settle the bill.
            </>
          )
        }
        confirmLabel="Apply override"
        destructive
        minReasonLength={10}
        busy={overrideApplying}
        error={overrideError || undefined}
        onConfirm={reason => void handleDischargeOverride(reason)}
      />

      <CollectPaymentDrawer
        open={collectOpen}
        onOpenChange={setCollectOpen}
        journey={journey}
        finSummary={finSummary}
        canCreateBill={canCreateBill}
        collectedBy={collectedBy || 'Ward'}
        billingHref="/dashboard/billing/opd"
        onCollected={() => {
          setCollectOpen(false);
          reload();
        }}
        onRefreshSummary={async () => {
          const next = await ipManagementApi.getFinancialSummary(journey.id);
          setFinSummary(next);
          return next;
        }}
      />
    </IpOverlayDialog>
  );
}
