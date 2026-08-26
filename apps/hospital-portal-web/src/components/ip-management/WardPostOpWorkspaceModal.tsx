'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LogOut, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  PatientJourneyRowDto,
  ipManagementApi,
} from '@/lib/api/ip-management.api';
import { MergedMrGuardBanner } from '@/components/ip-management/MergedMrGuardBanner';
import { IpOverlayDialog } from '@/components/ip-management/IpOverlayDialog';
import { WardPostOpStepNav } from '@/components/ip-management/postop/WardPostOpStepNav';
import { RecoveryVitalsPanel } from '@/components/ip-management/postop/RecoveryVitalsPanel';
import { NurseSurgeonChecklistPanel } from '@/components/ip-management/postop/NurseSurgeonChecklistPanel';
import { IolStickerReturnsPanel } from '@/components/ip-management/postop/IolStickerReturnsPanel';
import { PostOpInstructionsPanel } from '@/components/ip-management/postop/PostOpInstructionsPanel';
import { PostOpTaperPanel } from '@/components/ip-management/postop/PostOpTaperPanel';
import { FollowUpHandoverPanel } from '@/components/ip-management/postop/FollowUpHandoverPanel';
import { WARD_POSTOP_TEST_IDS } from '@/lib/ip-management/ward-postop-test-ids';
import { POSTOP_STEPS, type PostOpStepKey } from '@/lib/ip-management/postop-steps';
import type { PostOpStepStatus } from '@/components/ip-management/postop/WardPostOpStepNav';
import { transitionClinicalWithGates } from '@/lib/ip-checklist/transition-gates';

export interface WardPostOpWorkspaceModalProps {
  journey: PatientJourneyRowDto;
  onClose: () => void;
  onSaved: (updated: PatientJourneyRowDto) => void;
  initialStep?: PostOpStepKey;
}

export function WardPostOpWorkspaceModal({
  journey,
  onClose,
  onSaved,
  initialStep = 'vitals',
}: WardPostOpWorkspaceModalProps) {
  const [activeStep, setActiveStep] = useState<PostOpStepKey>(initialStep);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState('');
  const [stepStatus, setStepStatus] = useState<Partial<Record<PostOpStepKey, PostOpStepStatus>>>({});
  const [tick, setTick] = useState(0);
  const isMergedReadOnly = !!journey.isPatientMerged;

  const reloadStatus = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [vitals, checklist, implants, instructions, surgeon, taper] = await Promise.all([
        ipManagementApi.getVitals(journey.id),
        ipManagementApi.getWardPostOpChecklist(journey.id),
        ipManagementApi.listImplants(journey.id),
        ipManagementApi.getPostOpInstructions(journey.id),
        ipManagementApi.getSurgeonChecklist(journey.id),
        ipManagementApi.getPostOpTaper(journey.id),
      ]);
      if (cancelled) return;

      const nurseItems = checklist?.items ?? [];
      const nurseDone =
        nurseItems.length > 0 &&
        nurseItems.every(i => i.isCompleted || i.isBypassed);
      const surgeonItems = surgeon.items ?? [];
      const surgeonDone =
        surgeonItems.length === 0 ||
        surgeonItems.every(it =>
          (surgeon.responses ?? []).some(r => r.checklistItemId === it.id && r.isCompleted),
        );
      const sticker = checklist?.iolStickerChecks;
      const stickerOk = !!(sticker?.barcodeScan && sticker?.stickerInFile && sticker?.inventoryMatch);
      const needsWriteOff = implants.some(i => i.usageStatus === 'Opened_Unused');
      const iolOk = stickerOk && !needsWriteOff;
      const instructionsOk = !!(instructions?.isSaved || instructions?.medications || instructions?.warningSigns);
      const taperOk = (taper?.steps?.length ?? 0) > 0;
      const handoverOk = !!(instructions?.followupAppointmentId || instructions?.followupDate);

      setStepStatus({
        vitals: vitals.length >= 1 ? 'done' : 'idle',
        nurse: nurseDone && surgeonDone ? 'done' : 'idle',
        iol: needsWriteOff ? 'blocked' : iolOk ? 'done' : 'idle',
        taper: taperOk ? 'done' : 'idle',
        instructions: instructionsOk ? 'done' : 'idle',
        handover: handoverOk ? 'done' : 'idle',
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [journey.id, tick]);

  const doneCount = useMemo(
    () => POSTOP_STEPS.filter(s => stepStatus[s.key] === 'done').length,
    [stepStatus],
  );
  const progressPct = Math.round((doneCount / POSTOP_STEPS.length) * 100);
  const outstanding = useMemo(() => {
    const labels: string[] = [];
    for (const s of POSTOP_STEPS) {
      if (stepStatus[s.key] !== 'done') labels.push(s.short);
    }
    return labels;
  }, [stepStatus]);

  async function handleMarkReady() {
    if (isMergedReadOnly) return;
    setMarking(true);
    setError('');
    try {
      const result = await transitionClinicalWithGates(journey.id, {
        newState: 'ReadyForDischarge',
        expectedUpdatedAt: journey.updatedAt,
      });
      if (result) {
        toast.success('Marked ready for discharge — patient is not yet discharged.');
        onSaved({ ...journey, clinicalState: result.clinicalState, updatedAt: result.updatedAt });
        onClose();
      }
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error ??
        (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.message ??
        (e instanceof Error ? e.message : null) ??
        'Failed to mark ready for discharge.';
      setError(msg);
    } finally {
      setMarking(false);
    }
  }

  function renderStep() {
    switch (activeStep) {
      case 'vitals':
        return (
          <RecoveryVitalsPanel
            journeyId={journey.id}
            readOnly={isMergedReadOnly}
            onChanged={reloadStatus}
          />
        );
      case 'nurse':
        return (
          <NurseSurgeonChecklistPanel
            journeyId={journey.id}
            patientId={journey.patientId ?? undefined}
            counselingSessionId={journey.counselingSessionId ?? undefined}
            readOnly={isMergedReadOnly}
            onChanged={reloadStatus}
          />
        );
      case 'iol':
        return (
          <IolStickerReturnsPanel
            journeyId={journey.id}
            readOnly={isMergedReadOnly}
            onChanged={reloadStatus}
          />
        );
      case 'taper':
        return (
          <PostOpTaperPanel
            journeyId={journey.id}
            eyeOperated={journey.eyeOperated}
            readOnly={isMergedReadOnly}
            onChanged={reloadStatus}
          />
        );
      case 'instructions':
        return (
          <PostOpInstructionsPanel
            journeyId={journey.id}
            readOnly={isMergedReadOnly}
            onChanged={reloadStatus}
          />
        );
      case 'handover':
        return (
          <FollowUpHandoverPanel
            journeyId={journey.id}
            patientId={journey.patientId}
            patientName={journey.patientName}
            readOnly={isMergedReadOnly}
            onChanged={reloadStatus}
          />
        );
      default:
        return null;
    }
  }

  const canMarkReady =
    !isMergedReadOnly &&
    !['ReadyForDischarge', 'Discharged', 'AdmissionCancelled', 'CancelledSurgery'].includes(journey.clinicalState);

  return (
    <IpOverlayDialog
      onClose={onClose}
      size="6xl"
      title="Post-Op workspace"
      testId={WARD_POSTOP_TEST_IDS.workspace}
      className="max-h-[92vh] h-[92vh]"
    >
      <div className="flex flex-col h-full max-h-[92vh]">
        {/* Header */}
        <div className="ws-head shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="name truncate">{journey.patientName ?? '—'}</span>
              <span className="mono">{journey.uhid ?? '—'}</span>
              <span className="badge inhouse">Post-op</span>
              {journey.clinicalState && (
                <span className="badge">{journey.clinicalState}</span>
              )}
            </div>
            <p className="ident truncate">
              {[journey.procedureName, journey.eyeOperated, journey.admissionType, journey.wardName, journey.bedNumber]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <span className="spacer" />
          <button type="button" onClick={onClose} className="btn sm ghost" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body: step rail + content */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          <aside className="shrink-0 border-b lg:border-b-0 lg:border-r border-gray-100 lg:w-56 p-2 bg-gray-50/50">
            <WardPostOpStepNav
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
            {error && (
              <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>
            )}
            {renderStep()}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3 border-t border-gray-100 shrink-0 bg-white">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="inline-flex h-1.5 w-28 rounded-full bg-gray-200 overflow-hidden">
                <span
                  className={`h-full rounded-full ${progressPct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                  style={{ width: `${progressPct}%` }}
                />
              </span>
              <span>
                Post-op {doneCount} of {POSTOP_STEPS.length}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Marking ready for discharge does <b>not</b> discharge the patient.
              {outstanding.length > 0 && (
                <span className="text-amber-800"> Outstanding: {outstanding.join(', ')}.</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
            {canMarkReady && (
              <button
                type="button"
                onClick={() => void handleMarkReady()}
                disabled={marking}
                data-testid={WARD_POSTOP_TEST_IDS.btnMarkReady}
                className="flex items-center gap-2 px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                {marking ? 'Marking…' : 'Mark ready for discharge'}
              </button>
            )}
          </div>
        </div>
      </div>
    </IpOverlayDialog>
  );
}
