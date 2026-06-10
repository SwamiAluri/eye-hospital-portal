'use client';

import type { ReactNode } from 'react';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives/CounsellingButton';
import { cn } from '@/lib/utils';

export interface CounsellingPhaseTriggerProps {
  children: ReactNode;
  disabled?: boolean;
  isActive?: boolean;
  isAccessible?: boolean;
  onClick?: () => void;
  'data-testid'?: string;
  className?: string;
}

/** Vertical timeline phase step — wraps CounsellingButton (no raw HTML). */
export function CounsellingPhaseTrigger({
  children,
  disabled,
  isActive,
  isAccessible = true,
  onClick,
  'data-testid': testId,
  className,
}: CounsellingPhaseTriggerProps) {
  return (
    <CounsellingButton
      type="button"
      variant="ghost"
      disabled={disabled ?? !isAccessible}
      onClick={onClick}
      data-testid={testId}
      aria-current={isActive ? 'step' : undefined}
      className={cn(
        'relative h-auto min-h-0 w-full items-start justify-start gap-3 rounded-xl px-2 py-2.5 text-left font-normal',
        isActive && 'bg-counselling-accent ring-1 ring-counselling-primary/25 hover:bg-counselling-accent',
        isAccessible && !isActive && 'hover:bg-counselling-muted',
        !isAccessible && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      {children}
    </CounsellingButton>
  );
}
