'use client';

import type { ReactElement } from 'react';
import {
  CounsellingTooltip,
  CounsellingTooltipContent,
  CounsellingTooltipTrigger,
} from '@/components/counsellors-desk/session/primitives';

interface CounsellingDisabledActionTooltipProps {
  reason: string | null;
  children: ReactElement;
}

/** Wraps disabled footer actions so hover/focus still shows why the control is blocked. */
export function CounsellingDisabledActionTooltip({
  reason,
  children,
}: CounsellingDisabledActionTooltipProps) {
  if (!reason) return children;

  return (
    <CounsellingTooltip>
      <CounsellingTooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </CounsellingTooltipTrigger>
      <CounsellingTooltipContent side="top" className="max-w-xs text-center">
        {reason}
      </CounsellingTooltipContent>
    </CounsellingTooltip>
  );
}
