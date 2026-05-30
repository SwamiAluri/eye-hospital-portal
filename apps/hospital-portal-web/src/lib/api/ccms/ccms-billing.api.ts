// CCMS – Billing Integration API client
import { getCcmsApi } from './ccms-base';

// ── Entities (mirror backend CcmsBillingSummary / CcmsCoverageAllocation) ─────

export interface BillingSummary {
  id: string;
  coverageCase_Id: string;
  billId?: string;
  billDate?: string;
  totalBillAmount: number;
  insuranceShareAmount: number;
  patientShareAmount: number;
  copayAmount: number;
  deductibleAmount: number;
  disallowedAmount: number;
  billItemsJson?: string;
}

export interface CoverageAllocation {
  id: string;
  billingSummaryId: string;
  lineItemType: string;
  lineItemCode?: string;
  lineItemDescription: string;
  billedAmount: number;
  coveredAmount: number;
  disallowedAmount: number;
  disallowedReason?: string;
  patientPayable: number;
}

/** Full response including allocations (from /billing/full). */
export interface BillingWithAllocations {
  summary: BillingSummary;
  allocations: CoverageAllocation[];
}

// ── Request types ─────────────────────────────────────────────────────────────

export interface BillLineItemRequest {
  type: string;
  code?: string;
  description: string;
  billedAmount: number;
  isExcluded: boolean;
  disallowedReason?: string;
}

export interface AllocateBillRequest {
  billId?: string;
  billDate?: string;
  totalBillAmount: number;
  copayPercent?: number;
  deductibleAmount?: number;
  lineItems?: BillLineItemRequest[];
  notes?: string;
}

// ── API functions ─────────────────────────────────────────────────────────────

/** Submit / update bill allocation. */
export async function allocateBill(caseId: string, req: AllocateBillRequest): Promise<BillingSummary> {
  const { data } = await getCcmsApi().post(
    `/ccms/coverage-cases/${caseId}/billing/allocate`, req
  );
  return data;
}

/** Fetch allocation summary (without line items). */
export async function getAllocation(caseId: string): Promise<BillingSummary | null> {
  try {
    const { data } = await getCcmsApi().get(`/ccms/coverage-cases/${caseId}/billing`);
    return data ?? null;
  } catch {
    return null;
  }
}

/** Fetch full allocation with all line items (preferred). */
export async function getBillingFull(caseId: string): Promise<BillingWithAllocations | null> {
  try {
    const { data } = await getCcmsApi().get(`/ccms/coverage-cases/${caseId}/billing/full`);
    return data ?? null;
  } catch {
    return null;
  }
}

export interface ImportedBillDraft {
  billId?: string;
  billDate?: string;
  totalBillAmount: number;
  lineItems: { type: string; description: string; billedAmount: number; isExcluded: boolean }[];
  sourceJourneyId?: string;
  sourceSessionId?: string;
  rowCount: number;
}

/** Import bill lines from IP billing transactions. Returns a draft for the AllocateBillModal. */
export async function importBillLines(
  caseId: string,
  opts?: { billId?: string; journeyId?: string; sessionId?: string },
): Promise<ImportedBillDraft> {
  const { data } = await getCcmsApi().post(
    `/ccms/coverage-cases/${caseId}/billing/import-from-bill`,
    opts ?? {},
  );
  return data;
}
