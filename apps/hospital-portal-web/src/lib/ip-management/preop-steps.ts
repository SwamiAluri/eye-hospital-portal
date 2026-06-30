/**
 * Ward Pre-Op Workspace v2 — 8-step information architecture (Phase 3).
 *
 * Single navigation model that replaces the legacy two-tier nav (phase strip +
 * "Ward Checklist" sub-tabs + care top-tabs) and removes the P0 Outpatient tab.
 * See docs/ward-preop-redesign-phase0-mapping.md §2 (8-step model) + D16.
 *
 * Each step is the *home* for a set of single-writer facts. §2 Department Clearance
 * is re-sliced by category across steps ②–⑦ (rendered via DepartmentClearancePanel's
 * `categoryFilter`); the deep per-step panel redesigns land in Phases 4–9.
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

export type PreOpStepKey =
  | 'investigations'
  | 'evaluation'
  | 'anaesthesia'
  | 'consent'
  | 'financial'
  | 'fasting'
  | 'bedside'
  | 'admit'
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
   * Hide the step entirely from the rail while the patient is `Expected` (it reappears
   * at `Admitted`). Used for admission-gated clearance steps that have nothing actionable
   * pre-admit, so we don't show a dead-end locked tab. Numerals stay stable.
   */
  hideUntilAdmitted?: boolean;
  /**
   * Show the step only while the patient is `Expected` (the inverse of
   * `hideUntilAdmitted`). Used for the Admit step, which is the action that moves the
   * patient out of `Expected` and therefore disappears once admitted.
   */
  expectedOnly?: boolean;
  /** Renders the inline Admit Patient form. */
  admitStep?: boolean;
  /** Renders the §1 Investigations panel. */
  investigations?: boolean;
  /** Renders the PAC assessment form. */
  pac?: boolean;
  /** Renders the §3 Ward Safety checklist. */
  wardSafety?: boolean;
  /** Renders the care tabs (Vitals / Med Log / Nurse / Remark). */
  careStep?: boolean;
}

const NUMERALS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];

export const PREOP_STEPS: PreOpStepMeta[] = [
  {
    key: 'investigations',
    index: 1,
    numeral: NUMERALS[0],
    label: 'Investigations',
    short: 'Labs',
    icon: Microscope,
    investigations: true,
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
    key: 'anaesthesia',
    index: 3,
    numeral: NUMERALS[2],
    label: 'Anaesthesia & PAC',
    short: 'PAC',
    icon: HeartPulse,
    pac: true,
    clearanceCategories: ['Anaesthesia'],
    admissionGated: true,
    hideUntilAdmitted: true,
  },
  {
    key: 'consent',
    index: 4,
    numeral: NUMERALS[3],
    label: 'Consent & Authorization',
    short: 'Consent',
    icon: FileSignature,
    // §2 "Consent" category is owned by ConsentAuthorizationPanel (Phase 5 merge),
    // not the generic DepartmentClearancePanel — see WardPreOpWorkspaceModal.
  },
  {
    key: 'financial',
    index: 5,
    numeral: NUMERALS[4],
    label: 'Financial',
    short: 'Financial',
    icon: Wallet,
    // §2 "Financial" category is owned by FinancialClearancePanel (Phase 6 single source),
    // not the generic DepartmentClearancePanel — see WardPreOpWorkspaceModal.
  },
  {
    key: 'fasting',
    index: 6,
    numeral: NUMERALS[5],
    label: 'Fasting & Medication',
    short: 'Fasting',
    icon: Utensils,
    // §2 "Compliance" is owned by FastingMedicationPanel (Phase 7); "Pharmacy Preparation"
    // stays a real departmental category rendered alongside it — see WardPreOpWorkspaceModal.
    clearanceCategories: ['Pharmacy Preparation'],
  },
  {
    key: 'bedside',
    index: 7,
    numeral: NUMERALS[6],
    label: 'Pre-OT Prep',
    short: 'Prep',
    icon: ListChecks,
    wardSafety: true,
    clearanceCategories: ['OT Preparation'],
  },
  {
    key: 'admit',
    index: 8,
    numeral: NUMERALS[7],
    label: 'Admit Patient',
    short: 'Admit',
    icon: Building2,
    admitStep: true,
    // The Admit form is its own rail entry below Pre-OT Prep, visible only while the
    // patient is Expected — admitting them removes this step and unlocks the care steps.
    expectedOnly: true,
  },
  {
    key: 'records',
    index: 9,
    numeral: NUMERALS[7],
    label: 'Nursing & Records',
    short: 'Nursing',
    icon: Activity,
    careStep: true,
    admissionGated: true,
    // Vitals/Med-Log/Nurse records are a post-admission care surface — hide the dead-end
    // locked tab pre-admit (reappears at Admitted), matching Evaluation ②/Anaesthesia ③.
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
 *  - `expectedOnly` steps (Admit) show only while `Expected`.
 *  - `hideUntilAdmitted` steps (Evaluation/Anaesthesia/Records) hide while `Expected`.
 */
export function isStepHidden(step: PreOpStepMeta, clinicalState: string): boolean {
  if (step.expectedOnly) return clinicalState !== 'Expected';
  return !!step.hideUntilAdmitted && clinicalState === 'Expected';
}

/** Steps visible in the rail for the given clinical state (hides admission-only steps pre-admit). */
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
 * Role-adaptive default step (blueprint §20): open the workspace on the step the
 * logged-in role owns — anaesthetist → PAC, billing → Financial, OT → Bedside —
 * falling back to Investigations for ward/nurse roles. Never opens an admission-locked
 * step pre-admit; such picks fall back to Investigations.
 */
export function defaultStepForRole(input: RoleDefaultInput): PreOpStepKey {
  const dept = (input.primaryDeptCode ?? '').toUpperCase();

  const unlockedOr = (key: PreOpStepKey, fallback: PreOpStepKey = 'investigations'): PreOpStepKey =>
    isStepLocked(getPreOpStep(key), input.clinicalState) ? fallback : key;

  // Anaesthesia: explicit dept code or a PAC-only permission profile.
  if (
    /ANAE|ANES/.test(dept)
    || (input.canEditPac && !input.canEnterInvestigation && !input.canEditWardChecklist)
  ) {
    return unlockedOr('anaesthesia');
  }
  if (/BILL|FINAN|ACCOUNT|CASH|TPA/.test(dept)) return 'financial';
  if (/THEATRE|THEATER|(^|[^A-Z])OT([^A-Z]|$)/.test(dept)) return unlockedOr('bedside');

  return 'investigations';
}

// ─── Legacy → v2 deep-link mapping ──────────────────────────────────────────────
// Preserves existing callers (ward page row deep-links) that still pass the old
// top-tab + checklist-section pair.

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
      return 'anaesthesia';
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
