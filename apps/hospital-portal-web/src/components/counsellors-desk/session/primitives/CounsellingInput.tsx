'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CounsellingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

/** Counselling-native input — avoids generic emerald focus ring from shared Input. */
export const CounsellingInput = React.forwardRef<HTMLInputElement, CounsellingInputProps>(
  ({ className, type, label, error, helperText, required, id, ...props }, ref) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;

    const field = (
      <input
        id={inputId}
        type={type}
        ref={ref}
        required={required}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
        }
        className={cn(
          'flex h-10 w-full rounded-lg border border-counselling-border bg-counselling-card px-3 py-2 text-sm text-counselling-foreground placeholder:text-counselling-muted-foreground',
          'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/25 focus-visible:border-counselling-primary/60',
          'disabled:cursor-not-allowed disabled:opacity-50',
          type === 'number' &&
            '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          error && 'border-red-500 focus-visible:ring-red-200',
          className,
        )}
        {...props}
      />
    );

    if (!label && !error && !helperText) {
      return field;
    }

    return (
      <div className="w-full space-y-1">
        {label ? (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-counselling-muted-foreground"
          >
            {label}
            {required ? <span className="ml-0.5 text-red-600">*</span> : null}
          </label>
        ) : null}
        {field}
        {error ? (
          <p id={`${inputId}-error`} className="text-xs text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        {helperText && !error ? (
          <p id={`${inputId}-helper`} className="text-[10px] text-counselling-muted-foreground">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);
CounsellingInput.displayName = 'CounsellingInput';
