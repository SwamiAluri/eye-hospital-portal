import type { CounselorLabOrderItem } from '@/lib/api/lab-orders.api';
import type { BiometryRecord } from '@/lib/api/biometry.api';
import type { PatientConsent } from '@/lib/api/patient-consents.api';
import type { CounsellorOutpatientItemDto } from '@/lib/api/ip-management.api';
import { isCoveragePaymentTypeValue } from '@/lib/counsellors-desk/session-utils';

export type IntegrationSource = 'lab' | 'optometry' | 'consent' | 'ccms' | 'payment' | 'doctors_desk';

export interface OutpatientIntegrationHint {
  itemKey: string;
  source: IntegrationSource;
  suggestedComplete: boolean;
  label: string;
  detail?: string;
}

export interface OutpatientIntegrationContext {
  patientId?: string;
  sessionId?: string;
  paymentType?: string;
  notRequiredPreAuth?: boolean;
  ccmsCurrentState?: string;
  packageRate?: number | '';
}

export interface OutpatientIntegrationData {
  labOrders: CounselorLabOrderItem[];
  biometry: BiometryRecord[];
  consents: PatientConsent[];
  optometryCompletedExams: string[];
  /** Read-only Doctors Desk signals for P0 hints. */
  doctorConsultCompleted?: boolean;
  physicianCardiacFitnessOnFile?: boolean;
}

/** Rollup card groupings for FinalizeOtModal — explicit P0 item keys (S8). */
export const OUTPATIENT_ROLLUP_GROUPS = {
  investigations: [
    'mo_advice_confirmed',
    'outpatient_serology_blood_tests',
    'physician_cardiac_fitness',
    'outpatient_ascan_confirmed',
    'fellow_workup_done',
    'other_eye_fundus_seen',
    'conj_culture_done',
    'one_eye_culture',
    'preop_hygiene_instructions',
    'anticoagulant_stopped',
    'patient_risk_labels',
  ],
  consent: ['outpatient_informed_consent'],
  payment: [] as string[],
  preAuth: [] as string[],
} as const;

/** Map rollup card keys → first outpatient item to scroll to. */
export const ROLLUP_DRILLDOWN_TARGETS: Record<string, string> = {
  investigations: 'outpatient_serology_blood_tests',
  consent: 'outpatient_informed_consent',
  payment: 'mo_advice_confirmed',
  preAuth: 'outpatient_serology_blood_tests',
};

const LAB_KEYWORDS: Record<string, string[]> = {
  outpatient_serology_blood_tests: ['hiv', 'hbsag', 'hbs', 'rbs', 'fbs', 'creatinine', 'urea', 'serology', 'blood'],
  physician_cardiac_fitness: ['ecg', 'echo', 'cardiac', 'fitness', 'physician'],
  conj_culture_done: ['culture', 'conj'],
  one_eye_culture: ['culture'],
};

function labMatchesKeywords(order: CounselorLabOrderItem, keywords: string[]): boolean {
  const hay = `${order.testName} ${order.testCode ?? ''}`.toLowerCase();
  return keywords.some(k => hay.includes(k));
}

function hasCompletedLab(orders: CounselorLabOrderItem[], keywords: string[]): boolean {
  return orders.some(o => o.status === 'Completed' && labMatchesKeywords(o, keywords));
}

function hasBiometry(biometry: BiometryRecord[]): boolean {
  return biometry.some(b => b.axialLength > 0);
}

function hasFundusExam(completedExams: string[]): boolean {
  const hay = completedExams.join(' ').toLowerCase();
  return hay.includes('fundus') || hay.includes('posterior') || hay.includes('retina');
}

function hasSurgeryConsent(consents: PatientConsent[]): boolean {
  return consents.some(c =>
    c.isGranted
    && c.status === 'active'
    && /surgery|surgical|procedure|treatment/i.test(`${c.consentType} ${c.consentName}`),
  );
}

function isInsurancePayment(paymentType?: string): boolean {
  return isCoveragePaymentTypeValue(paymentType);
}

function isPreAuthDone(ctx: OutpatientIntegrationContext): boolean {
  if (ctx.notRequiredPreAuth) return true;
  const state = (ctx.ccmsCurrentState ?? '').toLowerCase();
  return state.includes('approved') || state.includes('authorized') || state.includes('cleared');
}

function isPaymentReady(ctx: OutpatientIntegrationContext): boolean {
  if (!ctx.paymentType) return false;
  if (['Cash', 'Card', 'UPI', 'Free', 'Camp', 'Staff'].includes(ctx.paymentType)) {
    return ctx.packageRate !== '' && ctx.packageRate != null && Number(ctx.packageRate) >= 0;
  }
  if (isInsurancePayment(ctx.paymentType)) return isPreAuthDone(ctx);
  return false;
}

export function buildOutpatientIntegrationHints(
  data: OutpatientIntegrationData,
  ctx: OutpatientIntegrationContext,
): OutpatientIntegrationHint[] {
  const hints: OutpatientIntegrationHint[] = [];

  for (const [itemKey, keywords] of Object.entries(LAB_KEYWORDS)) {
    const done = hasCompletedLab(data.labOrders, keywords);
    if (done || data.labOrders.some(o => labMatchesKeywords(o, keywords))) {
      hints.push({
        itemKey,
        source: 'lab',
        suggestedComplete: done,
        label: done ? 'Lab complete' : 'Lab ordered',
        detail: data.labOrders
          .filter(o => labMatchesKeywords(o, keywords))
          .map(o => `${o.testName} (${o.status})`)
          .join(', '),
      });
    }
  }

  if (hasBiometry(data.biometry)) {
    hints.push({
      itemKey: 'outpatient_ascan_confirmed',
      source: 'optometry',
      suggestedComplete: true,
      label: 'Biometry on file',
      detail: `${data.biometry.length} A-scan/biometry record(s)`,
    });
  }

  if (hasFundusExam(data.optometryCompletedExams)) {
    hints.push({
      itemKey: 'other_eye_fundus_seen',
      source: 'optometry',
      suggestedComplete: true,
      label: 'Fundus exam documented',
    });
  }

  if (hasSurgeryConsent(data.consents)) {
    hints.push({
      itemKey: 'outpatient_informed_consent',
      source: 'consent',
      suggestedComplete: true,
      label: 'Consent on file',
    });
  }

  if (isPaymentReady(ctx)) {
    hints.push({
      itemKey: '__payment__',
      source: 'payment',
      suggestedComplete: true,
      label: 'Payment / package ready',
    });
  }

  if (isPreAuthDone(ctx)) {
    hints.push({
      itemKey: '__preauth__',
      source: 'ccms',
      suggestedComplete: true,
      label: ctx.notRequiredPreAuth ? 'Pre-auth not required' : 'Pre-auth cleared',
      detail: ctx.ccmsCurrentState ?? undefined,
    });
  }

  if (data.doctorConsultCompleted) {
    hints.push({
      itemKey: 'mo_advice_confirmed',
      source: 'doctors_desk',
      suggestedComplete: true,
      label: 'Doctor consultation documented',
    });
  }

  if (data.physicianCardiacFitnessOnFile) {
    hints.push({
      itemKey: 'physician_cardiac_fitness',
      source: 'doctors_desk',
      suggestedComplete: true,
      label: 'Physician / cardiac fitness on file',
    });
  }

  return hints;
}

export function hintForItem(
  hints: OutpatientIntegrationHint[],
  itemKey: string,
): OutpatientIntegrationHint | undefined {
  return hints.find(h => h.itemKey === itemKey);
}

export type RollupCardStatus = 'Done' | 'Pending' | 'NotRequired';

export interface RollupCardState {
  key: 'investigations' | 'payment' | 'consent' | 'preAuth';
  label: string;
  status: RollupCardStatus;
  completed: number;
  total: number;
}

export function computeRollupCards(
  items: CounsellorOutpatientItemDto[],
  hints: OutpatientIntegrationHint[],
  ctx: OutpatientIntegrationContext,
): RollupCardState[] {
  function groupPct(keys: readonly string[]): { completed: number; total: number; status: RollupCardStatus } {
    const group = items.filter(i => keys.includes(i.itemKey));
    const total = group.length;
    if (total === 0) return { completed: 0, total: 0, status: 'NotRequired' };
    const completed = group.filter(i => i.isCompleted || i.isBypassed).length;
    const status: RollupCardStatus = completed === total ? 'Done' : 'Pending';
    return { completed, total, status };
  }

  const inv = groupPct(OUTPATIENT_ROLLUP_GROUPS.investigations);
  const con = groupPct(OUTPATIENT_ROLLUP_GROUPS.consent);

  const paymentHint = hints.find(h => h.itemKey === '__payment__');
  const preAuthHint = hints.find(h => h.itemKey === '__preauth__');

  const paymentStatus: RollupCardStatus = !ctx.paymentType
    ? 'Pending'
    : isInsurancePayment(ctx.paymentType)
      ? (isPreAuthDone(ctx) ? 'Done' : 'Pending')
      : (paymentHint?.suggestedComplete ? 'Done' : 'Pending');

  // Display rollup only — admit / coverage transitions are backend-owned (CCMS + IP).
  const preAuthStatus: RollupCardStatus = !isInsurancePayment(ctx.paymentType)
    ? 'NotRequired'
    : (preAuthHint?.suggestedComplete ? 'Done' : 'Pending');

  return [
    { key: 'investigations', label: 'Investigations', status: inv.status, ...inv },
    { key: 'payment', label: 'Patient Payment Status', status: paymentStatus, completed: paymentStatus === 'Done' ? 1 : 0, total: 1 },
    { key: 'consent', label: 'Consent', status: con.status, ...con },
    { key: 'preAuth', label: 'Authorization Status', status: preAuthStatus, completed: preAuthStatus === 'Done' ? 1 : 0, total: isInsurancePayment(ctx.paymentType) ? 1 : 0 },
  ];
}
