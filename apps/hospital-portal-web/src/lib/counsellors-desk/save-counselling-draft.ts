import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import { counsellingAzureApi } from '@/lib/api/counselling-azure.api';
import { getApiErrorMessage } from '@/lib/auth-interceptors';
import { buildCounsellingSessionPayload } from '@/lib/counsellors-desk/save-counselling-session';
import type { SaveCounsellingSessionParams } from '@/lib/counsellors-desk/save-counselling-session';
import {
  getSessionConcurrencyMessage,
  isSessionConcurrencyConflict,
} from '@/lib/counsellors-desk/session-concurrency';
import { shouldRetryDraftSaveAfterVersionSync } from '@/lib/counsellors-desk/sync-counselling-session-version';

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
  /** `version` is the bumped CounselingSession.Version from the save response (Phase 3I Slice 7). */
  onSuccess: (snapshot: Record<string, string>, version?: number) => void;
  /** Phase 3I — patch local Version after a 409 refetch (preserve dirty form). */
  onConcurrencyVersionSync?: (version?: number) => void;
};

/** Persist counselling progress without queue transition or completeSession. */
export async function saveCounsellingDraft(params: SaveCounsellingDraftParams): Promise<void> {
  const {
    sessionId,
    session,
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
    onConcurrencyVersionSync,
    invalidateSession,
  } = params;

  const { payload, currentSnapshot, fieldChanges } = buildCounsellingSessionPayload(params);
  const fieldChangesPayload = fieldChanges.length > 0 ? fieldChanges : undefined;

  const putSession = (version: number | undefined) =>
    counsellorsDeskApi.saveSession(sessionId, {
      ...payload,
      version,
      fieldChanges: fieldChangesPayload,
    } as Parameters<typeof counsellorsDeskApi.saveSession>[1]);

  let requestVersion = session.version;
  let saveResult: { version?: number };
  try {
    saveResult = await putSession(requestVersion);
  } catch (err) {
    // Phase 3I Slice 7 (PD-S7-06): stop on true multi-writer conflict.
    // One Version-authority retry is allowed when Insurance/CCMS (or another system writer)
    // advanced CounselingSession.Version while this same counsellor still holds a dirty form —
    // that is not "another user"; retry with the authoritative Version, never overwrite blindly.
    if (isSessionConcurrencyConflict(err)) {
      invalidateSession(sessionId);
      let freshVersion: number | undefined;
      try {
        const fresh = await counsellorsDeskApi.getSession(sessionId, { skipCatalogFallback: true });
        freshVersion = fresh.version;
        onConcurrencyVersionSync?.(freshVersion);
      } catch {
        /* best-effort Version sync only */
      }

      if (shouldRetryDraftSaveAfterVersionSync({ requestVersion, freshVersion })) {
        try {
          requestVersion = freshVersion;
          saveResult = await putSession(freshVersion);
        } catch (retryErr) {
          if (isSessionConcurrencyConflict(retryErr)) {
            invalidateSession(sessionId);
            try {
              const freshAgain = await counsellorsDeskApi.getSession(sessionId, {
                skipCatalogFallback: true,
              });
              onConcurrencyVersionSync?.(freshAgain.version);
            } catch {
              /* best-effort */
            }
            throw new Error(getSessionConcurrencyMessage(retryErr));
          }
          throw new Error(`Session: ${getApiErrorMessage(retryErr, 'Could not save session')}`);
        }
      } else {
        throw new Error(getSessionConcurrencyMessage(err));
      }
    } else {
      throw new Error(`Session: ${getApiErrorMessage(err, 'Could not save session')}`);
    }
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

  onSuccess(currentSnapshot, saveResult.version);
  invalidateSession(sessionId);
}
