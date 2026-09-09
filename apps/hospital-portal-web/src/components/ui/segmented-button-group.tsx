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
  /** Visual family — mode selector vs catalog filter (Wave 2E-2). */
  variant?: 'default' | 'mode' | 'filter';
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
  variant = 'default',
  'data-testid': testId,
}: SegmentedButtonGroupProps<T>) {
  const [internal, setInternal] = React.useState<T | undefined>(defaultSelected ?? options[0]);
  const current = selected !== undefined ? selected : internal;

  const sizeClass =
    size === 'sm'
      ? variant === 'filter'
        ? 'min-h-8 text-xs px-2'
        : 'min-h-9 text-xs px-2.5'
      : size === 'lg'
        ? 'min-h-12 text-sm px-4'
        : 'min-h-11 text-sm px-3';

  const wrapperClass =
    variant === 'mode'
      ? 'inline-flex w-fit max-w-full rounded-lg border border-counselling-border/70 bg-counselling-muted/40 p-0.5'
      : variant === 'filter'
        ? 'inline-flex w-fit max-w-full gap-1 rounded-md bg-counselling-muted/30 p-0.5'
        : 'inline-flex w-fit max-w-full rounded-lg border border-border bg-muted/80 p-0.5';

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
        wrapperClass,
        disabled && 'pointer-events-none',
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
              'relative flex flex-1 items-center justify-center whitespace-nowrap font-semibold transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40 focus-visible:ring-offset-1',
              sizeClass,
              variant === 'filter'
                ? cn(
                    'rounded-md',
                    isActive
                      ? 'bg-counselling-primary text-white shadow-sm'
                      : cn(
                          'text-counselling-muted-foreground hover:text-counselling-foreground',
                          disabled && 'opacity-50',
                        ),
                  )
                : cn(
                    isFirst && 'rounded-l-md',
                    isLast && 'rounded-r-md',
                    !isFirst && !isLast && 'rounded-none',
                    isActive
                      ? 'bg-counselling-primary text-white shadow-sm'
                      : cn(
                          'text-muted-foreground hover:text-foreground',
                          disabled && 'opacity-50',
                        ),
                  ),
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
