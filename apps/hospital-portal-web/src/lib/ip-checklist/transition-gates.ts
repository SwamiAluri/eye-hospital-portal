import {
  ipManagementApi,
  TransitionRequest,
  PatientJourneyDetailDto,
  ChecklistGateWarningDto,
} from '@/lib/api/ip-management.api';

function formatWarnings(warnings: ChecklistGateWarningDto[]): string {
  return warnings.map(w => `• ${w.message}`).join('\n');
}

async function confirmWarnings(warnings: ChecklistGateWarningDto[], prompt: string): Promise<boolean> {
  return window.confirm(`Checklist warnings:\n\n${formatWarnings(warnings)}\n\n${prompt}`);
}

/** Runs clinical transition; prompts user if server returns soft-gate warnings. Hard blocks abort. */
export async function transitionClinicalWithGates(
  journeyId: string,
  req: TransitionRequest,
): Promise<PatientJourneyDetailDto> {
  const first = await ipManagementApi.transitionClinical(journeyId, req);

  const warnings = first.transitionWarnings ?? [];
  const hardBlocks = warnings.filter(w => w.severity === 'block');
  if (hardBlocks.length > 0) {
    const err = new Error(hardBlocks.map(w => w.message).join(' '));
    (err as Error & { warnings: ChecklistGateWarningDto[] }).warnings = hardBlocks;
    throw err;
  }

  if (warnings.length === 0 || req.acknowledgeWarnings) return first;

  const proceed = await confirmWarnings(warnings, 'Proceed anyway?');
  if (!proceed) {
    const err = new Error('Transition cancelled due to checklist warnings');
    (err as Error & { warnings: ChecklistGateWarningDto[] }).warnings = warnings;
    throw err;
  }

  return ipManagementApi.transitionClinical(journeyId, { ...req, acknowledgeWarnings: true });
}

/** Accept patient in OT; soft-warns if Before Anaesthesia checklist is incomplete. */
export async function acceptInOtWithGates(journeyId: string): Promise<PatientJourneyDetailDto> {
  const first = await ipManagementApi.acceptInOT(journeyId);
  const warnings = first.transitionWarnings ?? [];
  if (warnings.length === 0) return first;

  const proceed = await confirmWarnings(warnings, 'Accept into OT anyway?');
  if (!proceed) {
    const err = new Error('Accept cancelled due to checklist warnings');
    (err as Error & { warnings: ChecklistGateWarningDto[] }).warnings = warnings;
    throw err;
  }

  return ipManagementApi.acceptInOT(journeyId, true);
}

/** Start surgery; prompts for WHO timeout warnings (same as legacy startSurgery flow). */
export async function startSurgeryWithGates(journeyId: string): Promise<PatientJourneyDetailDto> {
  const first = await ipManagementApi.startSurgery(journeyId);
  const warnings = first.transitionWarnings ?? [];
  if (warnings.length === 0) return first;

  const proceed = await confirmWarnings(warnings, 'Start surgery anyway?');
  if (!proceed) {
    const err = new Error('Start surgery cancelled due to checklist warnings');
    (err as Error & { warnings: ChecklistGateWarningDto[] }).warnings = warnings;
    throw err;
  }

  return ipManagementApi.startSurgery(journeyId, true);
}
