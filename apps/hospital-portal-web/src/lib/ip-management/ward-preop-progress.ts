import type {
  CounsellorOutpatientChecklistDto,
  PacAssessmentDto,
  PreOpClearanceDetailDto,
  WardChecklistDto,
  WardInvestigationChecklistDto,
} from '@/lib/api/ip-management.api';
import { isDepartmentClearanceCategory } from '@/components/ip-management/department-clearance/constants';

export type WardPreOpPhaseKey = 'p0' | 'p1' | 'p2' | 'p3' | 'p4';

export interface WardPreOpPhaseProgress {
  key: WardPreOpPhaseKey;
  label: string;
  shortLabel: string;
  completed: number;
  total: number;
  /** Optional detail for tooltips */
  detail?: string;
}

const PHASE_META: Record<WardPreOpPhaseKey, { label: string; shortLabel: string }> = {
  p0: { label: 'P0 Outpatient', shortLabel: 'P0' },
  p1: { label: 'P1 Investigations', shortLabel: 'P1' },
  p2: { label: 'P2 Dept Clearance', shortLabel: 'P2' },
  p3: { label: 'P3 Ward Safety', shortLabel: 'P3' },
  p4: { label: 'P4 PAC', shortLabel: 'P4' },
};

function chip(
  key: WardPreOpPhaseKey,
  completed: number,
  total: number,
  detail?: string,
): WardPreOpPhaseProgress {
  return {
    key,
    ...PHASE_META[key],
    completed,
    total,
    detail,
  };
}

export function computeDeptClearanceProgress(clearance: PreOpClearanceDetailDto | null): {
  completed: number;
  total: number;
  detail: string;
} {
  if (!clearance) return { completed: 0, total: 0, detail: 'Not initialised' };

  const activeSections = clearance.sectionClearances.filter(s => s.status !== 'NotRequested');
  if (activeSections.length > 0) {
    const confirmed = activeSections.filter(s => s.status === 'WardConfirmed').length;
    return {
      completed: confirmed,
      total: activeSections.length,
      detail: `${confirmed} department section(s) ward-confirmed`,
    };
  }

  const deptItems = clearance.completions.filter(
    c =>
      isDepartmentClearanceCategory(c.category)
      && c.formCode !== 'WARD_CHECKLIST'
      && c.formCode !== 'WARD_INVESTIGATION_PREOP',
  );
  const pool = deptItems.filter(c => c.isBlocking);
  const items = pool.length > 0 ? pool : deptItems;
  const done = items.filter(c => c.isCompleted || c.isBypassed).length;
  return {
    completed: done,
    total: items.length,
    detail: items.length > 0
      ? `${done}/${items.length} mandatory clearance items`
      : 'No dept clearance items configured',
  };
}

export function buildWardPreOpPhaseProgress(input: {
  p0?: CounsellorOutpatientChecklistDto | null;
  p1?: WardInvestigationChecklistDto | null;
  clearance?: PreOpClearanceDetailDto | null;
  p3?: WardChecklistDto | null;
  pac?: PacAssessmentDto | null;
  includeP0?: boolean;
}): WardPreOpPhaseProgress[] {
  const phases: WardPreOpPhaseProgress[] = [];

  if (input.includeP0 !== false && input.p0) {
    phases.push(chip('p0', input.p0.completedItems, input.p0.totalItems, 'Counsellor outpatient safety'));
  }

  if (input.p1) {
    const applicable = input.p1.items.filter(i => i.appliesToJourney);
    const done = applicable.filter(
      i => i.isBypassed || (i.isCompleted && i.resultValue?.trim()),
    ).length;
    const unverified = input.p1.unverifiedCriticalKeys?.length ?? 0;
    phases.push(
      chip(
        'p1',
        done,
        applicable.length,
        unverified > 0
          ? `${unverified} critical test(s) awaiting ward verification`
          : `${done}/${applicable.length} with results entered`,
      ),
    );
  }

  if (input.clearance) {
    const p2 = computeDeptClearanceProgress(input.clearance);
    if (p2.total > 0) {
      phases.push(chip('p2', p2.completed, p2.total, p2.detail));
    }
  }

  if (input.p3) {
    phases.push(
      chip('p3', input.p3.completedItems, input.p3.totalItems, 'Ward safety checklist'),
    );
  }

  if (input.pac) {
    const done = input.pac.assessmentStatus === 'Completed' ? 1 : 0;
    phases.push(
      chip(
        'p4',
        done,
        1,
        done ? 'PAC assessment completed' : 'PAC draft — complete after admission',
      ),
    );
  }

  return phases;
}

export function phaseProgressPercent(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

export function phaseIsComplete(completed: number, total: number): boolean {
  return total > 0 && completed >= total;
}

/** Maps progress chip → ward checklist stepper section for navigation. */
export function phaseToChecklistSection(
  key: WardPreOpPhaseKey,
): 'p0' | 'investigations' | 'clearance' | 'wardSafety' | 'pac' {
  switch (key) {
    case 'p0': return 'p0';
    case 'p1': return 'investigations';
    case 'p2': return 'clearance';
    case 'p3': return 'wardSafety';
    case 'p4': return 'pac';
  }
}

export function nextClinicalTransition(clinicalState: string): string | null {
  switch (clinicalState) {
    case 'Expected':
      return 'Admitted';
    case 'Admitted':
      return 'ReadyForSurgery';
    case 'ReadyForSurgery':
      return 'SentToOT';
    default:
      return null;
  }
}
