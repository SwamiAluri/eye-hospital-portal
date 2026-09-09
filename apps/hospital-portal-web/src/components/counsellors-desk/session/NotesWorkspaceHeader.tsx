'use client';

import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { CounsellingStatusPill } from '@/components/counsellors-desk/session/CounsellingStatusPill';
import { cn } from '@/lib/utils';

export interface NotesWorkspaceHeaderProps {
  isComplete: boolean;
  blocker?: string | null;
  className?: string;
}

export function NotesWorkspaceHeader({
  isComplete,
  blocker,
  className,
}: NotesWorkspaceHeaderProps) {
  return (
    <header
      className={cn('space-y-1', className)}
      data-testid={counsellingTestIds.notesWorkspaceHeader}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={counsellingSessionTokens.microLabel}>{counsellingCopy.notes}</p>
        <CounsellingStatusPill
          tone={isComplete ? 'complete' : 'required'}
          data-testid={counsellingTestIds.notesWorkspaceStatus}
        >
          {isComplete ? counsellingCopy.notesCompleteBadge : counsellingCopy.notesRequiredBadge}
        </CounsellingStatusPill>
      </div>
      {!isComplete && blocker ? (
        <p
          data-testid={counsellingTestIds.notesInlineBlocker}
          className="text-xs text-amber-900"
          role="status"
        >
          {blocker}
        </p>
      ) : null}
    </header>
  );
}
