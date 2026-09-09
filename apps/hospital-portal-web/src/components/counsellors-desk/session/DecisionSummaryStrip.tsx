'use client';

import {
  buildDecisionSummaryLines,
  type DecisionSummaryLines,
} from '@/lib/counsellors-desk/decision-workspace-presentation';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import type { DecisionType, ScheduleData } from '@/types/counsellors-desk';
import { cn } from '@/lib/utils';

export interface DecisionSummaryStripProps {
  decision: DecisionType | '';
  paymentType: string;
  insuranceCompany: string;
  schedule: ScheduleData | null;
  className?: string;
}

/** Flat decision summary — no nested card/panel chrome (Wave 2E-DEC). */
export function DecisionSummaryStrip({
  decision,
  paymentType,
  insuranceCompany,
  schedule,
  className,
}: DecisionSummaryStripProps) {
  const summary = buildDecisionSummaryLines({
    decision,
    paymentType,
    insuranceCompany,
    schedule,
  });

  if (!summary) return null;

  return (
    <div
      data-testid={counsellingTestIds.decisionSummaryStrip}
      className={cn('border-t border-counselling-border/60 pt-3', className)}
      aria-label={counsellingCopy.decisionRecordedSummary}
    >
      <DecisionSummaryContent summary={summary} />
    </div>
  );
}

function DecisionSummaryContent({ summary }: { summary: DecisionSummaryLines }) {
  return (
    <div className="space-y-0.5 text-sm text-counselling-foreground">
      <p className="font-semibold">{summary.headline}</p>
      {summary.detail ? (
        <p className="text-xs text-counselling-muted-foreground">{summary.detail}</p>
      ) : null}
      {summary.paymentLine ? (
        <p className="text-xs text-counselling-muted-foreground">{summary.paymentLine}</p>
      ) : null}
    </div>
  );
}
