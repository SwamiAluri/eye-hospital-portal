'use client';

import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { CounsellingButton } from './CounsellingButton';
import { CounsellingCheckbox } from './CounsellingCheckbox';
import { CounsellingLabel } from './CounsellingLabel';

export interface CounsellingSelectableRowProps {
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  /** Show checkbox + label (investigations pattern). */
  showCheckbox?: boolean;
  checkboxLabel?: string;
  'data-testid'?: string;
}

/** Full-width selectable list row (procedures, investigations). */
export function CounsellingSelectableRow({
  selected = false,
  disabled,
  onClick,
  children,
  className,
  showCheckbox = false,
  checkboxLabel,
  'data-testid': testId,
}: CounsellingSelectableRowProps) {
  const checkboxId = useId();

  return (
    <CounsellingButton
      type="button"
      variant="ghost"
      disabled={disabled}
      data-testid={testId}
      onClick={onClick}
      className={cn(
        'flex h-auto min-h-11 w-full items-center justify-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-normal transition-colors',
        counsellingSessionTokens.touchTarget,
        selected
          ? counsellingSessionTokens.selectedRow +
              ' border-counselling-primary/30 font-medium text-counselling-accent-foreground'
          : 'border-transparent bg-card hover:border-border hover:bg-muted text-foreground',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      {showCheckbox ? (
        <>
          <CounsellingCheckbox
            id={checkboxId}
            checked={selected}
            tabIndex={-1}
            aria-hidden
            className="pointer-events-none shrink-0"
          />
          {checkboxLabel ? (
            <CounsellingLabel htmlFor={checkboxId} className="sr-only">
              {checkboxLabel}
            </CounsellingLabel>
          ) : null}
        </>
      ) : null}
      {children}
    </CounsellingButton>
  );
}
