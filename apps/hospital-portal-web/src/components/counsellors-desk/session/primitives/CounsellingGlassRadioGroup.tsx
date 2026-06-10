'use client';

import type { ReactNode } from 'react';
import {
  CounsellingRadioGroup,
  CounsellingRadioGroupItem,
} from '@/components/counsellors-desk/session/primitives';
import { cn } from '@/lib/utils';

export interface CounsellingGlassRadioOption<T extends string = string> {
  value: T;
  label: ReactNode;
  description?: ReactNode;
  testId?: string;
}

export interface CounsellingGlassRadioGroupProps<T extends string = string> {
  value: T;
  onValueChange: (value: T) => void;
  options: CounsellingGlassRadioOption<T>[];
  disabled?: boolean;
  className?: string;
  name?: string;
}

/** Frosted glass radio cards for pricing mode and similar binary/ternary choices (P4). */
export function CounsellingGlassRadioGroup<T extends string = string>({
  value,
  onValueChange,
  options,
  disabled,
  className,
  name = 'counselling-glass-radio',
}: CounsellingGlassRadioGroupProps<T>) {
  return (
    <CounsellingRadioGroup
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      disabled={disabled}
      className={cn('grid gap-2 sm:grid-cols-2', className)}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <label
            key={opt.value}
            htmlFor={`${name}-${opt.value}`}
            data-testid={opt.testId}
            className={cn(
              'counselling-glass-radio relative flex cursor-pointer items-start gap-3 rounded-xl px-4 py-3 transition-colors',
              selected
                ? 'border-counselling-primary/40 bg-counselling-accent/90 ring-1 ring-counselling-primary/25'
                : 'hover:border-counselling-border hover:bg-counselling-muted/50',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <CounsellingRadioGroupItem
              id={`${name}-${opt.value}`}
              value={opt.value}
              className="mt-0.5 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-counselling-foreground">
                {opt.label}
              </span>
              {opt.description ? (
                <span className="mt-0.5 block text-xs text-counselling-muted-foreground">
                  {opt.description}
                </span>
              ) : null}
            </div>
          </label>
        );
      })}
    </CounsellingRadioGroup>
  );
}
