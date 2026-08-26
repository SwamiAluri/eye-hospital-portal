import type { ChecklistGateResultDto, ChecklistGateWarningDto } from '@/lib/api/ip-management.api';
import type { CareTab, PreOpStepKey } from './preop-steps';
import type { MarkReadyGate, MarkReadyGateResult } from './preop-mark-ready-gates';

/** Maps a ChecklistGateService warning code to the pre-op step that clears it. */
export function navigateStepForGateCode(code: string): PreOpStepKey {
  switch (code) {
    case 'critical_labs_unverified':
    case 'p1_investigation_incomplete':
      return 'investigations';
    case 'surgical_consent_unsigned':
    case 'laterality_not_attested':
    case 'laterality_not_scheduled':
      return 'consent';
    case 'pac_incomplete':
      return 'pac';
    case 'clinical_evaluation_unsigned':
      return 'evaluation';
    case 'med_log_incomplete':
    case 'dilation_not_ready':
    case 'dilation_not_recorded':
      return 'records';
    case 'vitals_out_of_range':
    case 'vitals_not_recorded':
      return 'records';
    default:
      return 'consent';
  }
}

export function careTabForGateCode(code: string): CareTab | undefined {
  if (code === 'dilation_not_ready' || code === 'dilation_not_recorded' || code === 'med_log_incomplete') {
    return 'medLog';
  }
  if (code === 'vitals_out_of_range' || code === 'vitals_not_recorded') {
    return 'vitals';
  }
  return undefined;
}

function warningToGate(warning: ChecklistGateWarningDto): MarkReadyGate {
  return {
    code: warning.code,
    message: warning.message,
    severity: warning.severity,
    navigateStep: navigateStepForGateCode(warning.code),
    careTab: careTabForGateCode(warning.code),
  };
}

/**
 * Maps `GET /transition-gates?newState=ReadyForSurgery` onto the same
 * `MarkReadyGateResult` the workspace footer already renders.
 */
export function mapTransitionGatesToMarkReady(
  dto: ChecklistGateResultDto | null | undefined,
  fallbackMessage = 'Cannot mark ready for surgery yet.',
): MarkReadyGateResult | null {
  if (!dto) return null;

  const warnings = dto.warnings ?? [];
  const hardBlocks: MarkReadyGate[] = [];
  const softWarnings: MarkReadyGate[] = [];

  for (const warning of warnings) {
    const gate = warningToGate(warning);
    if (warning.severity === 'block') hardBlocks.push(gate);
    else softWarnings.push(gate);
  }

  if (hardBlocks.length === 0 && !dto.canProceed && warnings.length === 0) {
            hardBlocks.push({
      code: 'transition_blocked',
      message: fallbackMessage,
      severity: 'block',
      navigateStep: 'consent',
    });
  }

  return {
    hardBlocks,
    softWarnings,
    canMarkReady: hardBlocks.length === 0,
  };
}

/** Server transition-gates are authority for messages; union hard blocks so the footer stays fail-closed. */
export function mergeMarkReadyGates(
  client: MarkReadyGateResult,
  server: MarkReadyGateResult | null,
): MarkReadyGateResult {
  if (!server) return client;
  const hardByCode = new Map(client.hardBlocks.map(b => [b.code, b]));
  for (const block of server.hardBlocks) hardByCode.set(block.code, block);
  const seenSoft = new Set<string>();
  const softWarnings: MarkReadyGate[] = [];
  for (const warning of [...server.softWarnings, ...client.softWarnings]) {
    if (seenSoft.has(warning.code)) continue;
    seenSoft.add(warning.code);
    softWarnings.push(warning);
  }
  const hardBlocks = [...hardByCode.values()];
  return {
    hardBlocks,
    softWarnings,
    canMarkReady: hardBlocks.length === 0,
  };
}
