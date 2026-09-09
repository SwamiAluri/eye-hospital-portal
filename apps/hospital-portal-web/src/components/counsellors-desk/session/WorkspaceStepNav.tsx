'use client';

import { Check } from 'lucide-react';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { cn } from '@/lib/utils';

export interface WorkspaceStepItem {
  id: string;
  label: string;
  testId: string;
  isComplete?: boolean;
  disabled?: boolean;
}

export interface WorkspaceStepNavProps {
  ariaLabel: string;
  items: WorkspaceStepItem[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
  'data-testid'?: string;
}

/** Compact pill step indicator — Quote · Decision · Notes, Policy · Estimate · Documents */
export function WorkspaceStepNav({
  ariaLabel,
  items,
  activeId,
  onSelect,
  className,
  'data-testid': testId,
}: WorkspaceStepNavProps) {
  return (
    <nav
      aria-label={ariaLabel}
      data-testid={testId}
      className={cn('min-w-0', className)}
    >
      <ol className={counsellingSessionTokens.pillTabTrack}>
        {items.map((item) => {
          const isActive = activeId === item.id;
          const isComplete = item.isComplete && !isActive;
          const isDisabled = item.disabled ?? false;

          return (
            <li key={item.id}>
              <button
                type="button"
                data-testid={item.testId}
                aria-current={isActive ? 'step' : undefined}
                disabled={isDisabled}
                onClick={() => {
                  if (!isDisabled) onSelect(item.id);
                }}
                className={cn(
                  counsellingSessionTokens.pillTab,
                  isActive && counsellingSessionTokens.pillTabCurrent,
                  isComplete && counsellingSessionTokens.pillTabComplete,
                  isDisabled && 'cursor-not-allowed opacity-45',
                )}
              >
                {isComplete ? (
                  <Check className="h-3 w-3 shrink-0" aria-hidden />
                ) : (
                  <span
                    aria-hidden
                    className={cn(
                      'h-1.5 w-1.5 shrink-0 rounded-full',
                      isActive ? 'bg-white' : 'bg-counselling-muted-foreground/50',
                    )}
                  />
                )}
                {item.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
