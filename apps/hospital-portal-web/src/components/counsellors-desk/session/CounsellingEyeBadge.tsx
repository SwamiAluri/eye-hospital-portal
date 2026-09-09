'use client';

import {
  counsellingEyeBadgeClass,
  counsellingEyeBadgeText,
  type CounsellingEyeOption,
} from '@/lib/counsellors-desk/counselling-eye';
import { cn } from '@/lib/utils';

export interface CounsellingEyeBadgeProps {
  eye: CounsellingEyeOption;
  className?: string;
  'data-testid'?: string;
}

/** Compact RE / LE / BE badge — same colors as counselling waiting list. */
export function CounsellingEyeBadge({
  eye,
  className,
  'data-testid': testId,
}: CounsellingEyeBadgeProps) {
  return (
    <span
      data-testid={testId}
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold tabular-nums',
        counsellingEyeBadgeClass(eye),
        className,
      )}
    >
      {counsellingEyeBadgeText(eye)}
    </span>
  );
}
