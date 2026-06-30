'use client';

/**
 * OriginUI vertical stepper — counselling session theme.
 * https://21st.dev/community/components/originui/stepper/controlled-vertical
 */
import type { ComponentProps, HTMLAttributes } from 'react';
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from '@/components/ui/stepper';
import { cn } from '@/lib/utils';

export {
  Stepper as CounsellingStepper,
  StepperItem as CounsellingStepperItem,
  StepperTrigger as CounsellingStepperTrigger,
  StepperSeparator as CounsellingStepperSeparator,
};

export function CounsellingStepperIndicator({
  className,
  ...props
}: ComponentProps<typeof StepperIndicator>) {
  return (
    <StepperIndicator
      className={cn(
        'h-8 w-8 ring-2 ring-counselling-card',
        'border-counselling-border bg-counselling-muted text-counselling-muted-foreground',
        'data-[state=active]:border-counselling-primary data-[state=active]:bg-counselling-accent data-[state=active]:text-counselling-primary',
        'data-[state=completed]:border-counselling-primary data-[state=completed]:bg-counselling-primary data-[state=completed]:text-white',
        className,
      )}
      {...props}
    />
  );
}

export function CounsellingStepperTitle({
  className,
  ...props
}: ComponentProps<typeof StepperTitle>) {
  return (
    <StepperTitle
      className={cn(
        'max-w-none text-sm font-semibold text-counselling-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function CounsellingStepperDescription({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('mt-0.5 block text-[11px] font-normal text-counselling-muted-foreground', className)}
      {...props}
    />
  );
}
