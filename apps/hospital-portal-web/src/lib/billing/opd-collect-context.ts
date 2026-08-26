import type { OpdBill } from '@/lib/api/opd-billing.api';
import type { PatientJourneyRowDto } from '@/lib/api/ip-management.api';
import {
  collectiblePatientCap,
  type CollectFinSummary,
} from '@/lib/ip-management/collect-payment';

/** IP/Auth financial-summary fields used to project collectible patient due. */
export type IpCollectProjection = {
  patientBalance?: number | null;
  patientResponsibility?: number;
} | null;

/**
 * Map an OpdBill into the CollectPaymentDrawer summary shape.
 *
 * Collectible patient due matches the certified Auth cap:
 * min(PatientObligation.PatientBalance, OpdBill.BalanceDue).
 *
 * Ledger remaining (`balanceDue`) stays TPA-inclusive. Do not treat it as
 * patient due on IP copay bills. Prefer live IP `patientBalance` when present;
 * otherwise remaining share is billed − ICA − collected (cash OPD: equals due).
 */
export function finSummaryFromOpdBill(
  bill: OpdBill,
  ipSummary?: IpCollectProjection,
): CollectFinSummary {
  const billed = Number(bill.netAmount) || 0;
  const collected = Number(bill.amountPaid) || 0;
  const due = Number(bill.balanceDue) || 0;
  const payer = Number(bill.insuranceClaimAmount) || 0;
  const icaRemaining = Math.max(0, billed - payer - collected);
  const live = ipSummary?.patientBalance;
  const obligation = live != null && Number.isFinite(Number(live))
    ? Math.max(0, Number(live))
    : icaRemaining;
  const patientResponsibility = ipSummary?.patientResponsibility != null
    ? Math.max(0, Number(ipSummary.patientResponsibility))
    : Math.max(0, billed - payer);
  return {
    opdBillId: bill.id,
    billNumber: bill.billNumber,
    billedAmount: billed,
    insuranceResponsibility: payer,
    patientResponsibility,
    patientBalance: collectiblePatientCap(obligation, due),
    totalCollected: collected,
    balanceDue: due,
    isFinalized: Boolean(bill.isFinalized),
  };
}

/**
 * Identity stub so CollectPaymentDrawer can render without a census journey.
 * Never used to call ip-ensure: OPD callers pass canCreateBill={false}.
 */
export function collectJourneyFromOpdBill(bill: OpdBill): PatientJourneyRowDto {
  const due = Number(bill.balanceDue) || 0;
  const paid = Number(bill.amountPaid) || 0;
  return {
    id: bill.patientJourneyId || bill.id,
    patientId: bill.patientId,
    uhid: bill.patientMrn ?? null,
    patientName: bill.patientName ?? bill.billNumber ?? null,
    eyeOperated: null,
    procedureName: null,
    packageAmount: Number(bill.netAmount) || 0,
    totalPaid: paid,
    balanceDue: due,
    wardName: null,
    bedNumber: null,
    clinicalState: 'Admitted',
    otState: 'NotSent',
    financialState: bill.isFinalized ? 'Settled' : due > 0 ? 'PartiallyPaid' : 'Paid',
    postOpState: 'NotStarted',
    admittedAt: null,
    surgeryScheduledAt: null,
    isLocked: false,
    isBillingLocked: false,
    admissionType: null,
    patientGender: null,
    patientDob: null,
    patientAge: null,
    paymentMode: bill.isInsurance ? 'Insurance' : null,
    isEmergencyFc: false,
    emergencyFcReason: null,
    otReturnReason: null,
    counselingSessionId: null,
    otDetailsSaved: false,
  };
}
