import type { OpdBill, OpdBillPayment } from '@/lib/api/opd-billing.api';
import type { PatientJourneyRowDto } from '@/lib/api/ip-management.api';
import { normalizeSourceType } from './group-bill-items';

export const WORKSTATION_TEST_IDS = {
  root: 'ip-billing-workstation',
  search: 'ip-billing-patient-search',
  context: 'ip-billing-patient-context',
  summary: 'ip-billing-financial-summary',
  charges: 'ip-billing-charge-detail',
  payments: 'ip-billing-payment-history',
  status: 'ip-billing-financial-status',
  nextAction: 'ip-billing-next-action',
  empty: 'ip-billing-empty',
  noBill: 'ip-billing-no-bill',
  refresh: 'ip-billing-refresh',
  asOf: 'ip-billing-as-of',
  actions: 'ip-billing-actions',
  payerShare: 'ip-billing-payer-share',
  patientShare: 'ip-billing-patient-share',
  completeness: 'ip-billing-completeness',
} as const;

export type WorkstationFinancialSummary = {
  charges: number;
  packageAmount: number | null;
  adjustments: number;
  advance: number | null;
  paid: number;
  due: number;
  /** Coverage projection — not the cash ledger. */
  payerShare: number | null;
  patientShare: number | null;
};

export type WorkstationPatientContext = {
  patientName: string;
  uhid: string | null;
  age: number | null;
  sex: string | null;
  journeyId: string | null;
  encounterKind: 'ip' | 'opd';
  admittedAt: string | null;
  procedureName: string | null;
  laterality: string | null;
  surgeonName: string | null;
  payerMode: string | null;
  packageAmount: number | null;
  financialState: string | null;
  billNumber: string | null;
};

export type IpFinancialSummarySlice = {
  packageEstimate?: number;
  advances?: number;
  billedAmount?: number;
  totalCollected?: number;
  balanceDue?: number;
  financialStatus?: string;
  discountTotal?: number;
  patientResponsibility?: number;
  insuranceResponsibility?: number;
} | null;

/**
 * Prefer the OpdBill ledger for billed / paid / due.
 * Package and advance are presentation-only when IP summary or payment kinds exist.
 */
export function summarizeWorkstation(
  bill: OpdBill,
  extras?: {
    packageAmount?: number | null;
    ipSummary?: IpFinancialSummarySlice;
  },
): WorkstationFinancialSummary {
  const advanceFromPayments = sumAdvanceFromPayments(bill.payments);
  const packageAmount =
    extras?.packageAmount != null && extras.packageAmount > 0
      ? extras.packageAmount
      : extras?.ipSummary?.packageEstimate != null && extras.ipSummary.packageEstimate > 0
        ? extras.ipSummary.packageEstimate
        : null;

  const payerShare = coverageMoney(extras?.ipSummary?.insuranceResponsibility)
    ?? (bill.isInsurance ? Number(bill.insuranceClaimAmount) || 0 : null);
  const patientShare = coverageMoney(extras?.ipSummary?.patientResponsibility);

  return {
    charges: Number(bill.netAmount) || 0,
    packageAmount,
    adjustments: Number(bill.discountAmount) || 0,
    advance: advanceFromPayments ?? extras?.ipSummary?.advances ?? null,
    paid: Number(bill.amountPaid) || 0,
    due: Number(bill.balanceDue) || 0,
    payerShare,
    patientShare,
  };
}

function coverageMoney(value: number | undefined | null): number | null {
  if (value == null || Number.isNaN(Number(value))) return null;
  return Number(value);
}

/** Sum Advance rows only when the server labelled them. Do not guess Payment vs Advance. */
export function sumAdvanceFromPayments(payments: OpdBillPayment[] | undefined): number | null {
  if (!payments?.length) return null;
  const labelled = payments.filter((p) => p.paymentKind === 'Advance' || p.paymentKind === 'Payment');
  if (labelled.length === 0) return null;
  const advance = labelled
    .filter((p) => p.paymentKind === 'Advance')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  return advance;
}

export function buildWorkstationContext(input: {
  bill?: OpdBill | null;
  journey?: PatientJourneyRowDto | null;
}): WorkstationPatientContext {
  const { bill, journey } = input;
  const journeyId = bill?.patientJourneyId || journey?.id || null;
  const isIp = Boolean(journeyId);

  const payerFromBill = bill
    ? bill.isInsurance
      ? bill.insuranceProvider || 'Insurance'
      : null
    : null;

  return {
    patientName:
      journey?.patientName
      || bill?.patientName
      || 'Unknown patient',
    uhid: journey?.uhid ?? bill?.patientMrn ?? null,
    age: journey?.patientAge ?? null,
    sex: journey?.patientGender ?? null,
    journeyId,
    encounterKind: isIp ? 'ip' : 'opd',
    admittedAt: journey?.admittedAt ?? null,
    procedureName: journey?.procedureName ?? null,
    laterality: journey?.eyeOperated ?? null,
    surgeonName: journey?.surgeonName ?? null,
    payerMode: journey?.paymentMode || payerFromBill || (bill && !bill.isInsurance ? 'Self-pay' : null),
    packageAmount: journey?.packageAmount && journey.packageAmount > 0 ? journey.packageAmount : null,
    financialState: journey?.financialState ?? deriveFinancialStateFromBill(bill),
    billNumber: bill?.billNumber ?? null,
  };
}

export function deriveFinancialStateFromBill(bill?: OpdBill | null): string | null {
  if (!bill) return null;
  if (bill.isFinalized) return 'Settled';
  if (bill.status === 'cancelled') return 'Cancelled';
  const due = Number(bill.balanceDue) || 0;
  const paid = Number(bill.amountPaid) || 0;
  if (due > 0 && paid > 0) return 'PartiallyPaid';
  if (due > 0) return 'Unpaid';
  if (paid > 0) return 'Paid';
  return bill.status ?? null;
}

/** Presentation of existing sourceType — not a new package-inclusion ledger field. */
export function packageInclusionLabel(sourceType?: string | null): string {
  const n = normalizeSourceType(sourceType);
  if (n === 'Package' || n === 'PackageDiscount') return 'Package';
  return 'Extra';
}

export function pickJourneyForPatient<T extends { patientId?: string }>(
  journeys: T[],
  patientId: string,
): T | null {
  if (!patientId) return null;
  return journeys.find((j) => j.patientId === patientId) ?? null;
}

/**
 * Keep the current bill on screen only while Refresh reloads the same identity.
 * Switching billId / journeyId must not leave the previous patient's workstation visible.
 */
export function shouldRetainReadyBill(input: {
  currentBillId: string;
  currentJourneyId?: string | null;
  linkBillId?: string | null;
  linkJourneyId?: string | null;
}): boolean {
  if (input.linkBillId) return input.currentBillId === input.linkBillId;
  if (input.linkJourneyId) {
    return Boolean(input.currentJourneyId) && input.currentJourneyId === input.linkJourneyId;
  }
  return false;
}

export function pickBillForPatient(bills: OpdBill[]): OpdBill | null {
  const open = bills.filter((b) => b.status !== 'cancelled');
  if (open.length === 0) return null;
  return [...open].sort((a, b) => {
    const aIp = a.patientJourneyId ? 1 : 0;
    const bIp = b.patientJourneyId ? 1 : 0;
    if (bIp !== aIp) return bIp - aIp;
    return new Date(b.billDate).getTime() - new Date(a.billDate).getTime();
  })[0] ?? null;
}

export function formatWorkstationInstant(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatWorkstationDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function ageSexLabel(age: number | null, sex: string | null): string {
  const parts: string[] = [];
  if (age != null && age >= 0) parts.push(`${age}y`);
  if (sex) parts.push(sex);
  return parts.length ? parts.join(' / ') : '—';
}
