'use client';

import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import type {
  CounsellingPhase,
  CounsellingPhaseCompletion,
} from '@/lib/counsellors-desk/counselling-progress';
import { CounsellingWizardNav } from '@/components/counsellors-desk/session/CounsellingWizardNav';
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
    <div className={cn('shrink-0', className)}>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-counselling-muted-foreground">
        {counsellingCopy.sessionFlow}
      </p>
      <CounsellingWizardNav
        activePhase={activePhase}
        visitedPhases={visitedPhases}
        phaseCompletion={phaseCompletion}
        onPhaseSelect={onPhaseSelect}
        canGoToPhase={canGoToPhase}
      />
    </div>
  );
}
