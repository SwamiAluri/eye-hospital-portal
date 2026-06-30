/**
 * Unified Ward Pre-Op status vocabulary (Workspace v2 — Phase 1).
 *
 * Single source of truth for status semantics + color tokens across the redesigned
 * Ward Pre-Operative Workspace. Replaces the three overlapping vocabularies:
 *   - investigation `entryStatus` (draft | entered | verified)
 *   - `SECTION_STATUS_*` (NotRequested … Escalated)  — department-clearance/constants.ts
 *   - `SECTION_DISPLAY_STATUS_*` (Locked … Complete) — section-display-status.ts
 *
 * Mappers below let existing data adopt the unified vocabulary incrementally without
 * a backend change. See docs/ward-preop-redesign-phase0-mapping.md §16.
 *
 * Accessibility: every status carries a distinct icon AND text label AND color, so
 * status is never conveyed by color alone (WCAG 2.2 — 1.4.1 Use of Color).
 */
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Circle,
  CircleDot,
  Clock,
  HelpCircle,
  PauseCircle,
  RotateCcw,
  ShieldCheck,
  ShieldX,
  XCircle,
} from 'lucide-react';

export type PreOpStatus =
  | 'not-started'
  | 'in-progress'
  | 'pending-verification'
  | 'verified'
  | 'blocked'
  | 'critical'
  | 'on-hold'
  | 'needs-info'
  | 'rejected'
  | 'revoked'
  | 're-consent'
  | 'completed';

export interface PreOpStatusToken {
  /** Default human label. */
  label: string;
  /** Soft chip background. */
  bg: string;
  /** Foreground text (AA contrast on `bg`). */
  text: string;
  /** Border for outline variant. */
  border: string;
  /** Solid dot indicator. */
  dot: string;
  /** Distinct icon (a11y: not color-only). */
  icon: LucideIcon;
}

/**
 * Canonical tokens. Colors mirror the existing palette (StatusBadge /
 * section-display-status) so the redesign feels native while consolidating meaning.
 */
export const PREOP_STATUS_TOKENS: Record<PreOpStatus, PreOpStatusToken> = {
  'not-started': {
    label: 'Not started',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
    icon: Circle,
  },
  'in-progress': {
    label: 'In progress',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
    icon: CircleDot,
  },
  'pending-verification': {
    label: 'Pending verification',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    icon: Clock,
  },
  verified: {
    label: 'Verified',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    icon: ShieldCheck,
  },
  blocked: {
    label: 'Blocked',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    dot: 'bg-red-500',
    icon: Ban,
  },
  critical: {
    label: 'Critical',
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-300',
    dot: 'bg-red-600',
    icon: AlertTriangle,
  },
  'on-hold': {
    label: 'On hold',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
    icon: PauseCircle,
  },
  'needs-info': {
    label: 'Needs info',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
    icon: HelpCircle,
  },
  rejected: {
    label: 'Rejected',
    bg: 'bg-rose-100',
    text: 'text-rose-800',
    border: 'border-rose-300',
    dot: 'bg-rose-600',
    icon: XCircle,
  },
  revoked: {
    label: 'Revoked',
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-300',
    dot: 'bg-red-600',
    icon: ShieldX,
  },
  're-consent': {
    label: 'Re-consent required',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-300',
    dot: 'bg-amber-500',
    icon: RotateCcw,
  },
  completed: {
    label: 'Completed',
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    dot: 'bg-green-500',
    icon: CheckCircle2,
  },
};

export function preOpStatusToken(status: PreOpStatus): PreOpStatusToken {
  return PREOP_STATUS_TOKENS[status] ?? PREOP_STATUS_TOKENS['not-started'];
}

// ─── Mappers from existing enums ────────────────────────────────────────────────

/**
 * Investigation `entryStatus` → unified status.
 * `critical` is returned only when an unverified row is flagged critical, so the UI
 * can surface patient-safety risk distinctly.
 */
export function statusFromEntry(
  entryStatus: string | null | undefined,
  opts?: { hasValue?: boolean; isCritical?: boolean; counsellorDraft?: boolean },
): PreOpStatus {
  const hasValue = opts?.hasValue ?? false;
  switch (entryStatus) {
    case 'verified':
      return 'verified';
    case 'entered':
      return opts?.isCritical ? 'critical' : 'pending-verification';
    case 'draft':
      return hasValue ? 'in-progress' : 'not-started';
    default:
      return hasValue ? 'in-progress' : 'not-started';
  }
}

/** Backend `PreOpSectionClearance.Status` → unified status. */
export function statusFromSectionStatus(status: string | null | undefined): PreOpStatus {
  switch (status) {
    case 'WardConfirmed':
      return 'completed';
    case 'RespondedClear':
      return 'pending-verification';
    case 'RespondedConcerns':
      return 'needs-info';
    case 'Requested':
      return 'in-progress';
    case 'NeedsInfo':
      return 'needs-info';
    case 'OnHold':
      return 'on-hold';
    case 'Escalated':
      return 'on-hold';
    case 'Rejected':
      return 'rejected';
    case 'NotRequested':
    default:
      return 'not-started';
  }
}

/** UI `SectionDisplayStatus` → unified status (Phase 11 collapses both into this). */
export function statusFromDisplayStatus(displayStatus: string | null | undefined): PreOpStatus {
  switch (displayStatus) {
    case 'Complete':
      return 'completed';
    case 'ReadyToConfirm':
      return 'pending-verification';
    case 'ConcernsRaised':
      return 'needs-info';
    case 'PartiallyComplete':
    case 'AwaitingDepartment':
      return 'in-progress';
    case 'OnHold':
    case 'Escalated':
      return 'on-hold';
    case 'Rejected':
      return 'rejected';
    case 'Locked':
    case 'NotStarted':
    default:
      return 'not-started';
  }
}

/** Completion progress → unified status for a step/section rollup. */
export function statusFromProgress(
  completed: number,
  total: number,
  blockers = 0,
): PreOpStatus {
  if (blockers > 0) return 'blocked';
  if (total === 0 || completed === 0) return 'not-started';
  if (completed >= total) return 'completed';
  return 'in-progress';
}
