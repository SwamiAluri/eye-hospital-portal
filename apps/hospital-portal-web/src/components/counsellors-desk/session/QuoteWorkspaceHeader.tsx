'use client';

import { useMemo } from 'react';
import {
  isPhaseComplete,
  validateEstimatePhase,
  type CounsellingPhaseValidationContext,
} from '@/lib/counsellors-desk/counselling-progress';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { CounsellingStatusPill } from '@/components/counsellors-desk/session/CounsellingStatusPill';

export interface QuoteWorkspaceHeaderProps {
  phaseValidationContext: CounsellingPhaseValidationContext;
}

export function QuoteWorkspaceHeader({ phaseValidationContext }: QuoteWorkspaceHeaderProps) {
  const complete = isPhaseComplete('estimate', phaseValidationContext);
  const blocker = useMemo(
    () => validateEstimatePhase(phaseValidationContext),
    [phaseValidationContext],
  );

  return (
    <header
      className={counsellingSessionTokens.quoteWorkspaceHeader}
      data-testid={counsellingTestIds.quoteWorkspaceHeader}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={counsellingSessionTokens.quoteWorkspaceTitle}>Quote</h2>
        <CounsellingStatusPill
          tone={complete ? 'complete' : 'required'}
          data-testid={counsellingTestIds.quoteWorkspaceStatus}
        >
          {complete ? counsellingCopy.quoteCompleteBadge : counsellingCopy.quoteRequiredBadge}
        </CounsellingStatusPill>
      </div>
      {!complete && blocker ? (
        <p
          data-testid={counsellingTestIds.quoteInlineBlocker}
          className="text-xs text-amber-900"
          role="status"
        >
          {blocker}
        </p>
      ) : null}
    </header>
  );
}
