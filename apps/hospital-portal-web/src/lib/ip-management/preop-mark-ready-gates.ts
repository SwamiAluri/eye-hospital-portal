import type {
  PacAssessmentDto,
  PreOpClearanceDetailDto,
  WardInvestigationChecklistDto,
} from '@/lib/api/ip-management.api';
import type { PreOpStepKey } from './preop-steps';
import { isLateralityAttested, lateralityBlockMessage, normalizeOperativeEye } from './preop-laterality';

export interface MarkReadyGate {
  code: string;
  message: string;
  severity: 'warn' | 'block';
  navigateStep: PreOpStepKey;
}

export interface MarkReadyGateResult {
  hardBlocks: MarkReadyGate[];
  softWarnings: MarkReadyGate[];
  /** True when no hard blocks remain for Admitted → ReadyForSurgery. */
  canMarkReady: boolean;
}

const SURGICAL_CONSENT_KEY = 'surgery_consent_signed';

export function computeMarkReadyGates(input: {
  investigation?: WardInvestigationChecklistDto | null;
  pac?: PacAssessmentDto | null;
  detail?: PreOpClearanceDetailDto | null;
  scheduledEye?: string | null;
}): MarkReadyGateResult {
  const hardBlocks: MarkReadyGate[] = [];
  const softWarnings: MarkReadyGate[] = [];
  const completions = input.detail?.completions ?? [];

  const unverified = input.investigation?.unverifiedCriticalKeys ?? [];
  if (unverified.length > 0) {
    hardBlocks.push({
      code: 'critical_labs_unverified',
      message:
        unverified.length === 1
          ? `Critical lab not ward-verified: ${unverified[0].replace(/_/g, ' ')}.`
          : `${unverified.length} critical labs are not ward-verified.`,
      severity: 'block',
      navigateStep: 'investigations',
    });
  }

  const consent = completions.find(c => c.itemKey === SURGICAL_CONSENT_KEY);
  if (!consent?.isCompleted && !consent?.isBypassed) {
    hardBlocks.push({
      code: 'surgical_consent_unsigned',
      message: 'Surgical consent must be signed with the consent PDF on file.',
      severity: 'block',
      navigateStep: 'consent',
    });
  }

  const scheduled = normalizeOperativeEye(input.scheduledEye);
  if (!scheduled) {
    hardBlocks.push({
      code: 'laterality_not_scheduled',
      message: lateralityBlockMessage(input.scheduledEye),
      severity: 'block',
      navigateStep: 'consent',
    });
  } else if (!isLateralityAttested(completions, input.scheduledEye)) {
    hardBlocks.push({
      code: 'laterality_not_attested',
      message: lateralityBlockMessage(input.scheduledEye),
      severity: 'block',
      navigateStep: 'consent',
    });
  }

  const pacDone = input.pac?.assessmentStatus === 'Completed';
  if (!pacDone) {
    hardBlocks.push({
      code: 'pac_incomplete',
      message: 'PAC assessment must be completed before marking ready for surgery.',
      severity: 'block',
      navigateStep: 'anaesthesia',
    });
  }

  return {
    hardBlocks,
    softWarnings,
    canMarkReady: hardBlocks.length === 0,
  };
}
