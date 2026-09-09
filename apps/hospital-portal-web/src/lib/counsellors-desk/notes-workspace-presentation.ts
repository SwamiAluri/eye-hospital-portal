import { clarifyPhaseAdvanceHint } from '@/lib/counsellors-desk/counselling-action-hints';
import {
  computePhaseCompletion,
  validatePhasesBefore,
  type CounsellingPhaseValidationContext,
} from '@/lib/counsellors-desk/counselling-progress';
import { formatScheduleSummary } from '@/lib/counsellors-desk/decision-workspace-presentation';
import { formatDecisionLabel } from '@/lib/counsellors-desk/session-status-summary';

/** Notes phase is complete when upstream decision workflow is complete. */
export function isNotesPhaseComplete(ctx: CounsellingPhaseValidationContext): boolean {
  return computePhaseCompletion(ctx).wrapup;
}

/** Upstream blockers only — notes fields themselves are optional. */
export function resolveNotesPhaseBlocker(ctx: CounsellingPhaseValidationContext): string | null {
  const error = validatePhasesBefore('wrapup', ctx);
  if (!error) return null;
  return clarifyPhaseAdvanceHint(error);
}

export function hasAnyNotesContent(input: {
  counsellorNotes: string;
  patientRemarks: string;
  doctorNotes: string;
}): boolean {
  return Boolean(
    input.counsellorNotes.trim() || input.patientRemarks.trim() || input.doctorNotes.trim(),
  );
}

export interface NotesReadinessItem {
  label: string;
  value: string;
}

/** Compact handoff facts from existing session fields — no new domain data. */
export function buildNotesReadinessItems(
  ctx: Pick<
    CounsellingPhaseValidationContext,
    'decision' | 'paymentType' | 'insuranceCompany' | 'schedule' | 'followUpDate' | 'followUpReason'
  >,
): NotesReadinessItem[] | null {
  if (!ctx.decision) return null;

  const items: NotesReadinessItem[] = [
    { label: 'Decision', value: formatDecisionLabel(ctx.decision) },
  ];

  if (ctx.decision === 'DateForSurgery' || ctx.decision === 'Interested') {
    const scheduleText = formatScheduleSummary(ctx.schedule);
    items.push({
      label: 'Surgery date',
      value: scheduleText ?? 'Not scheduled',
    });
  } else if (ctx.decision === 'NotInterested' || ctx.decision === 'NeedsTime') {
    const followUp =
      ctx.followUpDate?.trim()
        ? new Date(ctx.followUpDate.trim() + 'T00:00:00').toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : null;
    const reason = ctx.followUpReason?.trim();
    items.push({
      label: 'Follow-up',
      value: [followUp, reason].filter(Boolean).join(' · ') || 'Not set',
    });
  }

  if (ctx.paymentType?.trim()) {
    items.push({
      label: 'Payment',
      value: ctx.insuranceCompany?.trim()
        ? `${ctx.paymentType} · ${ctx.insuranceCompany.trim()}`
        : ctx.paymentType,
    });
  }

  return items;
}
