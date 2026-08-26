/**
 * Ward Pre-Op Workspace v2 — 8-step information architecture aligned to S-05 mockup.
 *
 * Mockup order (s-05-preop-workspace.html):
 *   Admit → Clinical evaluation → Consent → Investigations → PAC →
 *   Department clearance → Fasting & medication → Coverage & finance
 *
 * `records` (Nursing & Records) remains as a post-admission care surface after Coverage.
 * Department clearance maps to the live `bedside` key (ward safety + OT Preparation).
 */
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Building2,
  FileSignature,
  HeartPulse,
  ListChecks,
  Microscope,
  Stethoscope,
  Utensils,
  Wallet,
} from 'lucide-react';
import { CoveragePaymentTerms } from '@/lib/ip-management/coverage-payment-terminology';

export type PreOpStepKey =
  | 'admit'
  | 'evaluation'
  | 'consent'
  | 'investigations'
  | 'pac'
  | 'bedside'
  | 'fasting'
  | 'financial'
  | 'records';

export interface PreOpStepMeta {
  key: PreOpStepKey;
  /** 1-based position. */
  index: number;
  /** Circled numeral for the rail. */
  numeral: string;
  label: string;
  short: string;
  icon: LucideIcon;
  /** §2 Department Clearance categories rendered in this step. */
  clearanceCategories?: string[];
  /** Step is locked until the patient is admitted. */
  admissionGated?: boolean;
  /**
   * Hide the step entirely from the rail while the patient is `Expected`.
   */
  hideUntilAdmitted?: boolean;
  /**
   * @deprecated Prefer always-visible admit with bed summary after admission.
   * Retained for callers that still branch on expectedOnly.
   */
  expectedOnly?: boolean;
  /** Renders the Admit / Admission & bed panel. */
  admitStep?: boolean;
  /** Renders the §1 Investigations panel. */
  investigations?: boolean;
  /** Renders the PAC assessment form. */
  pac?: boolean;
  /** Renders the §3 Ward Safety checklist / department clearance. */
  wardSafety?: boolean;
  /** Renders the care tabs (Vitals / Med Log / Nurse / Remark). */
  careStep?: boolean;
}

const NUMERALS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

export const PREOP_STEPS: PreOpStepMeta[] = [
  {
    key: 'admit',
    index: 1,
    numeral: NUMERALS[0],
    label: 'Admission & bed',
    short: 'Admit',
    icon: Building2,
    admitStep: true,
  },
  {
    key: 'evaluation',
    index: 2,
    numeral: NUMERALS[1],
    label: 'Clinical Evaluation',
    short: 'Evaluation',
    icon: Stethoscope,
    clearanceCategories: ['Evaluation'],
    admissionGated: true,
    hideUntilAdmitted: true,
  },
  {
    key: 'consent',
    index: 3,
    numeral: NUMERALS[2],
    label: 'Consent',
    short: 'Consent',
    icon: FileSignature,
  },
  {
    key: 'investigations',
    index: 4,
    numeral: NUMERALS[3],
    label: 'Investigations',
    short: 'Labs',
    icon: Microscope,
    investigations: true,
  },
  {
    key: 'pac',
    index: 5,
    numeral: NUMERALS[4],
    label: 'PAC Assessment',
    short: 'PAC',
    icon: HeartPulse,
    pac: true,
    admissionGated: true,
    hideUntilAdmitted: true,
  },
  {
    key: 'bedside',
    index: 6,
    numeral: NUMERALS[5],
    label: 'Department clearance',
    short: 'Clearance',
    icon: ListChecks,
    wardSafety: true,
    clearanceCategories: ['OT Preparation'],
    admissionGated: true,
    hideUntilAdmitted: true,
  },
  {
    key: 'fasting',
    index: 7,
    numeral: NUMERALS[6],
    label: 'Fasting & Medication',
    short: 'Fasting',
    icon: Utensils,
    clearanceCategories: ['Pharmacy Preparation'],
  },
  {
    key: 'financial',
    index: 8,
    numeral: NUMERALS[7],
    label: CoveragePaymentTerms.coverageAndPaymentStatus,
    short: 'Coverage',
    icon: Wallet,
  },
  {
    key: 'records',
    index: 9,
    numeral: NUMERALS[8],
    label: 'Nursing & Records',
    short: 'Nursing',
    icon: Activity,
    careStep: true,
    admissionGated: true,
    hideUntilAdmitted: true,
  },
];

export const PREOP_STEP_KEYS = PREOP_STEPS.map(s => s.key);

export function getPreOpStep(key: PreOpStepKey): PreOpStepMeta {
  return PREOP_STEPS.find(s => s.key === key) ?? PREOP_STEPS[0];
}

/** A step is locked while the patient is still in `Expected` if it is admission-gated. */
export function isStepLocked(step: PreOpStepMeta, clinicalState: string): boolean {
  return !!step.admissionGated && clinicalState === 'Expected';
}

/**
 * Rail visibility per clinical state:
 *  - `hideUntilAdmitted` steps hide while `Expected`.
 *  - Admit / Consent / Investigations / Fasting / Coverage stay visible pre-admit.
 */
export function isStepHidden(step: PreOpStepMeta, clinicalState: string): boolean {
  if (step.expectedOnly) return clinicalState !== 'Expected';
  return !!step.hideUntilAdmitted && clinicalState === 'Expected';
}

/** Steps visible in the rail for the given clinical state. */
export function visiblePreOpSteps(clinicalState: string): PreOpStepMeta[] {
  return PREOP_STEPS.filter(s => !isStepHidden(s, clinicalState));
}

export interface RoleDefaultInput {
  primaryDeptCode?: string;
  canEditPac?: boolean;
  canEnterInvestigation?: boolean;
  canEditWardChecklist?: boolean;
  clinicalState: string;
}

/**
 * Role-adaptive default step: open on the step the logged-in role owns.
 * Expected patients land on Admission & bed.
 */
export function defaultStepForRole(input: RoleDefaultInput): PreOpStepKey {
  if (input.clinicalState === 'Expected') return 'admit';

  const dept = (input.primaryDeptCode ?? '').toUpperCase();

  const unlockedOr = (key: PreOpStepKey, fallback: PreOpStepKey = 'investigations'): PreOpStepKey =>
    isStepLocked(getPreOpStep(key), input.clinicalState) ? fallback : key;

  if (
    /ANAE|ANES/.test(dept)
    || (input.canEditPac && !input.canEnterInvestigation && !input.canEditWardChecklist)
  ) {
    return unlockedOr('pac');
  }
  if (/BILL|FINAN|ACCOUNT|CASH|TPA/.test(dept)) return 'financial';
  if (/THEATRE|THEATER|(^|[^A-Z])OT([^A-Z]|$)/.test(dept)) return unlockedOr('bedside');

  return 'investigations';
}

// ─── Legacy → v2 deep-link mapping ──────────────────────────────────────────────

export type LegacyTopTab = 'wardChecklist' | 'vitals' | 'medLog' | 'nurseRecords' | 'remark';
export type LegacyChecklistSection = 'p0' | 'investigations' | 'clearance' | 'wardSafety' | 'pac';
export type CareTab = 'vitals' | 'medLog' | 'nurseRecords' | 'remark';

const CARE_TABS: ReadonlySet<string> = new Set(['vitals', 'medLog', 'nurseRecords', 'remark']);

/** Maps a legacy (topTab, section) deep-link to the v2 step it now lives in. */
export function legacyToStep(
  topTab: LegacyTopTab | undefined,
  section: LegacyChecklistSection | undefined,
): PreOpStepKey {
  if (topTab && CARE_TABS.has(topTab)) return 'records';
  switch (section) {
    case 'clearance':
      return 'evaluation';
    case 'wardSafety':
      return 'bedside';
    case 'pac':
      return 'pac';
    case 'p0':
    case 'investigations':
    default:
      return 'investigations';
  }
}

/** Care sub-tab implied by a legacy top tab (defaults to vitals). */
export function legacyCareTab(topTab: LegacyTopTab | undefined): CareTab {
  return topTab && CARE_TABS.has(topTab) ? (topTab as CareTab) : 'vitals';
}
