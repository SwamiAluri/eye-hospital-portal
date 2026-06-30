'use client';

import { Check, ClipboardList, FileText, Receipt } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import {
  COUNSELLING_PHASES,
  type CounsellingPhase,
  type CounsellingPhaseCompletion,
} from '@/lib/counsellors-desk/counselling-progress';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { cn } from '@/lib/utils';

const PHASE_ICONS: Record<CounsellingPhase, LucideIcon> = {
  estimate: Receipt,
  decision: ClipboardList,
  wrapup: FileText,
};

export interface CounsellingWizardNavProps {
  activePhase: CounsellingPhase;
  visitedPhases: CounsellingPhase[];
  phaseCompletion: CounsellingPhaseCompletion;
  onPhaseSelect: (phase: CounsellingPhase) => void;
  canGoToPhase: (phase: CounsellingPhase) => boolean;
  className?: string;
}

export function CounsellingWizardNav({
  activePhase,
  visitedPhases,
  phaseCompletion,
  onPhaseSelect,
  canGoToPhase,
  className,
}: CounsellingWizardNavProps) {
  return (
    <nav
      aria-label="Counselling session phases"
      className={cn('grid grid-cols-1 gap-2 sm:grid-cols-3', className)}
    >
      {COUNSELLING_PHASES.map((phase) => {
        const Icon = PHASE_ICONS[phase.id];
        const isActive = activePhase === phase.id;
        const isComplete = phaseCompletion[phase.id] && visitedPhases.includes(phase.id);
        const isAccessible = canGoToPhase(phase.id);

        return (
          <button
            key={phase.id}
            type="button"
            data-testid={phase.testId}
            aria-current={isActive ? 'step' : undefined}
            disabled={!isAccessible}
            onClick={() => {
              if (isAccessible) onPhaseSelect(phase.id);
            }}
            className={cn(
              'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
              isActive
                ? 'border-counselling-primary/40 bg-counselling-accent ring-1 ring-counselling-primary/20'
                : 'border-counselling-border bg-counselling-card hover:border-counselling-primary/25 hover:bg-counselling-muted/50',
              !isAccessible && 'cursor-not-allowed opacity-50 hover:border-counselling-border hover:bg-counselling-card',
            )}
          >
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                isActive
                  ? 'bg-counselling-primary text-white'
                  : isComplete
                    ? 'bg-counselling-primary/15 text-counselling-primary'
                    : 'bg-counselling-muted text-counselling-muted-foreground',
              )}
            >
              {isComplete && !isActive ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Icon className="h-4 w-4" aria-hidden />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  'block text-sm font-semibold',
                  isActive ? 'text-counselling-accent-foreground' : 'text-counselling-foreground',
                )}
              >
                {phase.label}
              </span>
              <span className={cn(counsellingSessionTokens.sectionSubtitle, 'text-[11px]')}>
                {isComplete
                  ? counsellingCopy.stepComplete
                  : isActive
                    ? counsellingCopy.stepInProgress
                    : counsellingCopy.stepPending}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
