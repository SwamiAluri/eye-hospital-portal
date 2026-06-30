'use client';

/**
 * Stepper — pattern from 21st.dev originui/stepper
 * https://21st.dev/community/components/originui/stepper/controlled-vertical
 */
import * as React from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type StepperContextValue = {
  value: number;
  onValueChange?: (value: number) => void;
  orientation: 'horizontal' | 'vertical';
};

const StepperContext = React.createContext<StepperContextValue | null>(null);
const StepItemContext = React.createContext<{ step: number; completed?: boolean }>({
  step: 0,
  completed: false,
});

function useStepperContext() {
  const ctx = React.useContext(StepperContext);
  if (!ctx) throw new Error('Stepper components must be used within Stepper');
  return ctx;
}

export interface StepperProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  onValueChange?: (value: number) => void;
  orientation?: 'horizontal' | 'vertical';
}

export function Stepper({
  value,
  onValueChange,
  orientation = 'horizontal',
  className,
  children,
  ...props
}: StepperProps) {
  return (
    <StepperContext.Provider value={{ value, onValueChange, orientation }}>
      <div
        data-orientation={orientation}
        className={cn(
          orientation === 'horizontal'
            ? 'flex w-full items-center gap-1'
            : 'flex flex-col items-start gap-0',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </StepperContext.Provider>
  );
}

export interface StepperItemProps extends React.HTMLAttributes<HTMLDivElement> {
  step: number;
  loading?: boolean;
  completed?: boolean;
}

export function StepperItem({
  step,
  loading = false,
  completed = false,
  className,
  children,
  ...props
}: StepperItemProps) {
  const { orientation } = useStepperContext();
  return (
    <StepItemContext.Provider value={{ step, completed }}>
      <div
        data-step={step}
        data-loading={loading ? 'true' : undefined}
        className={cn(
          'group/step flex items-center',
          orientation === 'horizontal' && 'min-w-0 flex-1',
          orientation === 'vertical' && '[&:not(:last-child)]:flex-1 flex-col items-start',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </StepItemContext.Provider>
  );
}

export function StepperTrigger({
  className,
  children,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { onValueChange, orientation } = useStepperContext();
  const { step } = React.useContext(StepItemContext);

  return (
    <button
      type="button"
      className={cn(
        'group/trigger inline-flex items-center gap-2 rounded-md text-left transition-colors',
        orientation === 'horizontal' ? 'flex-col px-1 py-1' : 'flex-row py-2',
        className,
      )}
      onClick={(e) => {
        onValueChange?.(step);
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function StepperIndicator({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  const { value } = useStepperContext();
  const { step, completed: completedOverride } = React.useContext(StepItemContext);
  const completed = completedOverride ?? value > step;
  const active = value === step;
  const loading = false;

  return (
    <span
      data-state={completed ? 'completed' : active ? 'active' : 'inactive'}
      data-loading={loading ? 'true' : undefined}
      className={cn(
        'group/indicator relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-all',
        completed && 'border-primary bg-primary text-primary-foreground',
        active && !completed && 'border-primary bg-card text-primary',
        !active && !completed && 'border-border bg-muted text-muted-foreground',
        className,
      )}
      {...props}
    >
      <span className="transition-all group-data-[state=completed]/indicator:scale-50 group-data-[state=completed]/indicator:opacity-0">
        {children ?? step}
      </span>
      <Check
        className="absolute scale-50 opacity-0 transition-all group-data-[state=completed]/indicator:scale-100 group-data-[state=completed]/indicator:opacity-100"
        size={16}
        strokeWidth={2}
        aria-hidden
      />
      <span className="absolute scale-50 opacity-0 transition-all group-data-[loading=true]/step:scale-100 group-data-[loading=true]/step:opacity-100">
        <LoaderCircle className="animate-spin" size={16} strokeWidth={2} aria-hidden />
      </span>
    </span>
  );
}

export function StepperSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { orientation } = useStepperContext();
  return (
    <div
      aria-hidden
      className={cn(
        'bg-border',
        orientation === 'horizontal' ? 'mx-1 h-0.5 min-w-[1rem] flex-1' : 'ml-4 h-6 w-0.5',
        className,
      )}
      {...props}
    />
  );
}

export function StepperTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'max-w-[6rem] truncate text-[11px] font-medium text-muted-foreground sm:max-w-none sm:text-xs',
        className,
      )}
      {...props}
    />
  );
}
