'use client';

import type { ReactNode } from 'react';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { cn } from '@/lib/utils';

export type CounsellingStatusPillTone = 'complete' | 'required' | 'info' | 'danger';

export interface CounsellingStatusPillProps {
  tone: CounsellingStatusPillTone;
  children: ReactNode;
  className?: string;
  'data-testid'?: string;
}

const PILL_TONE: Record<CounsellingStatusPillTone, { pill: string; dot: string }> = {
  complete: {
    pill: counsellingSessionTokens.statusPillComplete,
    dot: counsellingSessionTokens.statusPillDotComplete,
  },
  required: {
    pill: counsellingSessionTokens.statusPillRequired,
    dot: counsellingSessionTokens.statusPillDotRequired,
  },
  info: {
    pill: counsellingSessionTokens.statusPillInfo,
    dot: counsellingSessionTokens.statusPillDotInfo,
  },
  danger: {
    pill: counsellingSessionTokens.statusPillDanger,
    dot: counsellingSessionTokens.statusPillDotDanger,
  },
};

/** Waiting-list-style status pill with a colored dot, on counselling tokens. */
export function CounsellingStatusPill({
  tone,
  children,
  className,
  'data-testid': testId,
}: CounsellingStatusPillProps) {
  const styles = PILL_TONE[tone];
  return (
    <span
      data-testid={testId}
      className={cn(counsellingSessionTokens.statusPill, styles.pill, className)}
    >
      <span aria-hidden className={cn(counsellingSessionTokens.statusPillDot, styles.dot)} />
      {children}
    </span>
  );
}
