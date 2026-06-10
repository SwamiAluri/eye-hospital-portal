'use client';

import { Check } from 'lucide-react';
import {
  COUNSELLING_PHASES,
  type CounsellingPhase,
  type CounsellingPhaseCompletion,
} from '@/lib/counsellors-desk/counselling-progress';
import {
  CounsellingPhaseTrigger,
  CounsellingSegmented,
} from '@/components/counsellors-desk/session/primitives';
import { cn } from '@/lib/utils';

export interface CounsellingPhaseNavProps {
  activePhase: CounsellingPhase;
  visitedPhases: CounsellingPhase[];
  phaseCompletion: CounsellingPhaseCompletion;
  onPhaseSelect: (phase: CounsellingPhase) => void;
  canGoToPhase: (phase: CounsellingPhase) => boolean;
  className?: string;
}

export function CounsellingPhaseNav({
  activePhase,
  visitedPhases,
  phaseCompletion,
  onPhaseSelect,
  canGoToPhase,
  className,
}: CounsellingPhaseNavProps) {
  return (
    <>
      <nav
        aria-label="Counselling session phases"
        className={cn('mb-4 lg:hidden', className)}
      >
        <CounsellingSegmented
          options={COUNSELLING_PHASES.map((p) => p.id)}
          selected={activePhase}
          onChange={(v) => {
            if (canGoToPhase(v)) onPhaseSelect(v);
          }}
          labels={Object.fromEntries(
            COUNSELLING_PHASES.map((p) => [p.id, p.shortLabel]),
          ) as Record<CounsellingPhase, string>}
          className="w-full"
          data-testid="counselling-phase-mobile"
        />
      </nav>

      <nav
        aria-label="Counselling session phases"
        className={cn('hidden shrink-0 lg:block lg:w-[220px]', className)}
      >
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-counselling-muted-foreground">
          Session flow
        </p>
        <ol className="space-y-1">
          {COUNSELLING_PHASES.map((phase, index) => {
            const isActive = activePhase === phase.id;
            const isComplete = phaseCompletion[phase.id] && visitedPhases.includes(phase.id);
            const isAccessible = canGoToPhase(phase.id);
            const isLast = index === COUNSELLING_PHASES.length - 1;

            return (
              <li key={phase.id} className="flex gap-2">
                <div className="flex w-8 shrink-0 flex-col items-center pt-2.5">
                  <span
                    className={cn(
                      'relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ring-2 ring-counselling-card',
                      isComplete
                        ? 'bg-counselling-primary text-white'
                        : isActive
                          ? 'bg-counselling-accent text-counselling-primary ring-counselling-primary/30'
                          : 'bg-counselling-muted text-counselling-muted-foreground',
                    )}
                  >
                    {isComplete ? <Check className="h-4 w-4" /> : index + 1}
                  </span>
                  {!isLast && (
                    <span
                      className={cn(
                        'my-1 min-h-[1.25rem] w-0.5 flex-1',
                        isComplete ? 'bg-counselling-primary/40' : 'bg-counselling-border',
                      )}
                      aria-hidden
                    />
                  )}
                </div>
                <CounsellingPhaseTrigger
                  data-testid={phase.testId}
                  disabled={!isAccessible}
                  isActive={isActive}
                  isAccessible={isAccessible}
                  onClick={() => onPhaseSelect(phase.id)}
                  className="mb-0.5 min-w-0 flex-1"
                >
                  <span className="min-w-0">
                    <span
                      className={cn(
                        'block text-sm font-semibold',
                        isActive ? 'text-counselling-accent-foreground' : 'text-counselling-foreground',
                      )}
                    >
                      {phase.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-counselling-muted-foreground">
                      {phase.description}
                    </span>
                  </span>
                </CounsellingPhaseTrigger>
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
