import { toast } from 'react-hot-toast';
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import { counsellingAzureApi, mapDecision } from '@/lib/api/counselling-azure.api';
import { COVERAGE_PAYMENT_TYPES } from '@/lib/counsellors-desk/session-utils';
import { buildCounsellingFieldSnapshot } from '@/lib/counsellors-desk/counselling-field-snapshot';
import { mergeEstimateIntoBlob } from '@/lib/counsellors-desk/package-addons-blob';
import type { CounsellingEstimateState } from '@/types/counselling-estimate';
import type {
  CombinedPaymentType,
  CounsellingSession,
  DecisionType,
  InvestigationItem,
  ScheduleData,
  WaitingListStatus,
} from '@/types/counsellors-desk';

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
  }) => void;
  invalidateWaitingList: () => void;
  invalidateSession: (id: string) => void;
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
    schedule,
    selectedInvestigations,
    mergedEstimate,
    savedSnapshot,
    isDoneState,
    existingOtScheduleId,
    onSuccess,
    invalidateWaitingList,
    invalidateSession,
  } = params;

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
    scheduleDate: schedule?.selectedDate ?? '',
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

  await counsellorsDeskApi.saveSession(sessionId, {
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
          rate: typeof packageRate === 'number' ? packageRate : undefined,
          ...(followUpDate && { followUpDate }),
          ...(schedule && { schedule }),
          ...(patientRemarks && { patientRemarks }),
          ...(doctorNotes && { doctorNotes }),
          wantToSeeDoctor,
          interestedToUpgrade,
          notRequiredPreAuth,
          ...(isPackageUpgrade && prevPackageName && { previousPackageName: prevPackageName }),
          ...(isPackageUpgrade && prevPackageAmount && { previousPackageAmount: prevPackageAmount }),
        },
        mergedEstimate,
      ),
    ),
    patientAgreedToSurgery: agreedToSurgery,
    pendingDecision: decision === 'NeedsTime',
    reasonsForDelay: followUpReason || undefined,
    decisionDate: followUpDate || undefined,
    surgeryTentativeDate: schedule?.selectedDate || undefined,
    surgeryTentativeTimeSlot: schedule?.surgeryStartTime || undefined,
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
    fieldChanges: fieldChanges.length > 0 ? fieldChanges : undefined,
  } as unknown as CounsellingSession);

  if (selectedInvestigations.size > 0) {
    await counsellorsDeskApi.saveInvestigations(
      sessionId,
      Array.from(selectedInvestigations.values()),
    );
  }

  if (isPackageUpgrade) {
    counsellorsDeskApi.markAddOnSurgery(sessionId);
  } else {
    counsellorsDeskApi.completeSession(sessionId);
  }

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
    }),
    paymentType: paymentType || undefined,
    insuranceCompany: insuranceCompany || undefined,
  });

  if (
    !isPackageUpgrade &&
    schedule?.selectedDate &&
    (decision === 'DateForSurgery' || decision === 'Interested')
  ) {
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
    } catch {
      /* non-fatal */
    }
  }

  const nextStatus: WaitingListStatus = isPackageUpgrade
    ? 'AddOnSurgery'
    : decision === 'NotInterested' || decision === 'NeedsTime'
      ? 'RepeatCounselling'
      : 'Done';

  const openCoverageTab =
    COVERAGE_PAYMENT_TYPES.includes(paymentType as (typeof COVERAGE_PAYMENT_TYPES)[number]) &&
    !notRequiredPreAuth;

  onSuccess({ snapshot: currentSnapshot, queueStatus: nextStatus, openCoverageTab });
  invalidateWaitingList();
  invalidateSession(sessionId);
  toast.success('Session saved successfully');
}
