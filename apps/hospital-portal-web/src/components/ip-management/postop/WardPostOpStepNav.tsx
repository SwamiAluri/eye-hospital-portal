'use client';

import { forwardRef, useRef } from 'react';
import { Check } from 'lucide-react';
import { POSTOP_STEPS, type PostOpStepKey, type PostOpStepMeta } from '@/lib/ip-management/postop-steps';
import { WARD_POSTOP_TEST_IDS } from '@/lib/ip-management/ward-postop-test-ids';

export type PostOpStepStatus = 'idle' | 'done' | 'blocked';

export interface WardPostOpStepNavProps {
  activeStep: PostOpStepKey;
  onStepChange: (step: PostOpStepKey) => void;
  stepStatus?: Partial<Record<PostOpStepKey, PostOpStepStatus>>;
}

export function WardPostOpStepNav({
  activeStep,
  onStepChange,
  stepStatus,
}: WardPostOpStepNavProps) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const steps = POSTOP_STEPS;

  function focusStep(key: PostOpStepKey) {
    tabRefs.current[key]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const last = steps.length - 1;
    let nextIndex: number | null = null;
    switch (e.key) {
      case 'ArrowDown':
        nextIndex = index === last ? 0 : index + 1;
        break;
      case 'ArrowUp':
        nextIndex = index === 0 ? last : index - 1;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = last;
        break;
      default:
        return;
    }
    e.preventDefault();
    const next = steps[nextIndex];
    onStepChange(next.key);
    focusStep(next.key);
  }

  return (
    <div
      role="tablist"
      aria-orientation="vertical"
      aria-label="Post-operative workflow steps"
      data-testid={WARD_POSTOP_TEST_IDS.stepNav}
      className="flex gap-1 overflow-x-auto p-1 lg:flex-col lg:overflow-x-visible"
    >
      {steps.map((step, index) => (
        <StepTab
          key={step.key}
          ref={el => {
            tabRefs.current[step.key] = el;
          }}
          step={step}
          active={activeStep === step.key}
          status={stepStatus?.[step.key] ?? 'idle'}
          onSelect={() => onStepChange(step.key)}
          onKeyDown={e => onKeyDown(e, index)}
          legacyTestId={
            step.key === 'vitals'
              ? WARD_POSTOP_TEST_IDS.tabOverview
              : step.key === 'nurse'
                ? WARD_POSTOP_TEST_IDS.tabForm4
                : undefined
          }
        />
      ))}
    </div>
  );
}

interface StepTabProps {
  step: PostOpStepMeta;
  active: boolean;
  status: PostOpStepStatus;
  onSelect: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  legacyTestId?: string;
}

const StepTab = forwardRef<HTMLButtonElement, StepTabProps>(function StepTab(
  { step, active, status, onSelect, onKeyDown, legacyTestId },
  ref,
) {
  const Icon = step.icon;
  const done = status === 'done';
  const blocked = status === 'blocked';

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      data-testid={WARD_POSTOP_TEST_IDS.stepTab(step.key)}
      data-legacy-testid={legacyTestId}
      {...(legacyTestId ? { 'data-testid-alias': legacyTestId } : {})}
      id={legacyTestId}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={[
        'group flex min-h-[2.75rem] shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 lg:w-full',
        active
          ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
          : blocked
            ? 'border-transparent text-amber-800 hover:bg-amber-50'
            : 'border-transparent text-gray-600 hover:bg-gray-50',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
          active
            ? 'bg-indigo-600 text-white'
            : done
              ? 'bg-emerald-100 text-emerald-700'
              : blocked
                ? 'bg-amber-100 text-amber-800'
                : 'bg-gray-100 text-gray-500',
        ].join(' ')}
        aria-hidden="true"
      >
        {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{step.label}</span>
      {/* e2e phase3 looks up legacy tab ids as getByTestId */}
      {legacyTestId && (
        <span data-testid={legacyTestId} className="sr-only" aria-hidden="true">
          {step.label}
        </span>
      )}
    </button>
  );
});
