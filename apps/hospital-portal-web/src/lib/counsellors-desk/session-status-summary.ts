import type { AdmissionValidation } from '@/lib/api/ccms/ccms-coverage-cases.api';
import { getStateLabel } from '@/lib/api/ccms/ccms-state-labels';
import type {
  CounsellingPhase,
  CounsellingPhaseCompletion,
} from '@/lib/counsellors-desk/counselling-progress';
import type { DecisionType, WaitingListStatus } from '@/types/counsellors-desk';

export type SessionMainTab = 'counselling' | 'coverage' | 'outpatient';

export type SummaryChipTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export interface SessionSummaryChip {
  id: string;
  label: string;
  value: string;
  tone: SummaryChipTone;
}

export interface SessionStatusSummary {
  /** Compact single-line status (headline + detail merged). */
  statusLine: string;
  /** @deprecated Use statusLine — kept for transitional callers. */
  headline: string;
  /** @deprecated Merged into statusLine. */
  detail?: string;
  nextAction: string;
  nextActionTab?: SessionMainTab;
  nextActionPhase?: CounsellingPhase;
  chips: SessionSummaryChip[];
}

const MAX_SUMMARY_CHIPS = 4;

export interface CoverageProgressSnapshot {
  uploadedDocCount: number;
  requiredDocCount: number;
  ccmsState?: string | null;
  preAuthSubmitted: boolean;
  canSubmitToClaims?: boolean;
  submittingToClaims?: boolean;
}

const PREAUTH_SUBMITTED_STATES = new Set([
  'PREAUTH_SENT',
  'WAITING_APPROVAL',
  'CLARIFICATION_REQUIRED',
  'RESUBMITTED',
  'APPROVED',
  'PARTIAL_APPROVAL',
  'REJECTED',
  'EXPIRED',
  'ADMISSION_READY',
  'ADMITTED',
  'SURGERY_SCHEDULED',
  'SURGERY_COMPLETED',
  'BILL_PENDING',
  'BILL_FINALIZED',
  'CLAIM_READY',
  'CLAIM_SUBMITTED',
  'CLAIM_IN_PROCESS',
  'SETTLEMENT_PENDING',
  'PARTIAL_SETTLEMENT',
  'FULL_SETTLEMENT',
  'RECONCILED',
  'CLOSED',
]);

export function isPreAuthSubmittedState(state?: string | null): boolean {
  if (!state) return false;
  return PREAUTH_SUBMITTED_STATES.has(state);
}

const QUEUE_HEADLINES: Record<WaitingListStatus, string> = {
  Pending: 'Waiting to start counselling',
  Processed: 'Counselling in progress',
  Done: 'Counselling completed',
  AddOnSurgery: 'Add-on surgery counselling',
  RepeatCounselling: 'Repeat counselling required',
  SurgeryDone: 'Surgery completed',
};

const DECISION_LABELS: Record<DecisionType, string> = {
  DateForSurgery: 'Surgery date agreed',
  Interested: 'Interested in surgery',
  NotInterested: 'Not interested',
  NeedsTime: 'Needs more time',
};

export function formatDecisionLabel(decision: DecisionType | ''): string {
  if (!decision) return 'Decision pending';
  return DECISION_LABELS[decision] ?? 'Decision recorded';
}

export function formatPayableLabel(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) {
    return 'Not quoted yet';
  }
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function formatDocumentProgressLabel(
  uploaded: number,
  required: number,
): { label: string; tone: SummaryChipTone } {
  if (required <= 0) {
    return { label: 'No required documents', tone: 'neutral' };
  }
  const missing = Math.max(0, required - uploaded);
  if (missing === 0) {
    return { label: 'All documents uploaded', tone: 'success' };
  }
  if (missing === 1) {
    return { label: '1 document missing', tone: 'warning' };
  }
  return { label: `${missing} documents missing`, tone: 'warning' };
}

const COVERAGE_DANGER_STATES = new Set([
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
  'ABORTED',
]);

const COVERAGE_SUCCESS_STATES = new Set(['APPROVED', 'PARTIAL_APPROVAL', 'ADMISSION_READY']);

const COVERAGE_INFO_STATES = new Set([
  'PREAUTH_SENT',
  'WAITING_APPROVAL',
  'RESUBMITTED',
  'ELIGIBILITY_VERIFIED',
  'POLICY_CAPTURED',
  'PREAUTH_GENERATED',
]);

function coverageToneForState(state: string): SummaryChipTone {
  if (COVERAGE_DANGER_STATES.has(state)) return 'danger';
  if (COVERAGE_SUCCESS_STATES.has(state)) return 'success';
  if (COVERAGE_INFO_STATES.has(state) || isPreAuthSubmittedState(state)) return 'info';
  return 'warning';
}

/** Counsellor-facing coverage status — machine titles only, never raw codes or prose. */
export function formatCounsellorCoverageStatus(args: {
  showCoverageWorkflow: boolean;
  notRequiredPreAuth: boolean;
  ccmsState?: string | null;
  preAuthSubmitted: boolean;
  admission?: AdmissionValidation | null;
}): { label: string; tone: SummaryChipTone } {
  if (!args.showCoverageWorkflow) {
    if (args.notRequiredPreAuth) {
      return { label: 'Pre-auth not required', tone: 'neutral' };
    }
    return { label: 'Cash / self-pay', tone: 'neutral' };
  }

  const state = args.ccmsState ?? args.admission?.coverageState ?? null;
  const isBlocked = args.admission?.decision === 'BLOCK';

  // Known CCMS states (including waiting) always win over admission BLOCK prose.
  if (state && state !== 'DRAFT') {
    return { label: getStateLabel(state), tone: coverageToneForState(state) };
  }

  if (args.preAuthSubmitted && state) {
    return { label: getStateLabel(state), tone: coverageToneForState(state) };
  }

  if (isBlocked) {
    return { label: 'Authorization Required', tone: 'danger' };
  }

  if (!state) {
    return { label: 'Not started', tone: 'warning' };
  }

  return { label: getStateLabel(state), tone: 'warning' };
}

export interface BuildSessionStatusSummaryInput {
  queueStatus: WaitingListStatus;
  activeMainTab: SessionMainTab;
  activePhase: CounsellingPhase;
  phaseCompletion: CounsellingPhaseCompletion;
  isRepeatState: boolean;
  isSurgeryDoneState: boolean;
  decision: DecisionType | '';
  paymentType: string;
  insuranceCompany: string;
  finalPayableAmount: number | null;
  showCoverageWorkflow: boolean;
  notRequiredPreAuth: boolean;
  coverageProgress: CoverageProgressSnapshot;
  admission?: AdmissionValidation | null;
}

function phaseHeadline(
  phaseCompletion: CounsellingPhaseCompletion,
  activePhase: CounsellingPhase,
  queueStatus: WaitingListStatus,
): string | null {
  if (queueStatus === 'Done') return 'Session complete';
  if (!phaseCompletion.estimate) return 'Build quote';
  if (!phaseCompletion.decision) {
    return activePhase === 'decision' ? 'Decision in progress' : 'Decision pending';
  }
  if (activePhase === 'wrapup') return 'Session notes';
  if (phaseCompletion.decision && phaseCompletion.wrapup) return 'Ready to save';
  return 'Quote complete · Decision recorded';
}

function buildStatusLine(headline: string, detail?: string): string {
  if (!detail) return headline;
  if (headline === detail) return headline;
  return `${headline} · ${detail}`;
}

function prioritizeSummaryChips(
  chips: SessionSummaryChip[],
  input: BuildSessionStatusSummaryInput,
): SessionSummaryChip[] {
  const { activeMainTab, showCoverageWorkflow, coverageProgress } = input;
  const { requiredDocCount } = coverageProgress;

  const omitDocumentsOnCoverageTab =
    activeMainTab === 'coverage' && showCoverageWorkflow && requiredDocCount > 0;

  const filtered = omitDocumentsOnCoverageTab
    ? chips.filter((chip) => chip.id !== 'documents')
    : chips;

  const priority: Record<string, number> = {
    decision: 1,
    payable: 2,
    documents: 3,
    coverage: 4,
    payment: 5,
  };

  return [...filtered]
    .sort((a, b) => (priority[a.id] ?? 99) - (priority[b.id] ?? 99))
    .slice(0, MAX_SUMMARY_CHIPS);
}

export function buildSessionStatusSummary(
  input: BuildSessionStatusSummaryInput,
): SessionStatusSummary {
  const {
    queueStatus,
    activePhase,
    phaseCompletion,
    isRepeatState,
    isSurgeryDoneState,
    decision,
    paymentType,
    insuranceCompany,
    finalPayableAmount,
    showCoverageWorkflow,
    notRequiredPreAuth,
    coverageProgress,
    admission,
  } = input;

  const { uploadedDocCount, requiredDocCount, ccmsState, preAuthSubmitted } = coverageProgress;

  const docProgress = formatDocumentProgressLabel(uploadedDocCount, requiredDocCount);
  const coverageStatus = formatCounsellorCoverageStatus({
    showCoverageWorkflow,
    notRequiredPreAuth,
    ccmsState,
    preAuthSubmitted,
    admission,
  });

  const allChips: SessionSummaryChip[] = [
    {
      id: 'payable',
      label: 'Payable',
      value: formatPayableLabel(finalPayableAmount),
      tone: finalPayableAmount && finalPayableAmount > 0 ? 'success' : 'neutral',
    },
    {
      id: 'decision',
      label: 'Decision',
      value: formatDecisionLabel(decision),
      tone: decision ? 'success' : 'warning',
    },
  ];

  if (paymentType) {
    allChips.push({
      id: 'payment',
      label: 'Payment',
      value: insuranceCompany?.trim()
        ? `${paymentType} · ${insuranceCompany}`
        : paymentType,
      tone: 'neutral',
    });
  }

  if (showCoverageWorkflow) {
    allChips.push({
      id: 'coverage',
      label: 'Coverage',
      value: coverageStatus.label,
      tone: coverageStatus.tone,
    });
  }

  if (showCoverageWorkflow && requiredDocCount > 0) {
    const docValue =
      requiredDocCount > 0
        ? `${uploadedDocCount}/${requiredDocCount}`
        : docProgress.label;
    allChips.push({
      id: 'documents',
      label: 'Documents',
      value: docValue,
      tone: docProgress.tone,
    });
  }

  const chips = prioritizeSummaryChips(allChips, input);

  if (isSurgeryDoneState) {
    const headline = QUEUE_HEADLINES.SurgeryDone;
    const detail = 'Read-only';
    return {
      statusLine: buildStatusLine(headline, detail),
      headline,
      detail,
      nextAction: 'No further actions',
      chips,
    };
  }

  if (isRepeatState) {
    const headline = QUEUE_HEADLINES.RepeatCounselling;
    const detail = 'Start repeat session to edit';
    return {
      statusLine: buildStatusLine(headline, detail),
      headline,
      detail,
      nextAction: '',
      chips,
    };
  }

  if (queueStatus === 'Done') {
    const headline = 'Session complete';
    return {
      statusLine: headline,
      headline,
      nextAction: '',
      chips,
    };
  }

  const phaseLine = phaseHeadline(phaseCompletion, activePhase, queueStatus);
  const headline = phaseLine ?? QUEUE_HEADLINES[queueStatus] ?? 'Counselling session';

  let nextAction = 'Continue current step';
  let nextActionTab: SessionMainTab | undefined = 'counselling';
  let nextActionPhase: CounsellingPhase | undefined = activePhase;

  if (!phaseCompletion.estimate) {
    nextAction = 'Build surgical quote';
    nextActionPhase = 'estimate';
  } else if (!phaseCompletion.decision) {
    nextAction = 'Complete patient decision';
    nextActionPhase = 'decision';
  } else if (showCoverageWorkflow && !preAuthSubmitted && !isPreAuthSubmittedState(ccmsState)) {
    const missingDocs = requiredDocCount > 0 && uploadedDocCount < requiredDocCount;
    if (!ccmsState || ccmsState === 'DRAFT') {
      nextAction = 'Insurance & Documents';
      nextActionTab = 'coverage';
      nextActionPhase = undefined;
    } else if (missingDocs) {
      nextAction = 'Upload missing documents';
      nextActionTab = 'coverage';
      nextActionPhase = undefined;
    } else if (
      ccmsState &&
      ['DRAFT', 'ELIGIBILITY_PENDING', 'ELIGIBILITY_VERIFIED', 'POLICY_CAPTURED'].includes(ccmsState)
    ) {
      nextAction = 'Submit to claims';
      nextActionTab = 'coverage';
      nextActionPhase = undefined;
    } else {
      nextAction = 'Insurance & Documents';
      nextActionTab = 'coverage';
      nextActionPhase = undefined;
    }
  } else if (preAuthSubmitted || isPreAuthSubmittedState(ccmsState)) {
    nextAction = '';
    nextActionTab = undefined;
    nextActionPhase = undefined;
  } else if (activePhase !== 'wrapup' && phaseCompletion.decision && !showCoverageWorkflow) {
    nextAction = 'Close';
    nextActionPhase = 'wrapup';
  } else if (phaseCompletion.decision) {
    nextAction = 'Save session';
    nextActionPhase = 'wrapup';
  }

  const detailParts: string[] = [];
  if (phaseCompletion.estimate) detailParts.push('Quote complete');
  if (phaseCompletion.decision) detailParts.push('Decision recorded');
  if (showCoverageWorkflow && (preAuthSubmitted || isPreAuthSubmittedState(ccmsState))) {
    detailParts.push(coverageStatus.label);
  }

  const detail = detailParts.length > 0 ? detailParts.join(' · ') : undefined;

  return {
    statusLine: buildStatusLine(headline, detail),
    headline,
    detail,
    nextAction,
    nextActionTab,
    nextActionPhase,
    chips,
  };
}
