'use client';

import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { CounsellingStatusPill } from '@/components/counsellors-desk/session/CounsellingStatusPill';
import { cn } from '@/lib/utils';

export interface DecisionWorkspaceHeaderProps {
  isComplete: boolean;
  blocker?: string | null;
  className?: string;
}

export function DecisionWorkspaceHeader({
  isComplete,
  blocker,
  className,
}: DecisionWorkspaceHeaderProps) {
  return (
    <header
      className={cn('space-y-1', className)}
      data-testid={counsellingTestIds.decisionWorkspaceHeader}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={counsellingSessionTokens.microLabel}>Decision</p>
        <CounsellingStatusPill
          tone={isComplete ? 'complete' : 'required'}
          data-testid={counsellingTestIds.decisionWorkspaceStatus}
        >
          {isComplete ? counsellingCopy.decisionRecordedBadge : counsellingCopy.decisionRequiredBadge}
        </CounsellingStatusPill>
      </div>
      {!isComplete && blocker ? (
        <p
          data-testid={counsellingTestIds.decisionInlineBlocker}
          className="text-xs text-amber-900"
          role="status"
        >
          {blocker}
        </p>
      ) : null}
    </header>
  );
}
