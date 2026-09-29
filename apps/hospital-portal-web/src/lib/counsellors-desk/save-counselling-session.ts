import { toast } from 'react-hot-toast';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import { counsellingAzureApi, mapDecision } from '@/lib/api/counselling-azure.api';
import { getApiErrorMessage } from '@/lib/auth-interceptors';
import { COVERAGE_PAYMENT_TYPES, toCounsellingDateOnly } from '@/lib/counsellors-desk/session-utils';
import { buildCounsellingFieldSnapshot } from '@/lib/counsellors-desk/counselling-field-snapshot';
import { mergeEstimateIntoBlob } from '@/lib/counsellors-desk/package-addons-blob';
import {
  getSessionConcurrencyMessage,
  isSessionConcurrencyConflict,
} from '@/lib/counsellors-desk/session-concurrency';
import { resolveVersionAfterSave } from '@/lib/counsellors-desk/session-version-authority';
import type { CounsellingEstimateState } from '@/types/counselling-estimate';
import type {
  CombinedPaymentType,
  CounsellingSession,
  DecisionType,
  InvestigationItem,
  ScheduleData,
  WaitingListStatus,
} from '@/types/counsellors-desk';

/** OT Finalize handoff is required when agreeing to surgery with a scheduled date (not package-upgrade-only). */
export function isOtScheduleRequiredForSave(params: {
  isPackageUpgrade: boolean;
  selectedDate?: string | null;
  decision: DecisionType | '';
}): boolean {
  return (
    !params.isPackageUpgrade &&
    !!params.selectedDate &&
    (params.decision === 'DateForSurgery' || params.decision === 'Interested')
  );
}

/**
 * An OT Finalize slot is only written when both theatre and start time were captured.
 * A counselling date and doctor without those fields stays a surgery plan, not a booking.
 */
export function hasCompleteCounsellingOtSlot(
  schedule: Pick<ScheduleData, 'operationTheatre' | 'surgeryStartTime'> | null | undefined,
): boolean {
  return Boolean(schedule?.operationTheatre?.trim() && schedule.surgeryStartTime?.trim());
}

/** User-facing message when counselling session persisted but OT schedule did not. */
export function buildOtHandoffFailureMessage(error: unknown): string {
  const detail = getApiErrorMessage(error, '');
  const base =
    'Counselling details were saved, but the OT schedule could not be saved. Retry save or verify the patient on Finalize Surgery.';
  if (!detail || detail === 'Request failed') return base;
  return `${base} (${detail})`;
}

/** User-facing message when session persisted but queue complete/add-on failed (CS-01). */
export function buildQueueTransitionFailureMessage(
  error: unknown,
  kind: 'complete' | 'addon',
): string {
  const detail = getApiErrorMessage(error, '');
  const action =
    kind === 'addon'
      ? 'add-on surgery queue status'
      : 'session completion / waiting-list status';
  const base = `Counselling details were saved, but the ${action} could not be updated. Retry save or refresh the Waiting List.`;
  if (!detail || detail === 'Request failed') return base;
  return `${base} (${detail})`;
}

export interface SaveCounsellingSessionParams {
  sessionId: string;
  session: CounsellingSession;
  selectedSurgeryId: string | null;
  selectedVariantId: string | null;
  selectedEye: 'RE' | 'LE' | 'BE';
  selectedIolId: string | null;
  variantSubOption: string | null;
  packageName: string;
  packageRate: number | '';
  paymentType: CombinedPaymentType | '';
  insuranceCompany: string;
  insuranceProviderId?: string;
  freeSurgeryReason: string;
  decision: DecisionType;
  followUpReason: string;
  followUpDate: string;
  counsellorNotes: string;
  patientRemarks: string;
  doctorNotes: string;
  wantToSeeDoctor: boolean;
  interestedToUpgrade: boolean;
  notRequiredPreAuth: boolean;
  schedule: ScheduleData | null;
  selectedInvestigations: Map<string, InvestigationItem>;
  mergedEstimate: CounsellingEstimateState;
  savedSnapshot: Record<string, string>;
  isDoneState: boolean;
  existingOtScheduleId: string | null;
  onSuccess: (next: {
    snapshot: Record<string, string>;
    queueStatus: WaitingListStatus;
    openCoverageTab: boolean;
    /** Bumped CounselingSession.Version after save (+ complete/addon, when applicable) — Phase 3I Slice 7. */
    version?: number;
  }) => void;
  /** Phase 3I — patch local Version after a 409 refetch (preserve dirty form; no auto-retry). */
  onConcurrencyVersionSync?: (version?: number) => void;
  invalidateWaitingList: () => void;
  invalidateSession: (id: string) => void;
}

type CounsellingPersistenceInput = Pick<
  SaveCounsellingSessionParams,
  | 'paymentType'
  | 'insuranceCompany'
  | 'decision'
  | 'followUpReason'
  | 'followUpDate'
  | 'counsellorNotes'
  | 'patientRemarks'
  | 'doctorNotes'
  | 'wantToSeeDoctor'
  | 'interestedToUpgrade'
  | 'notRequiredPreAuth'
  | 'selectedSurgeryId'
  | 'selectedEye'
  | 'packageName'
  | 'packageRate'
  | 'schedule'
  | 'mergedEstimate'
  | 'savedSnapshot'
  | 'sessionId'
  | 'selectedVariantId'
  | 'selectedIolId'
  | 'variantSubOption'
  | 'insuranceProviderId'
  | 'freeSurgeryReason'
  | 'isDoneState'
>;

export function buildCounsellingSessionPayload(params: CounsellingPersistenceInput) {
  const {
    paymentType,
    insuranceCompany,
    decision,
    followUpReason,
    followUpDate,
    counsellorNotes,
    patientRemarks,
    doctorNotes,
    wantToSeeDoctor,
    interestedToUpgrade,
    notRequiredPreAuth,
    selectedSurgeryId,
    selectedEye,
    packageName,
    packageRate,
    schedule,
    mergedEstimate,
    savedSnapshot,
    selectedVariantId,
    insuranceProviderId,
    freeSurgeryReason,
    isDoneState,
  } = params;

  const normalizedSchedule = schedule
    ? { ...schedule, selectedDate: toCounsellingDateOnly(schedule.selectedDate) }
    : null;

  const currentSnapshot = buildCounsellingFieldSnapshot({
    paymentType,
    insuranceCompany,
    decision,
    followUpReason,
    followUpDate,
    counsellorNotes,
    patientRemarks,
    doctorNotes,
    wantToSeeDoctor,
    interestedToUpgrade,
    notRequiredPreAuth,
    selectedSurgeryId,
    selectedEye,
    packageName,
    packageRate,
    scheduleDate: normalizedSchedule?.selectedDate ?? '',
    mergedEstimate,
  });

  const fieldChanges = Object.entries(currentSnapshot)
    .filter(
      ([key, val]) => savedSnapshot[key] !== undefined && savedSnapshot[key] !== val,
    )
    .map(([fieldName, newValue]) => ({
      fieldName,
      oldValue: savedSnapshot[fieldName] ?? '',
      newValue,
    }));

  const agreedToSurgery = decision === 'DateForSurgery' || decision === 'Interested';
  const isPackageUpgrade =
    isDoneState &&
    (packageName !== savedSnapshot.packageName ||
      String(packageRate) !== savedSnapshot.packageRate);

  const prevPackageName = savedSnapshot.packageName || undefined;
  const prevPackageAmount = savedSnapshot.packageRate
    ? Number(savedSnapshot.packageRate)
    : undefined;

  const payload = {
    packageAddonsJson: JSON.stringify(
      mergeEstimateIntoBlob(
        {
          selectedSurgeryId: selectedSurgeryId ?? undefined,
          packageName,
          variantId: selectedVariantId ?? undefined,
          eye: selectedEye,
          decision: decision || undefined,
          paymentType: paymentType || undefined,
          insuranceCompany: insuranceCompany || undefined,
          ...(insuranceProviderId && { insuranceProviderId }),
          rate:
            mergedEstimate.finalPayableAmount > 0
              ? mergedEstimate.finalPayableAmount
              : typeof packageRate === 'number'
                ? packageRate
                : undefined,
          ...(followUpDate && { followUpDate }),
          ...(normalizedSchedule && { schedule: normalizedSchedule }),
          ...(patientRemarks && { patientRemarks }),
          ...(doctorNotes && { doctorNotes }),
          wantToSeeDoctor,
          interestedToUpgrade,
          notRequiredPreAuth,
          ...(isPackageUpgrade && prevPackageName && { previousPackageName: prevPackageName }),
          ...(isPackageUpgrade && prevPackageAmount && { previousPackageAmount: prevPackageAmount }),
          ...(params.selectedIolId && { selectedIolId: params.selectedIolId }),
          ...(params.variantSubOption && { variantSubOption: params.variantSubOption }),
        },
        mergedEstimate,
      ),
    ),
    patientAgreedToSurgery: agreedToSurgery,
    pendingDecision: decision === 'NeedsTime',
    reasonsForDelay: followUpReason || undefined,
    decisionDate: followUpDate || undefined,
    surgeryTentativeDate: normalizedSchedule?.selectedDate || undefined,
    surgeryTentativeTimeSlot: normalizedSchedule?.surgeryStartTime || undefined,
    surgeryTentativeEye: selectedEye || undefined,
    packageAmount:
      mergedEstimate.finalPayableAmount > 0
        ? mergedEstimate.finalPayableAmount
        : typeof packageRate === 'number' && packageRate > 0
          ? packageRate
          : undefined,
    additionalNotes: counsellorNotes || undefined,
    patientType: (
      ['Cash', 'Insurance', 'CoPay', 'ESH', 'CGHS', 'Arograshree', 'SGHS', 'Camp'] as string[]
    ).includes(paymentType ?? '')
      ? (paymentType as string)
      : undefined,
    freeSurgeryReason,
    variantSubOption: params.variantSubOption,
    company: insuranceCompany,
    isFollowUpRequired: decision === 'NotInterested' || decision === 'NeedsTime',
  };

  return { payload, currentSnapshot, fieldChanges, agreedToSurgery, isPackageUpgrade, prevPackageName, prevPackageAmount };
}

export async function saveCounsellingSession(params: SaveCounsellingSessionParams): Promise<void> {
  const {
    sessionId,
    session,
    selectedSurgeryId,
    selectedVariantId,
    selectedEye,
    packageName,
    packageRate,
    paymentType,
    insuranceCompany,
    insuranceProviderId,
    freeSurgeryReason,
    decision,
    followUpReason,
    followUpDate,
    counsellorNotes,
    patientRemarks,
    doctorNotes,
    wantToSeeDoctor,
    interestedToUpgrade,
    notRequiredPreAuth,
    selectedInvestigations,
    mergedEstimate,
    savedSnapshot,
    isDoneState,
    existingOtScheduleId,
    onSuccess,
    onConcurrencyVersionSync,
    invalidateWaitingList,
    invalidateSession,
  } = params;

  const schedule = params.schedule
    ? { ...params.schedule, selectedDate: toCounsellingDateOnly(params.schedule.selectedDate) }
    : null;

  const { payload, currentSnapshot, fieldChanges, isPackageUpgrade, prevPackageName, prevPackageAmount } =
    buildCounsellingSessionPayload({ ...params, schedule });

  const expectedVersion = session.version;

  let saveResult: { version?: number };
  try {
    saveResult = await counsellorsDeskApi.saveSession(sessionId, {
      ...payload,
      version: expectedVersion,
      fieldChanges: fieldChanges.length > 0 ? fieldChanges : undefined,
    } as unknown as CounsellingSession);
  } catch (err) {
    // Phase 3I Slice 7 (PD-S7-06): stop on 409 — never overwrite; no auto-retry.
    if (isSessionConcurrencyConflict(err)) {
      invalidateSession(sessionId);
      try {
        const fresh = await counsellorsDeskApi.getSession(sessionId, { skipCatalogFallback: true });
        onConcurrencyVersionSync?.(fresh.version);
      } catch {
        /* best-effort Version sync only */
      }
      throw new Error(getSessionConcurrencyMessage(err));
    }
    throw err;
  }
  // Version after this save — Complete must use this, never the Version sent on Save.
  let currentVersion = resolveVersionAfterSave({
    responseVersion: saveResult.version,
    requestVersion: expectedVersion,
  });

  if (selectedInvestigations.size > 0) {
    await counsellorsDeskApi.saveInvestigations(
      sessionId,
      Array.from(selectedInvestigations.values()),
    );
  }

  const otRequired = isOtScheduleRequiredForSave({
    isPackageUpgrade,
    selectedDate: schedule?.selectedDate,
    decision,
  });

  // FS-01: a complete OT slot must succeed before complete/success UI.
  // Date + doctor without theatre and start time is a counselling plan only.
  if (otRequired && schedule && hasCompleteCounsellingOtSlot(schedule)) {
    try {
      const startTimeIso = schedule.surgeryStartTime
        ? `${schedule.selectedDate}T${schedule.surgeryStartTime}:00`
        : schedule.selectedDate;
      if (isDoneState && existingOtScheduleId) {
        await counsellorsDeskApi.editOtScheduleSlot(existingOtScheduleId, {
          doctorName: schedule.doctor || '',
          theatreName: schedule.operationTheatre || '',
          startTime: startTimeIso,
        });
      } else {
        await counsellorsDeskApi.upsertOtSchedule({
          patientId: session.patientId,
          uhid: session.uhid,
          patientName: session.patientName,
          surgeryName:
            session?.surgeries?.find((s) => s.id === selectedSurgeryId)?.surgeryName ||
            session?.surgeries?.find((s) => s.isRecommended)?.surgeryName ||
            packageName ||
            '',
          eyes: selectedEye,
          patientType: paymentType || '',
          paymentMode: paymentType || '',
          surgeon: schedule.doctor || '',
          startTime: startTimeIso,
          theaterName: schedule.operationTheatre || '',
          packageName: packageName || '',
          packageRate: typeof packageRate === 'number' ? packageRate : undefined,
          counsellingSessionId: sessionId,
        });
      }
    } catch (otErr) {
      throw new Error(buildOtHandoffFailureMessage(otErr));
    }
  }

  // CS-01: queue complete / add-on is required for Waiting List Done status — await + propagate.
  try {
    if (isPackageUpgrade) {
      // markAddOnSurgery mutates the queue item only — not a CounselingSession.Version writer (Class C).
      await counsellorsDeskApi.markAddOnSurgery(sessionId);
    } else {
      const completeResult = await counsellorsDeskApi.completeSession(sessionId, currentVersion);
      currentVersion = completeResult.version ?? currentVersion;
    }
  } catch (queueErr) {
    // Phase 3I Slice 7 (PD-S7-06): stop on 409 — never overwrite; no auto-retry. Content is already
    // persisted at this point, so use the same "saved, but…" partial-failure copy as other queue errors.
    if (isSessionConcurrencyConflict(queueErr)) {
      invalidateSession(sessionId);
      try {
        const fresh = await counsellorsDeskApi.getSession(sessionId, { skipCatalogFallback: true });
        onConcurrencyVersionSync?.(fresh.version);
      } catch {
        /* best-effort Version sync only */
      }
      throw new Error(
        `Counselling details were saved, but completion could not be confirmed: ${getSessionConcurrencyMessage(queueErr)}`,
      );
    }
    throw new Error(
      buildQueueTransitionFailureMessage(queueErr, isPackageUpgrade ? 'addon' : 'complete'),
    );
  }

  // CounsellingApi Azure Functions — best-effort secondary sync (OPTIONAL). Offline must not block.
  if (decision) {
    const mappedDecision = mapDecision(decision);
    if (decision === 'NeedsTime') {
      counsellingAzureApi.decision(
        sessionId,
        'NeedsTime',
        undefined,
        followUpDate || undefined,
        followUpReason || undefined,
      );
    } else {
      counsellingAzureApi.decision(
        sessionId,
        mappedDecision,
        undefined,
        followUpDate || undefined,
        followUpReason || undefined,
      );
    }
  }

  if (schedule?.selectedDate) {
    counsellingAzureApi.schedule(sessionId, schedule.selectedDate);
  }

  if (isPackageUpgrade) {
    counsellingAzureApi.addOnSurgery(sessionId, 'Package upgraded');
  }

  counsellingAzureApi.save(sessionId, {
    packageDetails: JSON.stringify({
      name: packageName,
      rate:
        mergedEstimate.finalPayableAmount > 0
          ? mergedEstimate.finalPayableAmount
          : typeof packageRate === 'number' && packageRate > 0
            ? packageRate
            : undefined,
      paymentType,
      insuranceCompany,
      variantId: selectedVariantId,
      eye: selectedEye,
      ...(params.selectedIolId ? { selectedIolId: params.selectedIolId } : {}),
      ...(params.variantSubOption ? { variantSubOption: params.variantSubOption } : {}),
    }),
    paymentType: paymentType || undefined,
    insuranceCompany: insuranceCompany || undefined,
  });

  const nextStatus: WaitingListStatus = isPackageUpgrade
    ? 'AddOnSurgery'
    : decision === 'NotInterested' || decision === 'NeedsTime'
      ? 'RepeatCounselling'
      : 'Done';

  const openCoverageTab =
    COVERAGE_PAYMENT_TYPES.includes(paymentType as (typeof COVERAGE_PAYMENT_TYPES)[number]) &&
    !notRequiredPreAuth;

  onSuccess({ snapshot: currentSnapshot, queueStatus: nextStatus, openCoverageTab, version: currentVersion });
  invalidateWaitingList();
  invalidateSession(sessionId);
  toast.success('Session completed successfully');
}
