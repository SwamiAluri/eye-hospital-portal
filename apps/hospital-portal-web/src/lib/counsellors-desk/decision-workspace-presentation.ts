import { clarifyPhaseAdvanceHint } from '@/lib/counsellors-desk/counselling-action-hints';
import {
  isPhaseComplete,
  validateDecisionPhase,
  type CounsellingPhaseInput,
  type CounsellingPhaseValidationContext,
} from '@/lib/counsellors-desk/counselling-progress';
import { formatDecisionLabel } from '@/lib/counsellors-desk/session-status-summary';
import { formatTime, formatCounsellingDateDisplay } from '@/lib/counsellors-desk/session-utils';
import type { DecisionType, ScheduleData } from '@/types/counsellors-desk';

/** Concise inline blocker aligned with Action Bar phase-advance hints. */
export function resolveDecisionPhaseBlocker(input: CounsellingPhaseInput): string | null {
  const error = validateDecisionPhase(input);
  if (!error) return null;
  return clarifyPhaseAdvanceHint(error);
}

export function isDecisionPhaseComplete(
  ctx: CounsellingPhaseValidationContext,
): boolean {
  return isPhaseComplete('decision', ctx);
}

export function formatScheduleSummary(schedule: ScheduleData | null): string | null {
  if (!schedule) return null;
  const date = formatCounsellingDateDisplay(schedule.selectedDate);
  const time = schedule.surgeryStartTime ? formatTime(schedule.surgeryStartTime) : null;
  const parts = [date, time, schedule.operationTheatre, schedule.doctor].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export interface DecisionSummaryLines {
  headline: string;
  detail?: string;
  paymentLine?: string;
}

export function buildDecisionSummaryLines(input: {
  decision: DecisionType | '';
  paymentType: string;
  insuranceCompany: string;
  schedule: ScheduleData | null;
}): DecisionSummaryLines | null {
  if (!input.decision) return null;

  const headline = formatDecisionLabel(input.decision);
  const scheduleText = formatScheduleSummary(input.schedule);
  let detail: string | undefined;

  if (input.decision === 'DateForSurgery') {
    detail = scheduleText ? `Surgery scheduled · ${scheduleText}` : 'Surgery date agreed';
  } else if (input.decision === 'Interested') {
    detail = scheduleText ? `Tentative schedule · ${scheduleText}` : undefined;
  }

  const paymentLine = input.insuranceCompany?.trim()
    ? `Payment: ${input.paymentType} · ${input.insuranceCompany.trim()}`
    : input.paymentType
      ? `Payment: ${input.paymentType}`
      : undefined;

  return { headline, detail, paymentLine };
}
