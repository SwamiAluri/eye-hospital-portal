'use client';

/**
 * Segmented control — pattern from 21st.dev ruixen.ui/segmented-button-group
 * https://21st.dev/community/components/ruixen.ui/segmented-button-group
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedButtonGroupProps<T extends string = string> {
  options: readonly T[];
  selected?: T;
  defaultSelected?: T;
  onChange?: (value: T) => void;
  disabled?: boolean;
  className?: string;
  /** Optional map of option → display label */
  labels?: Partial<Record<T, string>>;
  /** Optional per-option data-testid (overrides `${data-testid}-${option}` pattern) */
  optionTestIds?: Partial<Record<T, string>>;
  size?: 'sm' | 'md' | 'lg';
  'data-testid'?: string;
}

export function SegmentedButtonGroup<T extends string = string>({
  options,
  selected,
  defaultSelected,
  onChange,
  disabled = false,
  className,
  labels,
  optionTestIds,
  size = 'md',
  'data-testid': testId,
}: SegmentedButtonGroupProps<T>) {
  const [internal, setInternal] = React.useState<T | undefined>(defaultSelected ?? options[0]);
  const current = selected !== undefined ? selected : internal;

  const sizeClass =
    size === 'sm'
      ? 'min-h-9 text-xs px-2.5'
      : size === 'lg'
        ? 'min-h-12 text-sm px-4'
        : 'min-h-11 text-sm px-3';

  const handleSelect = (value: T) => {
    if (disabled) return;
    if (selected === undefined) setInternal(value);
    onChange?.(value);
  };

  return (
    <div
      role="group"
      data-testid={testId}
      className={cn(
        'inline-flex w-fit max-w-full rounded-lg border border-border bg-muted/80 p-0.5',
        disabled && 'pointer-events-none opacity-60',
        className,
      )}
    >
      {options.map((option, index) => {
        const isActive = current === option;
        const isFirst = index === 0;
        const isLast = index === options.length - 1;
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            aria-pressed={isActive}
            data-testid={
              optionTestIds?.[option] ?? (testId ? `${testId}-${option.toLowerCase()}` : undefined)
            }
            onClick={() => handleSelect(option)}
            className={cn(
              'relative flex flex-1 items-center justify-center whitespace-nowrap font-semibold transition-all touch-manipulation',
              sizeClass,
              isFirst && 'rounded-l-md',
              isLast && 'rounded-r-md',
              !isFirst && !isLast && 'rounded-none',
              isActive
                ? 'bg-card text-counselling-primary shadow-sm ring-1 ring-border/80'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {labels?.[option] ?? option}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedButtonGroup;
