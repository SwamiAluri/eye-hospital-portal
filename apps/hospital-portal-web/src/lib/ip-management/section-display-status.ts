import type { PreOpCompletionDto, PreOpSectionClearanceDto } from '@/lib/api/ip-management.api';

/** Computed UI rollup on top of `PreOpSectionClearance.Status` (R5 / G3). */
export type SectionDisplayStatus =
  | 'Locked'
  | 'NotStarted'
  | 'PartiallyComplete'
  | 'AwaitingDepartment'
  | 'ReadyToConfirm'
  | 'ConcernsRaised'
  | 'OnHold'
  | 'Rejected'
  | 'Escalated'
  | 'Complete';

export const SECTION_DISPLAY_STATUS_LABELS: Record<SectionDisplayStatus, string> = {
  Locked: 'Locked until admission',
  NotStarted: 'Not started',
  PartiallyComplete: 'Partially complete',
  AwaitingDepartment: 'Awaiting department',
  ReadyToConfirm: 'Ready to confirm',
  ConcernsRaised: 'Concerns raised',
  OnHold: 'On hold',
  Rejected: 'Rejected',
  Escalated: 'Escalated',
  Complete: 'Complete',
};

export const SECTION_DISPLAY_STATUS_COLORS: Record<SectionDisplayStatus, string> = {
  Locked: 'bg-slate-100 text-slate-600',
  NotStarted: 'bg-gray-100 text-gray-500',
  PartiallyComplete: 'bg-sky-100 text-sky-700',
  AwaitingDepartment: 'bg-yellow-100 text-yellow-700',
  ReadyToConfirm: 'bg-green-100 text-green-700',
  ConcernsRaised: 'bg-red-100 text-red-700',
  OnHold: 'bg-amber-100 text-amber-700',
  Rejected: 'bg-red-200 text-red-800',
  Escalated: 'bg-orange-100 text-orange-700',
  Complete: 'bg-emerald-100 text-emerald-700',
};

const ADMISSION_LOCKED_CATEGORIES = new Set(['Evaluation', 'Anaesthesia']);

export function isSectionLockedAtExpected(clinicalState: string, category: string): boolean {
  return clinicalState === 'Expected' && ADMISSION_LOCKED_CATEGORIES.has(category);
}

function mandatoryItems(items: PreOpCompletionDto[]) {
  const blocking = items.filter(i => i.isBlocking);
  return blocking.length > 0 ? blocking : items;
}

function itemProgress(items: PreOpCompletionDto[]): { done: number; total: number } {
  const pool = mandatoryItems(items);
  const done = pool.filter(i => i.isCompleted || i.isBypassed).length;
  return { done, total: pool.length };
}

/** Derives display status for one §2 category row. */
export function deriveSectionDisplayStatus(input: {
  clinicalState: string;
  category: string;
  sectionClearance?: PreOpSectionClearanceDto | null;
  items: PreOpCompletionDto[];
}): SectionDisplayStatus {
  const { clinicalState, category, sectionClearance, items } = input;

  if (isSectionLockedAtExpected(clinicalState, category)) {
    return 'Locked';
  }

  const backendStatus = sectionClearance?.status ?? 'NotRequested';

  switch (backendStatus) {
    case 'WardConfirmed':
      return 'Complete';
    case 'RespondedClear':
      return 'ReadyToConfirm';
    case 'RespondedConcerns':
      return 'ConcernsRaised';
    case 'Requested':
    case 'NeedsInfo':
      return 'AwaitingDepartment';
    case 'OnHold':
      return 'OnHold';
    case 'Rejected':
      return 'Rejected';
    case 'Escalated':
      return 'Escalated';
    default:
      break;
  }

  const { done, total } = itemProgress(items);
  if (total === 0 || done === 0) return 'NotStarted';
  if (done >= total) return 'Complete';
  return 'PartiallyComplete';
}
