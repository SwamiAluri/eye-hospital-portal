import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import { counsellingAzureApi } from '@/lib/api/counselling-azure.api';
import { getApiErrorMessage } from '@/lib/auth-interceptors';
import { buildCounsellingSessionPayload } from '@/lib/counsellors-desk/save-counselling-session';
import type { SaveCounsellingSessionParams } from '@/lib/counsellors-desk/save-counselling-session';

export type SaveCounsellingDraftParams = Pick<
  SaveCounsellingSessionParams,
  | 'sessionId'
  | 'session'
  | 'selectedSurgeryId'
  | 'selectedVariantId'
  | 'selectedEye'
  | 'selectedIolId'
  | 'variantSubOption'
  | 'packageName'
  | 'packageRate'
  | 'paymentType'
  | 'insuranceCompany'
  | 'insuranceProviderId'
  | 'freeSurgeryReason'
  | 'decision'
  | 'followUpReason'
  | 'followUpDate'
  | 'counsellorNotes'
  | 'patientRemarks'
  | 'doctorNotes'
  | 'wantToSeeDoctor'
  | 'interestedToUpgrade'
  | 'notRequiredPreAuth'
  | 'schedule'
  | 'selectedInvestigations'
  | 'mergedEstimate'
  | 'savedSnapshot'
  | 'isDoneState'
  | 'invalidateSession'
> & {
  onSuccess: (snapshot: Record<string, string>) => void;
};

/** Persist counselling progress without queue transition or completeSession. */
export async function saveCounsellingDraft(params: SaveCounsellingDraftParams): Promise<void> {
  const {
    sessionId,
    selectedVariantId,
    selectedEye,
    packageName,
    packageRate,
    paymentType,
    insuranceCompany,
    decision,
    followUpReason,
    followUpDate,
    selectedInvestigations,
    mergedEstimate,
    onSuccess,
    invalidateSession,
  } = params;

  const { payload, currentSnapshot, fieldChanges } = buildCounsellingSessionPayload(params);

  try {
    await counsellorsDeskApi.saveSession(sessionId, {
      ...payload,
      fieldChanges: fieldChanges.length > 0 ? fieldChanges : undefined,
    } as Parameters<typeof counsellorsDeskApi.saveSession>[1]);
  } catch (err) {
    throw new Error(`Session: ${getApiErrorMessage(err, 'Could not save session')}`);
  }

  if (selectedInvestigations.size > 0) {
    try {
      await counsellorsDeskApi.saveInvestigations(
        sessionId,
        Array.from(selectedInvestigations.values()),
      );
    } catch (err) {
      throw new Error(`Investigations: ${getApiErrorMessage(err, 'Could not save investigations')}`);
    }
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
    ...(decision === 'NeedsTime' && followUpDate ? { followUpDate } : {}),
    ...(decision === 'NeedsTime' && followUpReason ? { followUpReason } : {}),
  });

  onSuccess(currentSnapshot);
  invalidateSession(sessionId);
}
