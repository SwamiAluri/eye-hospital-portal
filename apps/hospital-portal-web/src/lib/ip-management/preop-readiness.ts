/**
 * Ward Pre-Op Workspace v2 — per-step readiness rollup (Phase 13).
 *
 * Single source of "what's blocking surgery": one computation that powers both the
 * sticky readiness bar (blueprint §5/§1) and the per-step counts in the step rail
 * (§5/§7). Each clinical step reports {completed, total, blocking, status} derived
 * from the canonical records it owns — never re-counted per panel.
 *
 * Pure + framework-free so it can be unit-tested. The workspace modal prefers the
 * backend rollup (Phase 8 / GET …/pre-op/readiness); this function is the fallback.
 */
import type {
  PacAssessmentDto,
  PreOpClearanceDetailDto,
  PreOpCompletionDto,
  WardChecklistDto,
  WardInvestigationChecklistDto,
} from '@/lib/api/ip-management.api';
import {
  statusFromProgress,
  statusFromSectionStatus,
  type PreOpStatus,
} from './preop-status';
import { PREOP_STEPS, isStepLocked, type PreOpStepKey } from './preop-steps';
import { BEDSIDE_NURSE_WARD_KEYS, BEDSIDE_NURSE_REHOMED_KEYS } from './bedside-items';

export interface StepReadiness {
  key: PreOpStepKey;
  completed: number;
  total: number;
  /** Incomplete mandatory (blocking) items. */
  blocking: number;
  status: PreOpStatus;
  locked: boolean;
  /**
   * False when a step has no countable checklist (e.g. Nursing & Records, Admit).
   * Such steps are excluded from the "X of N steps ready" denominator and render a
   * muted "not-counted" marker in the rail instead of a count chip (Phase 1 / D2).
   */
  hasCount: boolean;
}

export interface PreOpReadiness {
  steps: StepReadiness[];
  byKey: Record<PreOpStepKey, StepReadiness>;
  /** Steps fully complete (of the countable ones). */
  readySteps: number;
  /** Denominator = steps that have a definite completion notion. */
  countableSteps: number;
  /** Total incomplete mandatory items across all unlocked steps. */
  blockers: number;
}

const PAID_FINANCIAL_STATES = ['Paid', 'Settled', 'Confirmed'];

interface CategoryCount {
  completed: number;
  total: number;
  blocking: number;
}

/** Count clearance completions for a set of §2 categories (blocking pool preferred). */
function countByCategories(
  completions: PreOpCompletionDto[],
  categories: string[],
): CategoryCount {
  const items = completions.filter(
    c =>
      categories.includes(c.category)
      && c.formCode !== 'WARD_CHECKLIST'
      && c.formCode !== 'WARD_INVESTIGATION_PREOP',
  );
  const blockingItems = items.filter(i => i.isBlocking);
  const pool = blockingItems.length > 0 ? blockingItems : items;
  const completed = pool.filter(i => i.isCompleted || i.isBypassed).length;
  return {
    completed,
    total: pool.length,
    blocking: blockingItems.filter(i => !(i.isCompleted || i.isBypassed)).length,
  };
}

function sectionStatusFor(
  detail: PreOpClearanceDetailDto | null,
  category: string,
): string | undefined {
  return detail?.sectionClearances?.find(s => s.sectionCategory === category)?.status;
}

function deriveStatus(
  locked: boolean,
  completed: number,
  total: number,
  sectionStatus?: string,
): PreOpStatus {
  if (locked) return 'not-started';
  if (sectionStatus && sectionStatus !== 'NotRequested') {
    return statusFromSectionStatus(sectionStatus);
  }
  return statusFromProgress(completed, total, 0);
}

export interface ReadinessInputs {
  detail: PreOpClearanceDetailDto | null;
  investigation?: WardInvestigationChecklistDto | null;
  ward?: WardChecklistDto | null;
  pac?: PacAssessmentDto | null;
  financialState?: string;
  clinicalState: string;
}

export function computePreOpReadiness(input: ReadinessInputs): PreOpReadiness {
  const { detail, investigation, ward, pac, financialState, clinicalState } = input;
  const completions = detail?.completions ?? [];

  const steps: StepReadiness[] = PREOP_STEPS.map(meta => {
    const locked = isStepLocked(meta, clinicalState);

    switch (meta.key) {
      case 'investigations': {
        const applicable = (investigation?.items ?? []).filter(i => i.appliesToJourney);
        const completed = applicable.filter(
          i => i.isBypassed || (i.isCompleted && (i.resultValue?.trim()?.length ?? 0) > 0),
        ).length;
        const total = applicable.length;
        // Unverified critical labs are real pre-op blockers (§9.5 / §16 Critical).
        const blocking = locked ? 0 : (investigation?.unverifiedCriticalKeys?.length ?? 0);
        return {
          key: meta.key,
          completed,
          total,
          blocking,
          status: locked ? 'not-started' : statusFromProgress(completed, total, 0),
          locked,
          hasCount: total > 0,
        };
      }

      case 'anaesthesia': {
        // PAC completion is the anaesthesia source of truth (§12 / D11).
        const done = pac?.assessmentStatus === 'Completed' ? 1 : 0;
        const started = !!pac && !!pac.assessmentStatus && pac.assessmentStatus !== 'NotStarted';
        const status: PreOpStatus = locked
          ? 'not-started'
          : done
            ? 'completed'
            : started
              ? 'in-progress'
              : 'not-started';
        return {
          key: meta.key,
          completed: done,
          total: 1,
          blocking: locked || done ? 0 : 1,
          status,
          locked,
          hasCount: true,
        };
      }

      case 'evaluation': {
        const c = countByCategories(completions, ['Evaluation']);
        const status = deriveStatus(locked, c.completed, c.total, sectionStatusFor(detail, 'Evaluation'));
        return { key: meta.key, ...c, blocking: locked ? 0 : c.blocking, status, locked, hasCount: c.total > 0 };
      }

      case 'consent': {
        const c = countByCategories(completions, ['Consent']);
        return {
          key: meta.key,
          ...c,
          blocking: locked ? 0 : c.blocking,
          status: deriveStatus(locked, c.completed, c.total),
          locked,
          hasCount: c.total > 0,
        };
      }

      case 'financial': {
        const c = countByCategories(completions, ['Financial']);
        // Fallback to the canonical financial state when no writer items are configured.
        if (c.total === 0 && financialState) {
          const paid = PAID_FINANCIAL_STATES.includes(financialState);
          return {
            key: meta.key,
            completed: paid ? 1 : 0,
            total: 1,
            blocking: 0,
            status: paid ? 'completed' : 'in-progress',
            locked,
            hasCount: true,
          };
        }
        return {
          key: meta.key,
          ...c,
          blocking: locked ? 0 : c.blocking,
          status: deriveStatus(locked, c.completed, c.total),
          locked,
          hasCount: c.total > 0,
        };
      }

      case 'fasting': {
        const c = countByCategories(completions, ['Compliance', 'Pharmacy Preparation']);
        return {
          key: meta.key,
          ...c,
          blocking: locked ? 0 : c.blocking,
          status: deriveStatus(locked, c.completed, c.total),
          locked,
          hasCount: c.total > 0,
        };
      }

      case 'bedside': {
        // Option B: the bedside step counts only the true nurse acts (the former WHO
        // sign-in/readiness mirror rows were removed — those live on their source steps
        // and the OT Surgical Safety Checklist). Nurse ward acts + re-homed prep + the
        // OT Preparation clearance combine into the bedside gate.
        const ot = countByCategories(completions, ['OT Preparation']);
        const nurseWard = (ward?.items ?? []).filter(
          i => BEDSIDE_NURSE_WARD_KEYS.has(i.itemKey) && i.appliesToJourney !== false,
        );
        const rehomed = completions.filter(c => BEDSIDE_NURSE_REHOMED_KEYS.has(c.itemKey));
        const nurseCompleted =
          nurseWard.filter(i => i.isCompleted || i.isBypassed).length
          + rehomed.filter(c => c.isCompleted || c.isBypassed).length;
        const nurseTotal = nurseWard.length + rehomed.length;
        const completed = nurseCompleted + ot.completed;
        const total = nurseTotal + ot.total;
        return {
          key: meta.key,
          completed,
          total,
          blocking: locked ? 0 : ot.blocking,
          status: locked ? 'not-started' : statusFromProgress(completed, total, 0),
          locked,
          hasCount: total > 0,
        };
      }

      case 'admit': {
        // The Admit step is an action, not a checklist — never counted toward readiness.
        return {
          key: meta.key,
          completed: 0,
          total: 0,
          blocking: 0,
          status: 'in-progress',
          locked: false,
          hasCount: false,
        };
      }

      case 'records':
      default: {
        // Nursing & Records has no checklist; it is an ongoing care surface.
        return {
          key: meta.key,
          completed: 0,
          total: 0,
          blocking: 0,
          status: locked ? 'not-started' : 'in-progress',
          locked,
          hasCount: false,
        };
      }
    }
  });

  const byKey = Object.fromEntries(steps.map(s => [s.key, s])) as Record<PreOpStepKey, StepReadiness>;
  // Locked (admission-gated) steps are dropped from the denominator pre-admit so the
  // readiness reads against only the steps the user can actually work on now. They are
  // still surfaced via the "N unlock after admission" hint in the readiness bar.
  const countable = steps.filter(s => s.hasCount && !s.locked);
  const readySteps = countable.filter(s => s.status === 'completed').length;
  const blockers = steps.reduce((n, s) => n + s.blocking, 0);

  return {
    steps,
    byKey,
    readySteps,
    countableSteps: countable.length,
    blockers,
  };
}
