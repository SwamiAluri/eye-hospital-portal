import type { PatientJourneyDetailDto, TransitionRequest } from '@/lib/api/ip-management.api';
import { ipManagementApi } from '@/lib/api/ip-management.api';
import { transitionClinicalWithGates } from '@/lib/ip-checklist/transition-gates';
import { isOtMutationConflict, otMutationError } from './ot-mutation-result';

export type OtCompletePlan =
  | { kind: 'ready'; expectedUpdatedAt: string; journey: PatientJourneyDetailDto }
  | { kind: 'already-complete'; journey: PatientJourneyDetailDto }
  | { kind: 'invalid'; message: string };

const LOAD_FAILED = 'Could not load the current OT journey version. Reload and try again.';
const NO_VERSION = 'The current OT journey version is missing. Reload and try again.';
const NOT_COMPLETABLE = 'This surgery can no longer be completed. The journey was updated. Reload and try again.';

export function planCompleteSurgery(journey: PatientJourneyDetailDto | null): OtCompletePlan {
  if (!journey) return { kind: 'invalid', message: LOAD_FAILED };
  if (journey.clinicalState === 'SurgeryCompleted' || journey.clinicalState === 'PostOp') {
    return { kind: 'already-complete', journey };
  }
  if (journey.clinicalState !== 'InOT') {
    return { kind: 'invalid', message: NOT_COMPLETABLE };
  }
  if (!journey.updatedAt) return { kind: 'invalid', message: NO_VERSION };
  return { kind: 'ready', expectedUpdatedAt: journey.updatedAt, journey };
}

export function planReturnFromOt(journey: PatientJourneyDetailDto | null): OtCompletePlan {
  if (!journey) return { kind: 'invalid', message: LOAD_FAILED };
  if (journey.clinicalState === 'ReadyForSurgery') return { kind: 'already-complete', journey };
  if (journey.clinicalState !== 'SentToOT' && journey.clinicalState !== 'InOT') {
    return { kind: 'invalid', message: 'This patient can no longer be returned from OT. Reload and try again.' };
  }
  if (!journey.updatedAt) return { kind: 'invalid', message: NO_VERSION };
  return { kind: 'ready', expectedUpdatedAt: journey.updatedAt, journey };
}

export function planPostOpMove(journey: PatientJourneyDetailDto | null): OtCompletePlan {
  if (!journey) return { kind: 'invalid', message: LOAD_FAILED };
  if (journey.clinicalState === 'PostOp') return { kind: 'already-complete', journey };
  if (journey.clinicalState !== 'SurgeryCompleted') {
    return { kind: 'invalid', message: 'This patient is not ready to move to post-op. Reload and try again.' };
  }
  if (!journey.updatedAt) return { kind: 'invalid', message: NO_VERSION };
  return { kind: 'ready', expectedUpdatedAt: journey.updatedAt, journey };
}

export type OtVersionedTransitionDeps = {
  getJourneyDetail: (id: string) => Promise<PatientJourneyDetailDto | null>;
  transitionWithGates: (id: string, req: TransitionRequest) => Promise<PatientJourneyDetailDto>;
};

const defaultDeps = (): OtVersionedTransitionDeps => ({
  getJourneyDetail: id => ipManagementApi.getJourneyDetail(id),
  transitionWithGates: transitionClinicalWithGates,
});

async function runVersionedOtTransition(
  journeyId: string,
  newState: string,
  plan: (journey: PatientJourneyDetailDto | null) => OtCompletePlan,
  deps?: OtVersionedTransitionDeps,
  extra?: Pick<TransitionRequest, 'reason' | 'acknowledgeWarnings'>,
): Promise<PatientJourneyDetailDto> {
  const api = deps ?? defaultDeps();
  const firstPlan = plan(await api.getJourneyDetail(journeyId));
  if (firstPlan.kind === 'invalid') throw otMutationError(firstPlan.message);
  if (firstPlan.kind === 'already-complete') return firstPlan.journey;

  const payload = {
    newState,
    expectedUpdatedAt: firstPlan.expectedUpdatedAt,
    ...extra,
  };

  try {
    return await api.transitionWithGates(journeyId, payload);
  } catch (e) {
    if (!isOtMutationConflict(e)) throw e;
    const retryPlan = plan(await api.getJourneyDetail(journeyId));
    if (retryPlan.kind === 'already-complete') return retryPlan.journey;
    if (retryPlan.kind === 'invalid') throw otMutationError(retryPlan.message);
    return await api.transitionWithGates(journeyId, {
      newState,
      expectedUpdatedAt: retryPlan.expectedUpdatedAt,
      ...extra,
    });
  }
}

/** Complete surgery using the authoritative current journey version. One conflict retry. */
export function completeSurgeryWithCurrentVersion(
  journeyId: string,
  deps?: OtVersionedTransitionDeps,
): Promise<PatientJourneyDetailDto> {
  return runVersionedOtTransition(journeyId, 'SurgeryCompleted', planCompleteSurgery, deps);
}

/** OT-board PostOp handoff using the authoritative current journey version. One conflict retry. */
export function moveToPostOpWithCurrentVersion(
  journeyId: string,
  deps?: OtVersionedTransitionDeps,
): Promise<PatientJourneyDetailDto> {
  return runVersionedOtTransition(journeyId, 'PostOp', planPostOpMove, deps);
}

/** Return from OT using the authoritative current journey version. One conflict retry. */
export function returnFromOtWithCurrentVersion(
  journeyId: string,
  reason: string,
  deps?: OtVersionedTransitionDeps,
): Promise<PatientJourneyDetailDto> {
  return runVersionedOtTransition(journeyId, 'ReadyForSurgery', planReturnFromOt, deps, { reason });
}
