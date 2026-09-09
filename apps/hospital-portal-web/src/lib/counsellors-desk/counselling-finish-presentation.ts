import type { EstimateLine } from '@/lib/counsellors-desk/estimate-engine';
import {
  formatCounsellorCoverageStatus,
  type CoverageProgressSnapshot,
} from '@/lib/counsellors-desk/session-status-summary';
import type { WaitingListStatus } from '@/types/counsellors-desk';

/** Patient-facing next steps derived only from persisted counselling state. */
export function buildFinishPatientNextSteps(args: {
  queueStatus: WaitingListStatus;
  scheduleSummary: string | null;
  showCoverageWorkflow: boolean;
  coverageLabel: string;
  preAuthSubmitted: boolean;
  docsIncomplete: boolean;
}): string[] {
  const steps: string[] = [];

  if (args.scheduleSummary) {
    steps.push(`Surgery scheduled: ${args.scheduleSummary}`);
  }

  if (args.queueStatus === 'RepeatCounselling') {
    steps.push('Return for repeat counselling when advised by the counselling desk.');
  }

  if (args.queueStatus === 'AddOnSurgery') {
    steps.push('Additional counselling for the upgraded package may be required.');
  }

  if (args.showCoverageWorkflow) {
    if (args.docsIncomplete) {
      steps.push('Complete any remaining insurance documents with the counselling desk.');
    }
    if (args.preAuthSubmitted || /waiting|tpa|submitted|sent|approval/i.test(args.coverageLabel)) {
      steps.push(`Insurance / pre-authorization: ${args.coverageLabel}`);
    } else if (args.coverageLabel && args.coverageLabel !== 'Not started') {
      steps.push(`Coverage status: ${args.coverageLabel}`);
    }
  }

  if (steps.length === 0) {
    steps.push('Contact the counselling desk for any questions about this estimate.');
  }

  return steps;
}

export function resolveFinishCoverageLabel(args: {
  showCoverageWorkflow: boolean;
  notRequiredPreAuth: boolean;
  coverageProgress: CoverageProgressSnapshot;
}): string {
  return formatCounsellorCoverageStatus({
    showCoverageWorkflow: args.showCoverageWorkflow,
    notRequiredPreAuth: args.notRequiredPreAuth,
    ccmsState: args.coverageProgress.ccmsState,
    preAuthSubmitted: args.coverageProgress.preAuthSubmitted,
  }).label;
}

/** Aggregate persisted estimate lines for Finish / print financial summary (no recalculation). */
export function summarizeEstimateAmounts(lines: EstimateLine[]): {
  procedureAmount: number;
  investigationAmount: number;
  otherAmount: number;
} {
  let procedureAmount = 0;
  let investigationAmount = 0;
  let otherAmount = 0;

  for (const line of lines) {
    if (line.kind === 'procedure' || line.kind === 'iol' || line.kind === 'subOption') {
      procedureAmount += line.amount;
    } else if (line.kind === 'investigation') {
      investigationAmount += line.amount;
    } else {
      otherAmount += line.amount;
    }
  }

  return { procedureAmount, investigationAmount, otherAmount };
}

export function eyeDisplayLabel(eye: 'RE' | 'LE' | 'BE' | string | null | undefined): string {
  if (!eye) return '—';
  if (eye === 'BE') return 'Both eyes';
  if (eye === 'RE') return 'Right eye';
  if (eye === 'LE') return 'Left eye';
  return eye;
}
