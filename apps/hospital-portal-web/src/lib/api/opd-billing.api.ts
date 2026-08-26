/**
 * OPD Billing API Service
 * Handles OPD bill generation, payments, billing rules
 * Part of Phase 1 OPD Workflow implementation
 */

import { getApi } from '../api';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface OpdBill {
  id: string;
  tenantId: string;
  patientId: string;
  appointmentId: string;
  branchId: string;
  billingRuleId?: string;
  billNumber: string;
  billDate: string;
  consultationFee: number;
  registrationFee: number;
  additionalCharges: number;
  grossAmount: number;
  discountPercentage: number;
  discountAmount: number;
  taxAmount: number;
  netAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: OpdBillStatus;
  isFreeVisit: boolean;
  freeVisitReason?: string;
  isCredit: boolean;
  creditApprovedBy?: string;
  creditApprovedAt?: string;
  creditNotes?: string;
  isInsurance: boolean;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceClaimAmount: number;
  patientName?: string;
  patientMrn?: string;
  patientJourneyId?: string;
  billItems?: OpdBillItem[];
  notes?: string;
  generatedBy: string;
  payments: OpdBillPayment[];
  // Phase 1 Critical Gates - Bill Finalization
  isFinalized: boolean;
  finalizedAt?: string;
  finalizedByUserId?: string;
  refundStatus?: 'none' | 'requested' | 'approved' | 'completed';
  refundAmount?: number;
  refundReason?: string;
  createdAt: string;
  updatedAt?: string;
}

export type OpdBillStatus = 
  | 'pending'
  | 'partial'
  | 'paid'
  | 'credit'
  | 'insurance_pending'
  | 'cancelled'
  | 'refunded';

export interface OpdBillItem {
  description: string;
  amount: number;
  quantity: number;
  discountable: boolean;
}

/** Line from GET /billitems/bill/{id} — BILL-030 grouped bill view. */
export interface BillChargeLine {
  id: string;
  opdBillId: string;
  serviceVariantId?: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discountAmount: number;
  discountPercentage: number;
  taxAmount: number;
  taxPercentage: number;
  totalAmount: number;
  status: string;
  notes?: string | null;
  serviceCode: string;
  serviceName: string;
  sourceType: string;
  sourceRefId?: string | null;
  idempotencyKey?: string | null;
  performedAt?: string | null;
}

export interface OpdBillPayment {
  id: string;
  opdBillId: string;
  paymentReference: string;
  paymentMode: PaymentMode;
  amount: number;
  paymentDate: string;
  cardType?: string;
  cardLastFour?: string;
  cardNetwork?: string;
  upiId?: string;
  upiTransactionId?: string;
  bankName?: string;
  chequeNumber?: string;
  insuranceClaimId?: string;
  insuranceResponse?: string;
  receivedBy?: string;
  receiptNumber?: string;
  /** Present when the Auth payment ledger recorded a kind (Payment, Advance, Discount, Refund). */
  paymentKind?: 'Payment' | 'Advance' | 'Discount' | 'Refund' | 'Reversal';
  status: PaymentStatus;
  notes?: string;
  createdAt: string;
}

export type PaymentMode = 
  | 'cash'
  | 'card'
  | 'upi'
  | 'net_banking'
  | 'cheque'
  | 'insurance'
  | 'wallet';

export type PaymentStatus = 
  | 'completed'
  | 'pending'
  | 'failed'
  | 'refunded'
  | 'cancelled';

export interface BillingRule {
  id: string;
  tenantId: string;
  branchId?: string;
  visitType: string;
  freeDays: number;
  freeVisits: number;
  condition: 'first_reached' | 'days_only' | 'visits_only';
  defaultFee: number;
  priority: number;
  isActive: boolean;
  description?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  createdAt: string;
}

// Request/Response Types
export interface CreateOpdBillRequest {
  appointmentId: string;
  patientId: string;
  branchId: string;
  consultationFee: number;
  registrationFee?: number;
  additionalCharges?: number;
  discountPercentage?: number;
  taxAmount?: number;
  billItems?: OpdBillItem[];
  notes?: string;
  isFreeVisit?: boolean;
  freeVisitReason?: string;
  isInsurance?: boolean;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceClaimAmount?: number;
}

export interface AddPaymentRequest {
  opdBillId: string;
  paymentMode: PaymentMode;
  amount: number;
  paymentKind: 'Payment' | 'Advance';
  idempotencyKey: string;
  cardType?: string;
  cardLastFour?: string;
  cardNetwork?: string;
  upiId?: string;
  upiTransactionId?: string;
  bankName?: string;
  chequeNumber?: string;
  notes?: string;
}

export interface EnsureIpBillRequest {
  patientJourneyId: string;
}

export interface ApplyCreditRequest {
  opdBillId: string;
  creditNotes?: string;
}

export interface ApplyDiscountRequest {
  opdBillId: string;
  discountPercentage: number;
  discountReason: string;
  authorizationPin?: string;
  idempotencyKey: string;
}

export interface BillingCheckResult {
  appointmentId: string;
  patientId: string;
  visitType: string;
  isFreeVisit: boolean;
  reason?: string;
  applicableRule?: BillingRule;
  suggestedFee: number;
  previousVisitsCount: number;
  daysSinceLastVisit?: number;
}

export interface CreateBillingRuleRequest {
  branchId?: string;
  visitType: string;
  freeDays: number;
  freeVisits: number;
  condition: 'first_reached' | 'days_only' | 'visits_only';
  defaultFee: number;
  priority?: number;
  description?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface OpdBillsFilters {
  patientId?: string;
  branchId?: string;
  status?: OpdBillStatus;
  isFreeVisit?: boolean;
  isCredit?: boolean;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get OPD Bill by ID
 */
export const getOpdBill = async (id: string): Promise<OpdBill> => {
  const api = getApi();
  const response = await api.get(`/opdbills/${id}`);
  return response.data;
};

/**
 * Get OPD Bills with filters
 */
export const getOpdBills = async (filters: OpdBillsFilters = {}): Promise<{ bills: OpdBill[]; total: number }> => {
  const api = getApi();
  const params = new URLSearchParams();
  
  if (filters.patientId) params.append('patientId', filters.patientId);
  if (filters.branchId) params.append('branchId', filters.branchId);
  if (filters.status) params.append('status', filters.status);
  if (filters.isFreeVisit !== undefined) params.append('isFreeVisit', String(filters.isFreeVisit));
  if (filters.isCredit !== undefined) params.append('isCredit', String(filters.isCredit));
  if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.append('dateTo', filters.dateTo);
  if (filters.page) params.append('page', String(filters.page));
  if (filters.pageSize) params.append('pageSize', String(filters.pageSize));
  
  const response = await api.get(`/opdbills?${params.toString()}`);
  return response.data;
};

/**
 * Create new OPD Bill
 */
export const createOpdBill = async (request: CreateOpdBillRequest): Promise<OpdBill> => {
  const api = getApi();
  const response = await api.post('/opdbills', request);
  return response.data;
};

/**
 * Add payment to an OPD Bill. Returns the full bill (including payments/receipts).
 * Replaying the same idempotencyKey returns the original bill — treat as success.
 */
export const addPayment = async (request: AddPaymentRequest): Promise<OpdBill> => {
  if (!request.opdBillId) {
    throw new Error('opdBillId is required');
  }
  if (!request.idempotencyKey) {
    throw new Error('idempotencyKey is required');
  }
  const api = getApi();
  const response = await api.post('/opdbills/payment', request);
  return response.data;
};

/**
 * JWT cashier path to create (or reuse) the inpatient OpdBill.
 * Do not call the internal X-Internal-Key ensure-bill route from the browser.
 */
export const ensureIpBill = async (request: EnsureIpBillRequest): Promise<OpdBill> => {
  const api = getApi();
  const response = await api.post('/opdbills/ip-ensure', request);
  return response.data;
};

/**
 * Apply credit (allow payment later)
 */
export const applyCredit = async (request: ApplyCreditRequest): Promise<OpdBill> => {
  if (!request.opdBillId) {
    throw new Error('opdBillId is required');
  }
  const api = getApi();
  const response = await api.post('/opdbills/credit', request);
  return response.data;
};

/**
 * Apply discount to a bill
 */
export const applyDiscount = async (request: ApplyDiscountRequest): Promise<OpdBill> => {
  const api = getApi();
  const response = await api.post('/opdbills/discount', request);
  return response.data;
};

/**
 * Cancel an OPD Bill
 */
export const cancelOpdBill = async (id: string): Promise<OpdBill> => {
  const api = getApi();
  const response = await api.delete(`/opdbills/${id}`);
  return response.data;
};

/**
 * Finalize OPD Bill (locks bill from further edits)
 * Phase 1 Critical Gates
 */
export const finalizeBill = async (billId: string): Promise<OpdBill> => {
  const api = getApi();
  const response = await api.post(`/opdbills/${billId}/finalize`);
  return response.data;
};

export const getBillItems = async (billId: string): Promise<BillChargeLine[]> => {
  const api = getApi();
  const response = await api.get(`/billitems/bill/${billId}`);
  return response.data ?? [];
};

export interface AddBillItemRequest {
  opdBillId: string;
  serviceVariantId: string;
  quantity: number;
  idempotencyKey: string;
  sourceType?: string;
  notes?: string;
}

export const addBillItem = async (request: AddBillItemRequest): Promise<BillChargeLine> => {
  if (!request.opdBillId) {
    throw new Error('opdBillId is required');
  }
  if (!request.idempotencyKey) {
    throw new Error('idempotencyKey is required');
  }
  const api = getApi();
  const response = await api.post('/billitems', request);
  return response.data;
};

/**
 * Check billing rules for an appointment
 */
export const checkBillingRules = async (appointmentId: string): Promise<BillingCheckResult> => {
  const api = getApi();
  const response = await api.get(`/opdbills/check-rules/${appointmentId}`);
  return response.data;
};

// ============================================================================
// Billing Rules API
// ============================================================================

/**
 * Get all billing rules
 */
export const getBillingRules = async (branchId?: string): Promise<BillingRule[]> => {
  const api = getApi();
  const url = branchId ? `/opdbills/rules?branchId=${branchId}` : '/opdbills/rules';
  const response = await api.get(url);
  return response.data;
};

/**
 * Get billing rule by ID
 */
export const getBillingRule = async (id: string): Promise<BillingRule> => {
  const api = getApi();
  const response = await api.get(`/opdbills/rules/${id}`);
  return response.data;
};

/**
 * Create billing rule
 */
export const createBillingRule = async (request: CreateBillingRuleRequest): Promise<BillingRule> => {
  const api = getApi();
  const response = await api.post('/opdbills/rules', request);
  return response.data;
};

/**
 * Update billing rule
 */
export const updateBillingRule = async (id: string, request: Partial<CreateBillingRuleRequest>): Promise<BillingRule> => {
  const api = getApi();
  const response = await api.put(`/opdbills/rules/${id}`, request);
  return response.data;
};

/**
 * Delete billing rule
 */
export const deleteBillingRule = async (id: string): Promise<void> => {
  const api = getApi();
  await api.delete(`/opdbills/rules/${id}`);
};

// ============================================================================
// Export as namespace
// ============================================================================

// Day 8: Auto-Billing Prompt - Billing Status Checks (Jan 31, 2026)
export interface VisitBillingStatus {
  hasBill: boolean;
  isPaid: boolean;
  isLocked: boolean;
  isFreeVisit: boolean;
  isCredit: boolean;
  balanceDue: number;
  netAmount?: number;
  amountPaid?: number;
  billNumber?: string;
  billId?: string;
  status?: string;
  canComplete: boolean;
  message: string;
}

export async function getVisitBillingStatus(visitId: string): Promise<VisitBillingStatus> {
  const api = getApi();
  const response = await api.get(`/OpdBills/visit-billing-status/${visitId}`);
  return response.data;
}

export async function getAppointmentBillingStatus(appointmentId: string): Promise<{
  hasBill: boolean;
  isPaid: boolean;
  isFreeVisit: boolean;
  isCredit: boolean;
  balanceDue: number;
  billNumber?: string;
  billId?: string;
  status?: string;
}> {
  const api = getApi();
  const response = await api.get(`/OpdBills/appointment-billing-status/${appointmentId}`);
  return response.data;
}

export interface IpBillingDashboard {
  fromUtc: string;
  toUtcExclusive: string;
  rangeLabel: string;
  billedDateBasis: string;
  collectionDateBasis: string;
  admissionDateBasis?: string;
  patientCount: number;
  pendingRefundCount?: number;
  pendingRefundAmount?: number;
  pendingCreditApprovalCount?: number;
  packageEstimate: number;
  totalBilled: number;
  totalCollected: number;
  patientOutstanding: number;
  payerOutstanding: number;
  refunds: number;
  adjustments: number;
  pipeline: { key: string; label: string; count: number; billedAmount: number }[];
  paymentInstruments: { key: string; label: string; amount: number }[];
  payerMix: { key: string; label: string; amount: number }[];
  aging: { key: string; label: string; count: number; patientOutstanding: number; payerOutstanding: number }[];
  patients: {
    billId: string;
    patientId: string;
    journeyId?: string | null;
    patientName: string;
    mrn?: string | null;
    admissionDate?: string | null;
    billDate: string;
    billNumber: string;
    billedAmount: number;
    patientResponsibility: number;
    payerResponsibility: number;
    collected: number;
    patientOutstanding: number;
    payerOutstanding: number;
    lifecycle: string;
    lastTransactionAt?: string | null;
    chargeStatus?: 'complete' | 'missing_charges' | 'unmapped' | string;
    chargeStatusLabel?: string;
  }[];
  unbilledActivityCount?: number;
  unbilledActivityAmount?: number;
  unbilledImplantCount?: number;
  unbilledConsumableCount?: number;
  unmappedExceptionCount?: number;
}

export async function getIpBillingDashboard(params: {
  branchId: string;
  preset?: string;
  from?: string;
  to?: string;
}): Promise<IpBillingDashboard> {
  const api = getApi();
  const response = await api.get('/opdbills/ip-dashboard', { params });
  return response.data;
}

export const opdBillingApi = {
  // Bills
  getOpdBill,
  getOpdBills,
  createOpdBill,
  addPayment,
  ensureIpBill,
  applyCredit,
  applyDiscount,
  cancelOpdBill,
  finalizeBill,
  getBillItems,
  addBillItem,
  checkBillingRules,
  
  // Rules
  getBillingRules,
  getBillingRule,
  createBillingRule,
  updateBillingRule,
  deleteBillingRule,

  // Day 8: Billing Status Checks
  getVisitBillingStatus,
  getAppointmentBillingStatus,
  getIpBillingDashboard,
};

export default opdBillingApi;
