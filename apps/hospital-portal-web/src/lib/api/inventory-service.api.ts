/**
 * inventory-service.api.ts
 *
 * HTTP client for the InventoryApi Azure Functions microservice.
 * Base URL defaults to http://localhost:7072 (port 7072, no /api prefix).
 * host.json routePrefix is "" so routes are exposed at /vendors, /invoices, etc.
 * Override via NEXT_PUBLIC_INVENTORY_API_URL.
 *
 * Headers sent with every request:
 *   X-Tenant-Id  — from Zustand auth store
 *   X-User-Id    — from Zustand auth store
 *   Authorization: Bearer <token>
 */

import axios, { AxiosInstance } from 'axios';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../auth-store';

const INVENTORY_API_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_INVENTORY_API_URL) ||
  'http://localhost:7072';

// ─── PascalCase → camelCase transformer ──────────────────────────────────────
// Azure Functions WriteAsJsonAsync uses System.Text.Json defaults (PascalCase).
// This interceptor normalises every response to camelCase.
function camelKey(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
function deepCamel(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(deepCamel);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [camelKey(k), deepCamel(v)])
    );
  }
  return obj;
}

let _client: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (_client) return _client;
  _client = axios.create({ baseURL: INVENTORY_API_URL, timeout: 15000 });

  _client.interceptors.request.use((config) => {
    const { tenantId, token, user, roles } = useAuthStore.getState();
    const h = config.headers as Record<string, string>;
    if (tenantId) h['X-Tenant-Id'] = tenantId;
    if (user?.id) h['X-User-Id'] = user.id;
    if (token) h['Authorization'] = `Bearer ${token}`;
    if (roles && roles.length > 0) h['X-User-Roles'] = roles.join(',');
    return config;
  });

  // Normalize PascalCase response keys to camelCase; surface 403 as toast
  _client.interceptors.response.use(
    (response) => { response.data = deepCamel(response.data); return response; },
    (error) => {
      if (error?.response?.status === 403) {
        const msg = error.response.data ?? 'You do not have permission to perform this action.';
        toast.error(String(msg));
      }
      return Promise.reject(error);
    }
  );

  return _client;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface VendorDto {
  id: string;
  name: string;
  vendorCode?: string;
  vendorCategory: string;
  isPreferred: boolean;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  registeredAddress?: string;
  website?: string;
  gstNumber?: string;
  panNumber?: string;
  cinNumber?: string;
  drugLicenseNumber?: string;
  drugLicenseExpiry?: string;
  drugLicense20B?: string;
  drugLicense20BExpiry?: string;
  drugLicense21B?: string;
  drugLicense21BExpiry?: string;
  apmcRegistration?: string;
  foodLicenseNumber?: string;
  importExportCode?: string;
  swiftCode?: string;
  latePaymentInterestRate?: number;
  isColdChainVendor: boolean;
  bankName?: string;
  bankAccountNumber?: string;
  bankIfscCode?: string;
  bankAccountHolderName?: string;
  bankAccountType: string;
  creditDays: number;
  outstandingBalance: number;
  status: string;
  isConsignmentVendor?: boolean;
}

export interface CreateVendorRequest {
  name: string;
  vendorCode?: string;
  vendorCategory: string;
  isPreferred: boolean;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  registeredAddress?: string;
  website?: string;
  gstNumber?: string;
  panNumber?: string;
  cinNumber?: string;
  drugLicenseNumber?: string;
  drugLicenseExpiry?: string;
  drugLicense20B?: string;
  drugLicense20BExpiry?: string;
  drugLicense21B?: string;
  drugLicense21BExpiry?: string;
  apmcRegistration?: string;
  foodLicenseNumber?: string;
  importExportCode?: string;
  swiftCode?: string;
  latePaymentInterestRate?: number;
  isColdChainVendor: boolean;
  bankName?: string;
  bankAccountNumber?: string;
  bankIfscCode?: string;
  bankAccountHolderName?: string;
  bankAccountType: string;
  creditDays?: number;
  status?: string;
  isConsignmentVendor?: boolean;
}

export interface PurchaseInvoiceDto {
  id: string;
  vendorId: string;
  vendorName: string;
  storeId: string;
  storeName: string;
  invoiceNumber: string;
  invoiceDate: string;
  deliveryChallNumber?: string;
  deliveryChallDate?: string;
  vendorOrderNumber?: string;
  vendorSapNumber?: string;
  billingMode: string;
  patientName?: string;
  patientIpNo?: string;
  grossAmount: number;
  discountAmount: number;
  taxableAmount: number;
  totalGst: number;
  tcsPercent: number;
  tcsAmount: number;
  netAmount: number;
  paidAmount: number;
  balanceAmount: number;
  approvalStatus: string;
  createdAt: string;
  items: PurchaseItemDto[];
  grnNumber?: string;
  invoiceType?: string;
  paymentMode?: string;
  creditPeriod?: number;
  dueDate?: string;
  reference?: string;
  purchaseCategory?: string;
}

export interface PurchaseItemDto {
  id: string;
  itemId: string;
  itemName: string;
  orderedQuantity: number;
  receivedQuantity: number;
  rejectedQuantity: number;
  freeQuantity: number;
  batchNumber?: string;
  expiryDate?: string;
  barcode?: string;
  originalMrp: number;
  mrp: number;
  purchaseRate: number;
  discountPercent: number;
  isFullDiscount: boolean;
  hsnCode?: string;
  gstPercent: number;
  netAmount: number;
  patientName?: string;
  patientIpNo?: string;
  itemRemarks?: string;
}

export interface GrnHeaderDto {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  storeId: string;
  grnNumber: string | null;
  grnDate: string;
  grnStatus: string;
  approvalStatus?: string;
  remarks?: string;
  items: GrnItemDto[];
  // Extended fields
  vendorId: string;
  vendorName: string;
  invoiceDate: string;
  dueDate?: string;
  netAmount: number;
  totalAmount: number;
  purchaseCategory?: string;
  paymentMode?: string;
  storeName?: string;
}

export interface GrnItemDto {
  id: string;
  purchaseItemId: string;
  itemId: string;
  itemName: string;
  acceptedQuantity: number;
  rejectedQuantity: number;
  rejectionReason?: string;
  isVerified: boolean;
  barcode?: string;
  // Extended fields
  orderedQuantity: number;
  batchNumber?: string;
  expiryDate?: string;
  purchaseRate: number;
  mrp: number;
  cgstPercent: number;
  sgstPercent: number;
  igstPercent: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  packing: number;
  freeQuantity: number;
  purchaseCost: number;
}

export interface StockSummaryDto {
  storeId: string;
  storeName: string;
  itemId: string;
  itemName: string;
  genericName?: string;
  unit?: string;
  totalAvailable: number;
  nearestExpiry?: string;
  batchCount: number;
  reorderLevel: number;
  isBelowReorder: boolean;
}

export interface StockBatchDto {
  id: string;
  itemId: string;
  itemMasterId: string;
  itemName: string;
  storeId: string;
  batchNumber?: string;
  expiryDate?: string;
  barcode?: string;
  quantityAvailable: number;
  unitOfMeasure?: string;
  purchaseRate: number;
  mrp: number;
  requiresColdStorage: boolean;
}

export interface GstSummaryByRateDto {
  month: string;
  gstRate: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalGstAmount: number;
}

export interface VendorReconciliationReport {
  vendorId: string;
  vendorName: string;
  totalInvoiced: number;
  totalPaid: number;
  outstandingBalance: number;
  lines: ReconciliationLine[];
}

export interface ReconciliationLine {
  entryType: string;
  referenceNumber: string;
  entryDate: string;
  debit: number;
  credit: number;
  runningBalance: number;
  remarks?: string;
}

export interface ColdChainAlertDto {
  batchId: string;
  itemId: string;
  itemName: string;
  storeId: string;
  storeName: string;
  storeType: string;
  batchNumber: string;
  expiryDate?: string;
  quantityAvailable: number;
}

export interface StockLedgerDto {
  id: string;
  storeId: string;
  itemId: string;
  itemName: string;
  stockBatchId?: string;
  transactionType: string;
  referenceId?: string;
  referenceNumber?: string;
  quantityIn: number;
  quantityOut: number;
  balanceQuantity: number;
  unitRate: number;
  totalValue: number;
  remarks?: string;
  patientName?: string;
  patientIpNo?: string;
  transactionDate: string;
  createdAt: string;
}

export interface VendorPaymentDto {
  id: string;
  vendorId: string;
  invoiceId?: string;
  settlementId?: string;
  paymentReference: string;
  paymentDate: string;
  amount: number;
  paymentMode: string;
  chequeNumber?: string;
  bankTransactionId?: string;
  remarks?: string;
  createdAt: string;
  attachmentUrl?: string;
  attachmentFilename?: string;
  attachmentSizeKb?: number;
  deletedAt?: string;
  reversedByUserId?: string;
}

// ─── Vendor APIs ──────────────────────────────────────────────────────────────

export const inventoryVendorApi = {
  list: (page = 1, pageSize = 20, category?: string, isPreferred?: boolean): Promise<PagedResult<VendorDto>> =>
    getClient().get('/vendors', { params: { page, pageSize, ...(category ? { category } : {}), ...(isPreferred !== undefined ? { isPreferred } : {}) } }).then(r => r.data),

  get: (id: string): Promise<VendorDto> =>
    getClient().get(`/vendors/${id}`).then(r => r.data),

  create: (req: CreateVendorRequest): Promise<VendorDto> =>
    getClient().post('/vendors', req).then(r => r.data),

  update: (id: string, req: Partial<CreateVendorRequest> & { name: string; vendorCategory: string; isPreferred: boolean; isColdChainVendor: boolean; bankAccountType: string }): Promise<VendorDto> =>
    getClient().put(`/vendors/${id}`, req).then(r => r.data),

  delete: (id: string): Promise<void> =>
    getClient().delete(`/vendors/${id}`).then(() => undefined),

  getOutstanding: (vendorId: string) =>
    getClient().get(`/vendors/${vendorId}/outstanding`).then(r => r.data),

  getReconciliation: (vendorId: string): Promise<VendorReconciliationReport> =>
    getClient().get(`/vendors/${vendorId}/reconciliation`).then(r => r.data),

  recordPayment: (vendorId: string, req: {
    invoiceId?: string;
    paymentReference: string;
    paymentDate: string;
    amount: number;
    paymentMode: string;
    chequeNumber?: string;
    bankTransactionId?: string;
    remarks?: string;
  }) => getClient().post(`/vendors/${vendorId}/payments`, req).then(r => r.data),

  listPayments: (vendorId: string, page = 1, pageSize = 20): Promise<PagedResult<VendorPaymentDto>> =>
    getClient().get(`/vendors/${vendorId}/payments`, { params: { page, pageSize } }).then(r => r.data),

  reversePayment: (paymentId: string, reason: string): Promise<void> =>
    getClient().post(`/vendor-payments/${paymentId}/reverse`, { reason }).then(() => undefined),
};

// ─── Invoice APIs ─────────────────────────────────────────────────────────────

export const inventoryInvoiceApi = {
  list: (params?: { page?: number; pageSize?: number; vendorId?: string; billingMode?: string }): Promise<PagedResult<PurchaseInvoiceDto>> =>
    getClient().get('/invoices', { params }).then(r => r.data),

  get: (id: string): Promise<PurchaseInvoiceDto> =>
    getClient().get(`/invoices/${id}`).then(r => r.data),

  create: (req: object): Promise<PurchaseInvoiceDto> =>
    getClient().post('/invoices', req).then(r => r.data),

  submit: (id: string): Promise<void> =>
    getClient().post(`/invoices/${id}/submit`).then(() => undefined),

  approve: (id: string, action: 'FinalApproval' | 'Rejection', remarks?: string): Promise<void> =>
    getClient().post(`/invoices/${id}/approve`, { action, remarks }).then(() => undefined),

  cancel: (id: string): Promise<void> =>
    getClient().post(`/invoices/${id}/cancel`).then(() => undefined),

  update: (id: string, req: {
    invoiceNumber?: string;
    invoiceDate?: string;
    invoiceType?: string;
    paymentMode?: string;
    creditPeriod?: number;
    dueDate?: string;
    reference?: string;
    purchaseCategory?: string;
  }): Promise<PurchaseInvoiceDto> =>
    getClient().patch(`/invoices/${id}`, req).then(r => r.data),

  updateItems: (id: string, items: Array<{
    id?: string;
    itemId: string;
    orderedQuantity: number;
    receivedQuantity: number;
    freeQuantity: number;
    batchNumber?: string | null;
    expiryDate?: string | null;
    barcode?: string | null;
    mrp: number;
    originalMrp: number;
    purchaseRate: number;
    discountPercent: number;
    hsnCode?: string | null;
    gstPercent: number;
    cgstPercent: number;
    sgstPercent: number;
    igstPercent: number;
    sellingPrice?: number;
    packing?: number;
    unitsPerPack?: number;
    mrpOnPack?: number;
    transferMrp?: number;
    isAssetItem?: boolean;
    taxOnFree?: boolean;
    isReplacement?: boolean;
    itemRemarks?: string | null;
  }>): Promise<PurchaseInvoiceDto> =>
    getClient().patch(`/invoices/${id}/items`, { items }).then(r => r.data),
};

// ─── GRN APIs ─────────────────────────────────────────────────────────────────

export const inventoryGrnApi = {
  list: (params?: { page?: number; pageSize?: number; status?: string; includeUngenerated?: boolean }): Promise<PagedResult<GrnHeaderDto>> =>
    getClient().get('/grn', { params }).then(r => (r.data && 'items' in r.data ? r.data : { items: r.data ?? [], total: r.data?.length ?? 0, page: 1, pageSize: 20 })),

  create: (req: object): Promise<GrnHeaderDto> =>
    getClient().post('/grn', req).then(r => r.data),

  get: (id: string): Promise<GrnHeaderDto> =>
    getClient().get(`/grn/${id}`).then(r => r.data),

  primaryApprove: (id: string, remarks?: string): Promise<GrnHeaderDto> =>
    getClient().post(`/grn/${id}/primary-approve`, { remarks }).then(r => r.data),

  finalApprove: (id: string, remarks?: string): Promise<GrnHeaderDto> =>
    getClient().post(`/grn/${id}/final-approve`, { remarks }).then(r => r.data),

  reject: (id: string, remarks?: string): Promise<GrnHeaderDto> =>
    getClient().post(`/grn/${id}/reject`, { remarks }).then(r => r.data),

  cancel: (id: string): Promise<GrnHeaderDto> =>
    getClient().post(`/grn/${id}/cancel`).then(r => r.data),

  generateFromInvoice: (invoiceId: string, grnDate?: string, remarks?: string): Promise<GrnHeaderDto> =>
    getClient().post(`/grn/from-invoice/${invoiceId}`, { grnDate, remarks }).then(r => r.data),
};

// ─── Invoice Extraction (OCR prefill) Types ───────────────────────────────────

export type ExtractionConfidence = 'High' | 'Review' | 'Low';

export interface ExtractedField<T> {
  value: T | null;
  sourceText: string | null;
  confidence: ExtractionConfidence;
  mismatchReason: string | null;
}

export interface ExtractionCandidate {
  id: string;
  name: string;
  score: number;
}

export interface ExtractedInvoiceHeader {
  invoiceNumber: ExtractedField<string>;
  invoiceDate: ExtractedField<string>;
  grnDate: ExtractedField<string>;
  invoiceType: ExtractedField<string>;
  paymentMode: ExtractedField<string>;
  creditPeriod: ExtractedField<number>;
  reference: ExtractedField<string>;
  remarks: ExtractedField<string>;
  vendorName: ExtractedField<string>;
  vendorGstin: ExtractedField<string>;
  vendorContact: ExtractedField<string>;
  vendorPhone: ExtractedField<string>;
  vendorEmail: ExtractedField<string>;
  vendorCandidates: ExtractionCandidate[];
  resolvedVendorId: string | null;
  storeName: ExtractedField<string>;
  storeCandidates: ExtractionCandidate[];
  resolvedStoreId: string | null;
  // e-Invoice & E-Way Bill
  irn: ExtractedField<string>;
  ackNo: ExtractedField<string>;
  ackDate: ExtractedField<string>;
  eWayBillNo: ExtractedField<string>;
  eWayBillDate: ExtractedField<string>;
  dateOfDelivery: ExtractedField<string>;
  isReverseCharge: ExtractedField<boolean>;
  vendorGstinOnInvoice: ExtractedField<string>;
}

export interface ExtractedLineItem {
  rawDescription: ExtractedField<string>;
  hsnCode: ExtractedField<string>;
  itemCandidates: ExtractionCandidate[];
  resolvedItemId: string | null;
  resolvedItemName: string | null;
  orderedQuantity: ExtractedField<number>;
  freeQuantity: ExtractedField<number>;
  batchNumber: ExtractedField<string>;
  expiryDate: ExtractedField<string>;
  purchaseRate: ExtractedField<number>;
  mrp: ExtractedField<number>;
  discountPercent: ExtractedField<number>;
  sellingPrice: ExtractedField<number>;
  gstPercent: ExtractedField<number>;
  cgstPercent: ExtractedField<number>;
  sgstPercent: ExtractedField<number>;
  igstPercent: ExtractedField<number>;
  isInterState: ExtractedField<boolean>;
  // Traceability
  serialNumbers: ExtractedField<string[] | null>;
  manufacturerName: ExtractedField<string>;
  countryOfOrigin: ExtractedField<string>;
  mfgDate: ExtractedField<string>;
  scheduleType: ExtractedField<string>;
  isColdChain: ExtractedField<boolean>;
  brandName: ExtractedField<string>;
  vendorSku: ExtractedField<string>;
  extraFieldsJson: ExtractedField<string | null>;
}

export interface ExtractedTotals {
  subtotal: ExtractedField<number>;
  totalCgst: ExtractedField<number>;
  totalSgst: ExtractedField<number>;
  totalIgst: ExtractedField<number>;
  totalDiscount: ExtractedField<number>;
  roundingAmount: ExtractedField<number>;
  netAmount: ExtractedField<number>;
  tcsAmount: ExtractedField<number>; // Tax Collected at Source
}

export interface InvoiceExtractionPreview {
  sessionId: string;
  documentUrl: string | null;
  originalFilename: string;
  providerModel: string;
  processingMs: number;
  hasDuplicateWarning: boolean;
  duplicateWarningDetail: string | null;
  header: ExtractedInvoiceHeader;
  lineItems: ExtractedLineItem[];
  totals: ExtractedTotals;
}

export interface ConfirmedLineItem {
  itemId: string;
  orderedQuantity: number;
  freeQuantity: number;
  batchNumber?: string | null;
  expiryDate?: string | null;
  barcode?: string | null;
  mrp: number;
  purchaseRate: number;
  discountPercent: number;
  hsnCode?: string | null;
  gstPercent: number;
  cgstPercent: number;
  sgstPercent: number;
  igstPercent: number;
  sellingPrice?: number;
  packing?: number;
  unitsPerPack?: number;
  mrpOnPack?: number;
  transferMrp?: number;
  isAssetItem?: boolean;
  taxOnFree?: boolean;
  isReplacement?: boolean;
  itemRemarks?: string | null;
  // Traceability
  serialNumber?: string | null;
  manufacturerName?: string | null;
  countryOfOrigin?: string | null;
  mfgDate?: string | null;
  scheduleType?: string | null;
  isColdChain?: boolean;
  brandName?: string | null;
  vendorSku?: string | null;
  isInterState?: boolean;
  extraFieldsJson?: string | null;
  // Patient linkage
  patientName?: string | null;
  patientIpNo?: string | null;
  surgeryId?: string | null;
  originalMrp?: number;
  isFullDiscount?: boolean;
}

export interface ConfirmExtractionRequest {
  sessionId: string;
  vendorId: string;
  storeId: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceType: string;
  paymentMode?: string | null;
  creditPeriod?: number | null;
  dueDate?: string | null;
  reference?: string | null;
  purchaseCategory?: string | null;
  remarks?: string | null;
  grnDate: string;
  generateGrn: boolean;
  items: ConfirmedLineItem[];
  // e-Invoice & E-Way Bill
  irn?: string | null;
  ackNo?: string | null;
  ackDate?: string | null;
  eWayBillNo?: string | null;
  eWayBillDate?: string | null;
  dateOfDelivery?: string | null;
  isReverseCharge?: boolean;
  vendorGstinOnInvoice?: string | null;
  // Audit metadata
  originalFilename?: string;
  documentUrl?: string;
  providerModel?: string;
  processingMs?: number;
  highFieldCount?: number;
  reviewFieldCount?: number;
  lowFieldCount?: number;
  fieldOverrideCount?: number;
  overriddenFieldsJson?: string;
  tcsTotalAmount?: number;
}

export interface ConfirmExtractionResponse {
  invoice: PurchaseInvoiceDto;
  grn: GrnHeaderDto | null;
}

// ─── Invoice Extraction API ───────────────────────────────────────────────────

export const invoiceExtractionApi = {
  /** Upload PDF/image; OpenAI extraction runs synchronously — may take up to 4 min. */
  upload: (file: File): Promise<InvoiceExtractionPreview> =>
    getClient().post<InvoiceExtractionPreview>(
      '/invoice-extraction/upload', file,
      {
        headers: {
          'Content-Type': file.type,
          'X-Filename':   encodeURIComponent(file.name),
        },
        maxBodyLength:    Infinity,
        maxContentLength: Infinity,
        // No axios timeout — the function can legitimately take up to 4 min.
        // The backend itself will surface a 504 if OpenAI times out.
        timeout: 0,
      },
    ).then(r => r.data),

  /** Submit user-confirmed data – creates invoice and optionally generates GRN. */
  confirm: (req: ConfirmExtractionRequest): Promise<ConfirmExtractionResponse> =>
    getClient().post('/invoice-extraction/confirm', req).then(r => r.data),
};

// ─── Stock APIs ───────────────────────────────────────────────────────────────

export const inventoryStockApi = {
  getSummary: (storeId?: string): Promise<StockSummaryDto[]> =>
    getClient().get('/stock/summary', { params: { storeId } }).then(r => r.data),

  getBatches: (storeId?: string, itemId?: string): Promise<StockBatchDto[]> =>
    getClient().get('/stock/batches', { params: { storeId, itemId } }).then(r => r.data),

  getBelowReorder: (): Promise<StockSummaryDto[]> =>
    getClient().get('/stock/below-reorder').then(r => r.data),

  getExpiring: (daysAhead = 90): Promise<ExpiringBatchDto[]> =>
    getClient().get('/stock/expiring', { params: { daysAhead } }).then(r => r.data),

  getColdChainAlerts: (): Promise<ColdChainAlertDto[]> =>
    getClient().get('/stock/cold-chain-alerts').then(r => r.data),

  getLedger: (params?: { storeId?: string; itemId?: string; from?: string; to?: string; page?: number; pageSize?: number }): Promise<PagedResult<StockLedgerDto>> =>
    getClient().get('/stock/ledger', { params }).then(r => r.data),

  createAdjustment: (req: {
    storeId: string;
    itemId: string;
    stockBatchId?: string;
    adjustmentQuantity: number;
    unitRate: number;
    remarks?: string;
  }) => getClient().post('/stock/adjustments', req).then(r => r.data),

  createTransfer: (req: object) =>
    getClient().post('/transfers', req).then(r => r.data),

  approveTransfer: (id: string) =>
    getClient().post(`/transfers/${id}/approve`).then(r => r.data),
};

// ─── Pharmacy APIs ────────────────────────────────────────────────────────────

export type ConsumableStatus =
  | 'Planned'
  | 'StockCheckPending'
  | 'StockAllocated'
  | 'EscalationRaised'
  | 'IssuedInOT'
  | 'ReturnPosted'
  | 'Closed'
  | 'Cancelled';

export interface SurgeryConsumableDto {
  id: string;
  tenantId: string;
  storeId: string;
  surgeryId?: string;
  journeyId?: string;
  itemId: string;
  stockBatchId?: string;
  iolBillingMode: string;
  patientName?: string;
  patientIpNo?: string;
  quantity: number;
  returnedQuantity: number;
  unitRate: number;
  amount: number;
  barcode?: string;
  remarks?: string;
  consumableStatus: ConsumableStatus;
  chargeStatus?: 'Pending' | 'Posted' | 'Suppressed' | 'Exception' | 'UnmappedJourney';
  chargeItemId?: string;
  escalationReason?: string;
  issuedAt: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const inventoryPharmacyApi = {
  createBill: (req: object) =>
    getClient().post('/pharmacy/bills', req).then(r => r.data),

  getBill: (id: string) =>
    getClient().get(`/pharmacy/bills/${id}`).then(r => r.data),

  cancelBill: (id: string) =>
    getClient().post(`/pharmacy/bills/${id}/cancel`).then(() => undefined),

  confirmBill: (id: string) =>
    getClient().post(`/pharmacy/bills/${id}/confirm`).then(r => r.data),

  recordBillPayment: (id: string, req: { amountPaid: number; paymentMode?: string; paymentReference?: string }) =>
    getClient().post(`/pharmacy/bills/${id}/record-payment`, req).then(r => r.data),

  // Surgery consumable — direct bulk issue (legacy)
  issueSurgeryConsumables: (req: object) =>
    getClient().post('/surgery/consumables', req).then(r => r.data),

  // Surgery consumable — staged OT/IOL flow
  listConsumables: (params?: { storeId?: string; page?: number; pageSize?: number }) =>
    getClient().get('/surgery/consumables', { params }).then(r => r.data),

  planConsumables: (req: {
    storeId: string;
    surgeryId?: string;
    iolBillingMode: string;
    patientName?: string;
    patientIpNo?: string;
    journeyId?: string;
    items: { itemId: string; plannedQuantity: number; stockBatchId?: string; barcode?: string; remarks?: string }[];
  }) =>
    getClient().post<SurgeryConsumableDto[]>('/surgery/consumables/plan', req).then(r => r.data),

  checkConsumableStock: (id: string) =>
    getClient().post<SurgeryConsumableDto>(`/surgery/consumables/${id}/check-stock`).then(r => r.data),

  issueConsumableInOT: (id: string) =>
    getClient().post<SurgeryConsumableDto>(`/surgery/consumables/${id}/issue`).then(r => r.data),

  raiseConsumableEscalation: (id: string, reason: string) =>
    getClient().post<SurgeryConsumableDto>(`/surgery/consumables/${id}/escalate`, { reason }).then(r => r.data),

  resolveConsumableEscalation: (id: string) =>
    getClient().post<SurgeryConsumableDto>(`/surgery/consumables/${id}/resolve-escalation`).then(r => r.data),

  postConsumableReturn: (id: string, returnedQuantity: number) =>
    getClient().post<SurgeryConsumableDto>(`/surgery/consumables/${id}/return`, { returnedQuantity }).then(r => r.data),

  closeConsumable: (id: string) =>
    getClient().post<SurgeryConsumableDto>(`/surgery/consumables/${id}/close`).then(r => r.data),

  cancelConsumable: (id: string) =>
    getClient().post(`/surgery/consumables/${id}/cancel`).then(() => undefined),
};

// ─── Requisition APIs ─────────────────────────────────────────────────────────

export interface EvaluatePolicyPathResult {
  requisitionId: string;
  recommendedPath: 'DirectPO' | 'RFQ';
  estimatedValue: number;
  directPoLimit?: number;
  rfqMandatoryFrom?: number;
  dualApprovalFrom?: number;
  minVendorQuotes?: number;
  requiresDualApproval: boolean;
  reason: string;
  policyId?: string;
  policyName?: string;
}

export interface ConvertToRfqRequest {
  title?: string;
  branchId: string;
  vendorIds?: string[];
  responseDeadline?: string;
}

export interface ConvertToPOItemOverride {
  itemId: string;
  orderedQty: number;
  unitPrice: number;
  gstPercent: number;
  unit?: string;
}

export interface ConvertToPORequest {
  branchId: string;
  vendorId: string;
  vendorName?: string;
  items?: ConvertToPOItemOverride[];
  expectedDeliveryDate?: string;
  isEmergency?: boolean;
  notes?: string;
  terms?: string;
}

export const inventoryRequisitionApi = {
  list: (params?: { page?: number; pageSize?: number }) =>
    getClient().get('/requisitions', { params: { page: params?.page ?? 1, pageSize: params?.pageSize ?? 20 } }).then(r => r.data),

  get: (id: string) =>
    getClient().get(`/requisitions/${id}`).then(r => r.data),

  create: (req: object) =>
    getClient().post('/requisitions', req).then(r => r.data),

  submit: (id: string) =>
    getClient().post(`/requisitions/${id}/submit`).then(r => r.data),

  approve: (id: string, remarks?: string) =>
    getClient().post(`/requisitions/${id}/approve`, { remarks }).then(r => r.data),

  reject: (id: string, remarks?: string) =>
    getClient().post(`/requisitions/${id}/reject`, { remarks }).then(r => r.data),

  evaluatePath: (id: string): Promise<EvaluatePolicyPathResult> =>
    getClient().get(`/requisitions/${id}/evaluate-path`).then(r => r.data),

  convertToRfq: (id: string, req: ConvertToRfqRequest): Promise<{ id: string; rfqNumber: string; title: string; rfqStatus: string; responseDeadline: string; createdAt: string }> =>
    getClient().post(`/requisitions/${id}/convert-to-rfq`, req).then(r => r.data),

  convertToPO: (id: string, req: ConvertToPORequest): Promise<{ id: string; poNumber: string; poStatus: string; netAmount: number; createdAt: string }> =>
    getClient().post(`/requisitions/${id}/convert-to-po`, req).then(r => r.data),
};

// ─── Reports APIs ─────────────────────────────────────────────────────────────

export const inventoryReportsApi = {
  gstSummary: (year: number, month: number, storeId?: string): Promise<GstSummaryByRateDto[]> =>
    getClient().get('/reports/gst-summary', { params: { year, month, storeId } }).then(r => r.data),

  gstr3b: (year: number, month: number): Promise<{ year: number; month: number; summary: GstSummaryByRateDto[] }> =>
    getClient().get('/reports/gstr3b', { params: { year, month } }).then(r => r.data),

  vendorReconciliation: (vendorId: string): Promise<VendorReconciliationReport> =>
    getClient().get(`/reports/vendor-reconciliation/${vendorId}`).then(r => r.data),
};

// ─── Item Master Types ────────────────────────────────────────────────────────

export interface ItemDto {
  id: string;
  categoryId?: string;
  itemName: string;
  genericName?: string;
  brand?: string;
  hsnCode?: string;
  unit: string;
  scheduleType?: string;
  requiresColdStorage: boolean;
  isBarcodeTracked: boolean;
  itemType: string;
  reorderLevel: number;
  reorderQuantity: number;
  defaultGstRate?: string;
  linkedInjectorItemId?: string;
  status: string;
}

export interface CreateItemRequest {
  itemName: string;
  genericName?: string;
  brand?: string;
  categoryId?: string;
  hsnCode?: string;
  unit: string;
  scheduleType?: string;
  requiresColdStorage: boolean;
  isBarcodeTracked: boolean;
  itemType: string;
  reorderLevel: number;
  reorderQuantity: number;
  defaultGstRate?: string;
  linkedInjectorItemId?: string;
}

export interface StoreDto {
  id: string;
  storeName: string;
  storeType: string;
  isActive: boolean;
  branchId?: string;
  createdAt?: string;
}

export interface CategoryDto {
  id: string;
  categoryName: string;
  categoryType: string;
  status: string;
  createdAt?: string;
}

// ─── Item APIs ────────────────────────────────────────────────────────────────

export const inventoryItemApi = {
  list: (params?: { page?: number; pageSize?: number; search?: string }): Promise<PagedResult<ItemDto>> =>
    getClient().get('/items', { params: { page: params?.page ?? 1, pageSize: params?.pageSize ?? 20, search: params?.search } }).then(r => r.data),

  get: (id: string): Promise<ItemDto> =>
    getClient().get(`/items/${id}`).then(r => r.data),

  getByBarcode: (code: string): Promise<ItemDto> =>
    getClient().get(`/items/barcode/${code}`).then(r => r.data),

  create: (req: CreateItemRequest): Promise<ItemDto> =>
    getClient().post('/items', req).then(r => r.data),

  update: (id: string, req: CreateItemRequest): Promise<ItemDto> =>
    getClient().put(`/items/${id}`, req).then(r => r.data),

  delete: (id: string): Promise<void> =>
    getClient().delete(`/items/${id}`).then(() => undefined),
};

// ─── Store APIs ───────────────────────────────────────────────────────────────

export const inventoryStoreApi = {
  list: (): Promise<StoreDto[]> =>
    getClient().get('/stores').then(r => r.data),

  get: (id: string): Promise<StoreDto> =>
    getClient().get(`/stores/${id}`).then(r => r.data),

  create: (req: { storeName: string; storeType?: string; branchId?: string }): Promise<StoreDto> =>
    getClient().post('/stores', req).then(r => r.data),

  update: (id: string, req: { storeName: string; storeType?: string; branchId?: string }): Promise<StoreDto> =>
    getClient().put(`/stores/${id}`, req).then(r => r.data),
};

// ─── Category APIs ────────────────────────────────────────────────────────────

export const inventoryCategoryApi = {
  list: (): Promise<CategoryDto[]> =>
    getClient().get('/categories').then(r => r.data),

  get: (id: string): Promise<CategoryDto> =>
    getClient().get(`/categories/${id}`).then(r => r.data),

  create: (req: { categoryName: string; categoryType?: string }): Promise<CategoryDto> =>
    getClient().post('/categories', req).then(r => r.data),

  update: (id: string, req: { categoryName: string; categoryType?: string }): Promise<CategoryDto> =>
    getClient().put(`/categories/${id}`, req).then(r => r.data),
};

// ─── Extended Transfer + Pharmacy APIs ───────────────────────────────────────

export const inventoryTransferApi = {
  list: (params?: { page?: number; pageSize?: number; fromStoreId?: string }): Promise<PagedResult<object>> =>
    getClient().get('/transfers', { params }).then(r => r.data),

  create: (req: object) =>
    getClient().post('/transfers', req).then(r => r.data),

  approve: (id: string): Promise<{ id: string; transferNumber: string; transferStatus: string; updatedAt: string }> =>
    getClient().post(`/transfers/${id}/approve`).then(r => r.data),

  dispatch: (id: string): Promise<{ id: string; transferNumber: string; transferStatus: string; dispatchedAt: string }> =>
    getClient().post(`/transfers/${id}/dispatch`).then(r => r.data),

  receive: (id: string): Promise<{ id: string; transferNumber: string; transferStatus: string; receivedAt: string }> =>
    getClient().post(`/transfers/${id}/receive`).then(r => r.data),

  cancel: (id: string, reason?: string): Promise<void> =>
    getClient().delete(`/transfers/${id}`, { data: { reason } }).then(() => undefined),
};

export const inventoryBillApi = {
  list: (params?: { page?: number; pageSize?: number; storeId?: string }): Promise<PagedResult<object>> =>
    getClient().get('/pharmacy/bills', { params }).then(r => r.data),

  get: (id: string) =>
    getClient().get(`/pharmacy/bills/${id}`).then(r => r.data),

  create: (req: object) =>
    getClient().post('/pharmacy/bills', req).then(r => r.data),

  cancel: (id: string) =>
    getClient().post(`/pharmacy/bills/${id}/cancel`).then(() => undefined),
};

export const inventoryConsumableApi = {
  list: (params?: { page?: number; pageSize?: number; storeId?: string }): Promise<PagedResult<object>> =>
    getClient().get('/surgery/consumables', { params }).then(r => r.data),

  issue: (req: object) =>
    getClient().post('/surgery/consumables', req).then(r => r.data),
};

// ─── Purchase Return Types & APIs ─────────────────────────────────────────────

export interface PurchaseReturnDto {
  id: string;
  returnNumber: string;
  sourceType: string;          // Invoice | GRN | Manual
  invoiceId?: string;
  grnId?: string;
  vendorId: string;
  vendorName: string;
  vendorContact?: string;
  vendorPhone?: string;
  vendorAddress?: string;
  purchaseCategory?: string;
  returnDate: string;
  returnReason: string;
  totalAmount: number;
  taxableAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  netReturnAmount?: number;
  itcReversalAmount?: number;
  cancellationReason?: string;
  settlementStatus: string;    // Pending | SentToVendor | CreditNoteReceived | Settled | Cancelled
  creditNoteNumber?: string;
  creditNoteAmount?: number;
  creditNoteDate?: string;
  paymentMode?: string;
  reference?: string;
  remarks?: string;
  sentToVendorAt?: string;
  settledAt?: string;
  createdAt: string;
  items?: PurchaseReturnItemDto[];
}

export interface PurchaseReturnItemDto {
  id: string;
  itemId: string;
  itemName: string;
  stockBatchId?: string;
  returnQuantity: number;
  freeQuantity: number;
  purchaseRate: number;
  amount: number;
  hsnCode?: string;
  gstPercent?: number;
  cgstPercent?: number;
  sgstPercent?: number;
  igstPercent?: number;
  taxableAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  netAmount?: number;
  returnCause?: string;
  batchNumber?: string;
  expiryDate?: string;
}

export interface CreatePurchaseReturnRequest {
  sourceType: string;          // Invoice | GRN | Manual
  vendorId: string;
  invoiceId?: string;
  grnId?: string;
  purchaseCategory?: string;
  returnDate: string;
  returnReason: string;
  paymentMode?: string;
  reference?: string;
  remarks?: string;
  items: CreateReturnItemRequest[];
}

export interface CreateReturnItemRequest {
  itemId: string;
  stockBatchId?: string;
  returnQuantity: number;
  freeQuantity: number;
  purchaseRate: number;
  returnCause?: string;
  batchNumber?: string;
  expiryDate?: string;        // 'YYYY-MM-DD'
  hsnCode?: string;
  gstPercent?: number;
  cgstPercent?: number;
  sgstPercent?: number;
  igstPercent?: number;
}

export interface RecordCreditNoteRequest {
  creditNoteNumber: string;
  creditNoteAmount: number;
  creditNoteDate: string;     // 'YYYY-MM-DD'
}

export interface ReturnableItemDto {
  itemId: string;
  itemName: string;
  purchaseRate: number;
  batchNumber?: string;
  expiryDate?: string;
  sourceQty: number;
  returnedQty: number;
  returnableQty: number;
}

export const inventoryReturnApi = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    vendorId?: string;
    status?: string;
    sourceType?: string;
    purchaseCategory?: string;
    fromDate?: string;    // 'YYYY-MM-DD'
    toDate?: string;      // 'YYYY-MM-DD'
    search?: string;
  }): Promise<{ total: number; page: number; pageSize: number; items: PurchaseReturnDto[] }> =>
    getClient().get('/purchase-returns', {
      params: { page: params?.page ?? 1, pageSize: params?.pageSize ?? 20, ...params },
    }).then(r => r.data),

  get: (id: string): Promise<PurchaseReturnDto> =>
    getClient().get(`/purchase-returns/${id}`).then(r => r.data),

  create: (req: CreatePurchaseReturnRequest): Promise<{ id: string; returnNumber: string; totalAmount: number; settlementStatus: string; createdAt: string }> =>
    getClient().post('/purchase-returns', req).then(r => r.data),

  sendToVendor: (id: string): Promise<{ id: string; returnNumber: string; settlementStatus: string; sentToVendorAt: string }> =>
    getClient().post(`/purchase-returns/${id}/send-to-vendor`).then(r => r.data),

  recordCreditNote: (id: string, req: RecordCreditNoteRequest): Promise<{ id: string; returnNumber: string; settlementStatus: string; creditNoteNumber: string; creditNoteAmount: number; creditNoteDate: string }> =>
    getClient().post(`/purchase-returns/${id}/record-credit-note`, req).then(r => r.data),

  settle: (id: string): Promise<{ id: string; returnNumber: string; settlementStatus: string; settledAt: string }> =>
    getClient().post(`/purchase-returns/${id}/settle`).then(r => r.data),

  cancel: (id: string, cancellationReason?: string): Promise<void> =>
    getClient().delete(`/purchase-returns/${id}`, { data: cancellationReason ? { cancellationReason } : undefined }).then(() => undefined),

  returnableItems: (params: { sourceType: 'Invoice'; invoiceId: string } | { sourceType: 'GRN'; grnId: string }): Promise<ReturnableItemDto[]> =>
    getClient().get('/purchase-returns/returnable-items', { params }).then(r => r.data),
};

// ─── Auto-Reorder Types & APIs ────────────────────────────────────────────────

export interface ReorderHistoryDto {
  id: string;
  requisitionNumber: string;
  requisitionDate: string;
  requisitionStatus: string;
  remarks?: string;
  createdAt: string;
  storeName?: string;
  itemCount: number;
  items: {
    id: string;
    itemName?: string;
    requiredQuantity: number;
    currentStock: number;
    remarks?: string;
  }[];
}

export interface ReorderConfigDto {
  id: string;
  itemName: string;
  genericName?: string;
  itemType: string;
  unit: string;
  reorderLevel: number;
  reorderQuantity: number;
  currentStock: number;
  belowReorder: boolean;
  stockCoveragePercent?: number;
  reorderSuppressed: boolean;
  reorderSuppressedUntil?: string;
}

export const inventoryReorderApi = {
  /** Manually trigger auto-reorder for the calling tenant */
  trigger: (): Promise<{ success: boolean; message: string; triggeredAt: string }> =>
    getClient().post('/reorder/trigger').then(r => r.data),

  /** List auto-generated purchase requisitions */
  history: (params?: {
    page?: number;
    pageSize?: number;
    status?: string;
  }): Promise<{ items: ReorderHistoryDto[]; total: number; page: number; pageSize: number }> =>
    getClient().get('/reorder/history', { params }).then(r => r.data),

  /** Get per-item reorder configuration with current stock levels */
  config: (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    belowReorder?: boolean;
  }): Promise<{ items: ReorderConfigDto[]; total: number; page: number; pageSize: number }> =>
    getClient().get('/reorder/config', { params }).then(r => r.data),

  /** Update reorder thresholds for a single item */
  updateConfig: (itemId: string, req: {
    reorderLevel?: number;
    reorderQuantity?: number;
  }): Promise<{ id: string; itemName: string; reorderLevel: number; reorderQuantity: number }> =>
    getClient().patch(`/reorder/config/${itemId}`, req).then(r => r.data),

  /** Suppress auto-reorder for an item (indefinite or until a date) */
  suppress: (itemId: string, suppressUntil?: string): Promise<void> =>
    getClient().post(`/reorder/config/${itemId}/suppress`, suppressUntil ? { suppressUntil } : {}).then(() => {}),

  /** Re-enable auto-reorder for a previously suppressed item */
  enable: (itemId: string): Promise<void> =>
    getClient().post(`/reorder/config/${itemId}/enable`).then(() => {}),
};

// ═══════════════════════════════════════════════════════════════════════════════
// PROCUREMENT POLICY API
// ═══════════════════════════════════════════════════════════════════════════════

export interface BranchProcurementPolicy {
  id: string;
  tenantId: string;
  branchId: string;
  policyName: string;
  policyStatus: 'Draft' | 'Published' | 'Superseded';
  directPoLimit: number;
  rfqMandatoryFrom: number;
  dualApprovalFrom: number;
  minVendorQuotes: number;
  emergencyBypassAllowed: boolean;
  emergencyBypassExpiryHours: number;
  publishedAt?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BranchProcurementPolicyVersion {
  id: string;
  policyId: string;
  versionNumber: number;
  directPoLimit: number;
  rfqMandatoryFrom: number;
  dualApprovalFrom: number;
  minVendorQuotes: number;
  emergencyBypassAllowed: boolean;
  emergencyBypassExpiryHours: number;
  changeNotes?: string;
  createdAt: string;
}

export interface SavePolicyDraftRequest {
  branchId: string;
  policyName: string;
  directPoLimit: number;
  rfqMandatoryFrom: number;
  dualApprovalFrom: number;
  minVendorQuotes: number;
  emergencyBypassAllowed: boolean;
  emergencyBypassExpiryHours: number;
  notes?: string;
  policyId?: string;
}

export interface PublishPolicyRequest {
  changeNotes?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface SimulatePolicyRequest {
  branchId: string;
  amount: number;
}

export interface SimulatePolicyResult {
  amount: number;
  recommendedPath: string;
  needsRfq: boolean;
  canDirectPo: boolean;
  needsDualApproval: boolean;
  minVendorQuotes: number;
  emergencyBypassExpiryHours?: number;
}

export const procurementPolicyApi = {
  /** List all policies (all statuses) for a branch */
  list: (branchId: string): Promise<BranchProcurementPolicy[]> =>
    getClient().get('/procurement/policies', { params: { branchId } }).then(r => r.data),

  /** Get the currently Published policy for a branch */
  getActive: (branchId: string): Promise<BranchProcurementPolicy | null> =>
    getClient().get('/procurement/policies/active', { params: { branchId } }).then(r => r.data).catch(() => null),

  /** Create or update a Draft policy */
  saveDraft: (req: SavePolicyDraftRequest): Promise<BranchProcurementPolicy> =>
    getClient().post('/procurement/policies/draft', req).then(r => r.data),

  /** Publish a Draft policy */
  publish: (policyId: string, req: PublishPolicyRequest = {}): Promise<BranchProcurementPolicy> =>
    getClient().post(`/procurement/policies/${policyId}/publish`, req).then(r => r.data),

  /** Get version history for a policy */
  getVersions: (policyId: string): Promise<BranchProcurementPolicyVersion[]> =>
    getClient().get(`/procurement/policies/${policyId}/versions`).then(r => r.data),

  /** Rollback to a prior version (creates a new Draft) */
  rollback: (policyId: string, versionId: string): Promise<BranchProcurementPolicy> =>
    getClient().post(`/procurement/policies/${policyId}/rollback/${versionId}`).then(r => r.data),

  /** Archive a Published or Superseded policy */
  archive: (policyId: string): Promise<{ id: string; policyName: string; policyStatus: string; effectiveTo: string }> =>
    getClient().post(`/procurement/policies/${policyId}/archive`).then(r => r.data),

  /** Simulate which procurement path applies for a given amount */
  simulate: (req: SimulatePolicyRequest): Promise<SimulatePolicyResult> =>
    getClient().post('/procurement/policies/simulate', req).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════════════════════
// RFQ API
// ═══════════════════════════════════════════════════════════════════════════════

export interface RfqHeader {
  id: string;
  tenantId: string;
  branchId: string;
  requisitionId?: string;
  rfqNumber: string;
  title: string;
  rfqStatus: 'Draft' | 'Published' | 'ResponseWindowClosed' | 'EvaluationInProgress' | 'NegotiationRequired' | 'PendingFinalApproval' | 'Awarded' | 'Closed' | 'Cancelled';
  publishedAt?: string;
  responseDeadline?: string;
  awardedAt?: string;
  awardedToVendorId?: string;
  awardedToVendorName?: string;
  cancellationReason?: string;
  awardAcknowledgmentStatus?: AckStatus;
  linkedPurchaseOrderId?: string;
  linkedPurchaseOrderNumber?: string;
  linkedPurchaseOrderStatus?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  items?: RfqItemDto[];
  vendorInvites?: RfqVendorInviteDto[];
  vendorQuotes?: VendorQuoteDto[];
}

export interface RfqItemDto {
  id: string;
  itemId: string;
  item?: { id: string; itemName: string; unit: string };
  requestedQty: number;
  unit: string;
  specifications?: string;
}

export interface RfqVendorInviteDto {
  id: string;
  vendorId: string;
  vendor?: { id: string; vendorName: string };
  inviteStatus: string;
  invitedAt: string;
  viewedAt?: string;
  respondedAt?: string;
}

export interface VendorQuoteDto {
  id: string;
  rfqId: string;
  vendorId: string;
  vendor?: { id: string; name: string };
  quoteNumber: string;
  quoteStatus: string;
  totalAmount: number;
  quoteDate: string;
  validUntil?: string;
  vendorNotes?: string;
  evaluationNotes?: string;
  evaluationScore?: number;
  rankPosition?: number;
  clarificationNotes?: string;
  clarificationRequestedAt?: string;
  revisedAt?: string;
  items?: VendorQuoteItemDto[];
}

export interface VendorQuoteItemDto {
  id: string;
  itemId: string;
  item?: { id: string; itemName: string };
  quotedQty: number;
  unitPrice: number;
  gstPercent: number;
  totalAmount: number;
  remarks?: string;
}

export interface CreateRfqRequest {
  branchId: string;
  title: string;
  requisitionId?: string;
  items: { itemId: string; requestedQty: number; unit: string; specifications?: string }[];
  vendorIds: string[];
  responseDeadline?: string;
  notes?: string;
}

export interface SubmitQuoteRequest {
  vendorId: string;
  items: { itemId: string; quotedQty: number; unitPrice: number; gstPercent: number; totalAmount: number; remarks?: string }[];
  validUntil?: string;
  vendorNotes?: string;
}

// ─── Vendor Acknowledgment ───────────────────────────────────────────────────
export type AckStatus = 'Pending' | 'Acknowledged' | 'Declined' | 'Expired';
export type AckChannel = 'Email' | 'WhatsApp' | 'SMS' | 'Call' | 'Other';

export interface VendorAcknowledgmentDto {
  id: string;
  tenantId: string;
  vendorId: string;
  vendorName?: string;
  entityType: 'RfqAward' | 'PurchaseOrder';
  entityId: string;
  ackStatus: AckStatus;
  channel?: AckChannel;
  contactTarget?: string;
  acknowledgedAt?: string;
  acknowledgedByUserId?: string;
  ackNotes?: string;
  declineReason?: string;
  expiresAt: string;
  remindersSent: number;
  createdAt: string;
  updatedAt: string;
}

export const vendorAckApi = {
  getByEntity: (entityType: 'RfqAward' | 'PurchaseOrder', entityId: string): Promise<VendorAcknowledgmentDto | null> =>
    getClient().get('/vendor-acknowledgments', { params: { entityType, entityId } })
      .then(r => r.data)
      .catch(e => e?.response?.status === 404 ? null : Promise.reject(e)),

  listPending: (): Promise<VendorAcknowledgmentDto[]> =>
    getClient().get('/vendor-acknowledgments/pending').then(r => r.data),

  create: (vendorId: string, entityType: 'RfqAward' | 'PurchaseOrder', entityId: string, expiresInHours?: number): Promise<VendorAcknowledgmentDto> =>
    getClient().post('/vendor-acknowledgments', { vendorId, entityType, entityId, expiresInHours }).then(r => r.data),

  confirm: (id: string, status: 'Acknowledged' | 'Declined', channel: AckChannel, contactTarget?: string, ackNotes?: string, declineReason?: string): Promise<VendorAcknowledgmentDto> =>
    getClient().post(`/vendor-acknowledgments/${id}/confirm`, { status, channel, contactTarget, ackNotes, declineReason }).then(r => r.data),
};
// ─────────────────────────────────────────────────────────────────────────────

export const rfqApi = {
  list: (params?: { branchId?: string; status?: string; page?: number; pageSize?: number }): Promise<{
    totalCount: number; page: number; pageSize: number;
    items: Pick<RfqHeader, 'id' | 'rfqNumber' | 'title' | 'rfqStatus' | 'branchId' | 'responseDeadline' | 'createdAt' | 'awardedToVendorId' | 'awardedToVendorName' | 'cancellationReason' | 'awardAcknowledgmentStatus' | 'linkedPurchaseOrderId' | 'linkedPurchaseOrderNumber' | 'linkedPurchaseOrderStatus'>[];
  }> => getClient().get('/rfqs', { params }).then(r => r.data),

  get: (id: string): Promise<RfqHeader> =>
    getClient().get(`/rfqs/${id}`).then(r => r.data),

  create: (req: CreateRfqRequest): Promise<{ id: string; rfqNumber: string; rfqStatus: string; createdAt: string }> =>
    getClient().post('/rfqs', req).then(r => r.data),

  publish: (id: string): Promise<{ id: string; rfqNumber: string; rfqStatus: string; publishedAt: string }> =>
    getClient().post(`/rfqs/${id}/publish`).then(r => r.data),

  closeResponseWindow: (id: string): Promise<{ id: string; rfqStatus: string }> =>
    getClient().post(`/rfqs/${id}/close-response-window`).then(r => r.data),

  startEvaluation: (id: string): Promise<{ id: string; rfqStatus: string }> =>
    getClient().post(`/rfqs/${id}/start-evaluation`).then(r => r.data),

  award: (id: string, vendorId: string): Promise<{ id: string; rfqStatus: string; awardedToVendorId: string; awardedAt: string }> =>
    getClient().post(`/rfqs/${id}/award`, { vendorId }).then(r => r.data),

  close: (id: string): Promise<{ id: string; rfqStatus: string }> =>
    getClient().post(`/rfqs/${id}/close`).then(r => r.data),

  cancel: (id: string, reason: string): Promise<{ id: string; rfqStatus: string }> =>
    getClient().post(`/rfqs/${id}/cancel`, { reason }).then(r => r.data),

  getQuotes: (id: string): Promise<VendorQuoteDto[]> =>
    getClient().get(`/rfqs/${id}/quotes`).then(r => r.data),

  submitQuote: (rfqId: string, req: SubmitQuoteRequest): Promise<{ id: string; quoteNumber: string; quoteStatus: string; totalAmount: number }> =>
    getClient().post(`/rfqs/${rfqId}/quotes`, req).then(r => r.data),

  requestClarification: (rfqId: string, quoteId: string, notes: string): Promise<{ id: string; quoteStatus: string; clarificationRequestedAt: string }> =>
    getClient().post(`/rfqs/${rfqId}/quotes/${quoteId}/request-clarification`, { notes }).then(r => r.data),

  rankQuotes: (rfqId: string, rankings: Array<{ quoteId: string; rankPosition: number; score?: number; notes?: string }>): Promise<{ id: string; rankPosition: number; quoteStatus: string }> =>
    getClient().post(`/rfqs/${rfqId}/quotes/rank`, { rankings }).then(r => r.data),

  disqualifyQuote: (rfqId: string, quoteId: string, reason: string): Promise<{ id: string; quoteStatus: string }> =>
    getClient().post(`/rfqs/${rfqId}/quotes/${quoteId}/disqualify`, { reason }).then(r => r.data),

  requestNegotiation: (id: string, reason: string): Promise<{ id: string; rfqStatus: string }> =>
    getClient().post(`/rfqs/${id}/request-negotiation`, { reason }).then(r => r.data),

  resolveNegotiation: (id: string, reason: string): Promise<{ id: string; rfqStatus: string }> =>
    getClient().post(`/rfqs/${id}/resolve-negotiation`, { reason }).then(r => r.data),

  submitForApproval: (id: string, proposedVendorId: string): Promise<{ id: string; rfqStatus: string; awardedToVendorId: string }> =>
    getClient().post(`/rfqs/${id}/submit-for-approval`, { proposedVendorId }).then(r => r.data),

  rejectApproval: (id: string, reason: string): Promise<{ id: string; rfqStatus: string }> =>
    getClient().post(`/rfqs/${id}/reject-approval`, { reason }).then(r => r.data),

  getHistory: (id: string): Promise<Array<{ id: string; fromStatus?: string; toStatus: string; reason?: string; actorUserId?: string; transitionedAt: string }>> =>
    getClient().get(`/rfqs/${id}/history`).then(r => r.data),
};

// ═══════════════════════════════════════════════════════════════════════════════
// PURCHASE ORDER API
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProcurementTransitionLogDto {
  entityType: string;
  entityId: string;
  fromStatus?: string;
  toStatus: string;
  reason?: string;
  actorUserId?: string;
  transitionedAt: string;
}

export interface PurchaseOrderDto {
  id: string;
  tenantId: string;
  branchId: string;
  requisitionId?: string;
  rfqId?: string;
  sourceType: 'RFQ' | 'Direct' | 'Emergency';
  poNumber: string;
  vendorId: string;
  vendorName?: string;
  vendor?: { id: string; vendorName: string };
  poStatus: 'Draft' | 'Submitted' | 'L1Approved' | 'L2Approved' | 'Approved' | 'Rejected' | 'SentToVendor' | 'PartiallyReceived' | 'FullyReceived' | 'Closed' | 'Cancelled';
  totalAmount: number;
  gstAmount: number;
  netAmount: number;
  poDate: string;
  expectedDeliveryDate?: string;
  sentToVendorAt?: string;
  l1ApprovedAt?: string;
  l1ApprovedByUserId?: string;
  l1Remarks?: string;
  l2ApprovedAt?: string;
  l2ApprovedByUserId?: string;
  l2Remarks?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  isEmergency: boolean;
  emergencyBypassExpiry?: string;
  terms?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  items?: PurchaseOrderItemDto[];
  transitionLogs?: ProcurementTransitionLogDto[];
}

export interface PurchaseOrderItemDto {
  id: string;
  itemId: string;
  item?: { id: string; itemName: string; unit: string };
  orderedQty: number;
  receivedQty: number;
  unitPrice: number;
  gstPercent: number;
  totalAmount: number;
  unit: string;
  requiredBy?: string;
  remarks?: string;
}

export interface CreatePurchaseOrderRequest {
  branchId: string;
  vendorId: string;
  vendorName?: string;
  sourceType: 'RFQ' | 'Direct' | 'Emergency';
  requisitionId?: string;
  rfqId?: string;
  rfqAwardId?: string;
  items: {
    itemId: string;
    itemName?: string;
    orderedQty: number;
    unitPrice: number;
    gstPercent: number;
    unit: string;
    requiredBy?: string;
    remarks?: string;
  }[];
  expectedDeliveryDate?: string;
  isEmergency?: boolean;
  terms?: string;
  notes?: string;
}

export interface UpdatePurchaseOrderRequest {
  branchId: string;
  vendorId: string;
  items: {
    itemId: string;
    orderedQty: number;
    unitPrice: number;
    gstPercent: number;
    totalAmount: number;
    unit: string;
    requiredBy?: string;
    remarks?: string;
  }[];
  expectedDeliveryDate?: string;
  isEmergency?: boolean;
  terms?: string;
  notes?: string;
}

export const purchaseOrderApi = {
  list: (params?: { branchId?: string; status?: string; page?: number; pageSize?: number }): Promise<{
    totalCount: number; page: number; pageSize: number;
    items: (Pick<PurchaseOrderDto, 'id' | 'poNumber' | 'poStatus' | 'sourceType' | 'vendorId' | 'netAmount' | 'poDate' | 'isEmergency' | 'createdAt'> & { vendorName?: string })[];
  }> => getClient().get('/purchase-orders', { params }).then(r => r.data),

  get: (id: string): Promise<PurchaseOrderDto> =>
    getClient().get(`/purchase-orders/${id}`).then(r => r.data),

  create: (req: CreatePurchaseOrderRequest): Promise<{ id: string; poNumber: string; poStatus: string; netAmount: number; createdAt: string }> =>
    getClient().post('/purchase-orders', req).then(r => r.data),

  update: (id: string, req: UpdatePurchaseOrderRequest): Promise<{ id: string; poNumber: string; poStatus: string; netAmount: number; updatedAt: string }> =>
    getClient().put(`/purchase-orders/${id}`, req).then(r => r.data),

  submit: (id: string): Promise<{ id: string; poNumber: string; poStatus: string }> =>
    getClient().post(`/purchase-orders/${id}/submit`).then(r => r.data),

  approveL1: (id: string, req?: { remarks?: string }): Promise<{ id: string; poNumber: string; poStatus: string; l1ApprovedAt: string }> =>
    getClient().post(`/purchase-orders/${id}/approve-l1`, req ?? {}).then(r => r.data),

  approveL2: (id: string, req?: { remarks?: string }): Promise<{ id: string; poNumber: string; poStatus: string; l2ApprovedAt: string }> =>
    getClient().post(`/purchase-orders/${id}/approve-l2`, req ?? {}).then(r => r.data),

  reject: (id: string, req: { remarks?: string }): Promise<{ id: string; poNumber: string; poStatus: string; rejectedAt: string }> =>
    getClient().post(`/purchase-orders/${id}/reject`, req).then(r => r.data),

  sendToVendor: (id: string, req?: { channel?: string; contactTarget?: string; notes?: string }): Promise<{
    id: string; poNumber: string; poStatus: string; sentToVendorAt: string;
    ackId?: string; notificationSent?: boolean;
  }> =>
    getClient().post(`/purchase-orders/${id}/send-to-vendor`, req ?? {}).then(r => r.data),

  cancel: (id: string, req: { reason: string }): Promise<{ id: string; poNumber: string; poStatus: string }> =>
    getClient().post(`/purchase-orders/${id}/cancel`, req).then(r => r.data),

  close: (id: string): Promise<{ id: string; poNumber: string; poStatus: string }> =>
    getClient().post(`/purchase-orders/${id}/close`).then(r => r.data),

  receive: (id: string, req: RecordPoReceiptRequest): Promise<{
    id: string; poNumber: string; poStatus: string; receivedAt?: string; actualDeliveryDate?: string;
  }> => getClient().post(`/purchase-orders/${id}/receive`, req).then(r => r.data),

  generateGrn: (id: string): Promise<GrnHeaderDto> =>
    getClient().post(`/purchase-orders/${id}/generate-grn`).then(r => r.data),
};

// ══════════════════════════════════════════════════════════════════════════════
// WEEK 3: RECEIPT, VENDOR PERFORMANCE & DASHBOARD TYPES
// ══════════════════════════════════════════════════════════════════════════════

export interface RecordPoReceiptItemLine {
  itemId: string;
  receivedQty: number;
  batchNumber?: string;
  expiryDate?: string;
  mrp?: number;
  barcode?: string;
}

export interface RecordPoReceiptRequest {
  storeId: string;
  items: RecordPoReceiptItemLine[];
  actualDeliveryDate?: string;
  notes?: string;
}

export interface VendorPerformanceSummaryDto {
  vendorId: string;
  vendorName: string;
  totalOrders: number;
  onTimeDeliveryRate: number;  // 0–100
  avgFulfillmentRate: number;  // 0–100
  avgRating?: number;          // 1–5
}

export interface InventoryDashboardSummary {
  pendingRequisitions: number;
  openRfqs: number;
  pendingPoCount: number;
  lowStockCount: number;
  thisMonthPoSpend: number;
  onTimeDeliveryRate: number;  // 0–100
}

// ══════════════════════════════════════════════════════════════════════════════
// INVENTORY DASHBOARD API
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// WEEK 4: EXPIRY BATCH TYPE
// ══════════════════════════════════════════════════════════════════════════════

export interface ExpiringBatchDto {
  id: string;
  itemId: string;
  itemName?: string;
  storeId: string;
  storeName?: string;
  batchNumber?: string;
  expiryDate: string;
  quantityAvailable: number;
  requiresColdStorage: boolean;
}

export const inventoryDashboardApi = {
  getSummary: (): Promise<InventoryDashboardSummary> =>
    getClient().get('/inventory/dashboard').then(r => r.data),

  getVendorPerformance: (params?: { vendorId?: string; page?: number; pageSize?: number }): Promise<{
    totalCount: number; page: number; pageSize: number; items: VendorPerformanceSummaryDto[];
  }> => getClient().get('/inventory/vendor-performance', { params }).then(r => r.data),

};

// ─── Bill Transfer ────────────────────────────────────────────────────────────

export type BillTransferStatus =
  | 'Draft'
  | 'Resubmitted'
  | 'L1Approved'
  | 'L1Rejected'
  | 'L2Rejected'
  | 'FullyApproved'
  | 'Cancelled';

export type BtSlaState = 'OnTrack' | 'AtRisk' | 'Breached';

export interface BillTransferDto {
  id: string;
  tenantId: string;
  grnId: string;
  invoiceId: string;
  vendorId: string;
  vendorName?: string;
  grnNumber?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  grnDate?: string;
  grnTotalAmount: number;
  invoiceTotalAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  tcsAmount: number;
  status: BillTransferStatus;
  l1ApprovedBy?: string;
  l1ApprovedAt?: string;
  l1Remarks?: string;
  l2ApprovedBy?: string;
  l2ApprovedAt?: string;
  l2Remarks?: string;
  remarks?: string;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
  // Phase 1+ additions
  versionNo: number;
  createdByUserId?: string;
  // Phase 4 SLA
  l1DueAt?: string;
  l2DueAt?: string;
  slaState: BtSlaState;
}

export interface SodDecisionDto {
  strictApplied: boolean;
  overrideApplied: boolean;
  thresholdUsed: number;
  ruleEvaluations: string[];
}

export interface BillTransferActionResultDto {
  billTransfer: BillTransferDto;
  sodDecision?: SodDecisionDto;
}

export interface BillTransferEventLogDto {
  eventId: string;
  billTransferId: string;
  fromStatus?: string;
  toStatus: string;
  action: string;
  actorUserId: string;
  actorRole?: string;
  reasonCode?: string;
  reasonText?: string;
  overrideApplied: boolean;
  createdAt: string;
}

export interface BillTransferReasonCatalogDto {
  id: string;
  reasonCode: string;
  reasonLabel: string;
  category: string;
  sortOrder: number;
}

export interface BillTransferPolicyDto {
  tenantId: string;
  lowValueOverrideThreshold: number;
  allowLowValueFlexOverride: boolean;
  requireOverrideReason: boolean;
  updatedAt?: string;
}

export interface BillTransferChangesDto {
  items: BillTransferDto[];
  serverTimestamp: string;
}

export interface BtComplianceReportDto {
  totalBillTransfers: number;
  strictApprovals: number;
  overrideApprovals: number;
  overridePct: number;
  slaBreached: number;
  meanApprovalCycleHours: number;
  generatedAt: string;
}

export interface ApproveBillTransferRequest {
  remarks?: string;
  expectedVersion?: number;
  overrideReasonCode?: string;
  overrideReasonText?: string;
}

export const inventoryBillTransferApi = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    status?: BillTransferStatus;
  }): Promise<{ total: number; page: number; pageSize: number; items: BillTransferDto[] }> =>
    getClient().get('/bill-transfers', { params: { page: params?.page ?? 1, pageSize: params?.pageSize ?? 20, ...params } }).then(r => r.data),

  get: (id: string): Promise<BillTransferDto> =>
    getClient().get(`/bill-transfers/${id}`).then(r => r.data),

  getEventLog: (id: string): Promise<BillTransferEventLogDto[]> =>
    getClient().get(`/bill-transfers/${id}/event-log`).then(r => r.data),

  getChanges: (since: string): Promise<BillTransferChangesDto> =>
    getClient().get('/bill-transfers/changes', { params: { since } }).then(r => r.data),

  getPolicy: (): Promise<BillTransferPolicyDto> =>
    getClient().get('/bill-transfers/policy').then(r => r.data),

  upsertPolicy: (body: Partial<BillTransferPolicyDto>): Promise<BillTransferPolicyDto> =>
    getClient().put('/bill-transfers/policy', body).then(r => r.data),

  getReasonCatalog: (category?: string): Promise<BillTransferReasonCatalogDto[]> =>
    getClient().get('/bill-transfers/reason-catalog', { params: category ? { category } : {} }).then(r => r.data),

  getComplianceReport: (): Promise<BtComplianceReportDto> =>
    getClient().get('/bill-transfers/compliance').then(r => r.data),

  generate: (grnId: string): Promise<BillTransferDto> =>
    getClient().post(`/bill-transfers/from-grn/${grnId}`).then(r => r.data),

  l1Approve: (id: string, req: ApproveBillTransferRequest, idempotencyKey?: string): Promise<BillTransferActionResultDto> =>
    getClient().post(`/bill-transfers/${id}/l1-approve`, req, idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}).then(r => r.data),

  l1Reject: (id: string, remarks?: string, expectedVersion?: number): Promise<BillTransferDto> =>
    getClient().post(`/bill-transfers/${id}/l1-reject`, { remarks, expectedVersion }).then(r => r.data),

  l2Approve: (id: string, req: ApproveBillTransferRequest, idempotencyKey?: string): Promise<BillTransferActionResultDto> =>
    getClient().post(`/bill-transfers/${id}/l2-approve`, req, idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}).then(r => r.data),

  l2Reject: (id: string, remarks?: string, expectedVersion?: number): Promise<BillTransferDto> =>
    getClient().post(`/bill-transfers/${id}/l2-reject`, { remarks, expectedVersion }).then(r => r.data),

  resubmit: (id: string, remarks?: string, expectedVersion?: number): Promise<BillTransferDto> =>
    getClient().post(`/bill-transfers/${id}/resubmit`, { remarks, expectedVersion }).then(r => r.data),

  cancel: (id: string, expectedVersion?: number): Promise<BillTransferDto> =>
    getClient().post(`/bill-transfers/${id}/cancel`, { expectedVersion }).then(r => r.data),
};

// ─── Invoice Settlement ───────────────────────────────────────────────────────

export type SettlementStatus =
  | 'Pending'
  | 'PartiallyPaid'
  | 'FullySettled'
  | 'Overdue'
  | 'OnHold'
  | 'Cancelled'
  | 'WrittenOff';

export interface SettlementPaymentDto {
  id: string;
  paymentId?: string;
  amountAllocated: number;
  allocationType: 'Payment' | 'CreditNote' | 'Advance' | 'Adjustment' | 'Reversal';
  reference?: string;
  appliedAt: string;
  // Payment-method detail (null for credit-note allocations)
  paymentMethod?: 'NEFT' | 'RTGS' | 'Cheque' | 'Cash' | 'UPI';
  utrNumber?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  chequeNumber?: string;
  chequeDate?: string;
  expectedClearanceDate?: string;
  upiId?: string;
  upiApp?: string;
  cashReceiptNumber?: string;
  cashReceivedBy?: string;
  remarks?: string;
  // Proof attachment
  attachmentUrl?: string;
  attachmentFilename?: string;
  attachmentSizeKb?: number;
}

export interface InvoiceSettlementDto {
  id: string;
  tenantId: string;
  billTransferId: string;
  vendorId: string;
  vendorName?: string;
  grnNumber?: string;
  invoiceNumber?: string;
  grossAmount: number;
  debitNoteAdjustment: number;
  tcsAmount: number;
  netPayableAmount: number;
  amountPaid: number;
  balanceRemaining: number;
  status: SettlementStatus;
  dueDate?: string;
  settledAt?: string;
  onHoldReason?: string;
  cancellationReason?: string;
  writeOffReason?: string;
  createdAt: string;
  updatedAt: string;
  payments: SettlementPaymentDto[];
}

export interface RecordSettlementPaymentRequest {
  amount: number;
  paymentMethod: 'NEFT' | 'RTGS' | 'Cheque' | 'Cash' | 'UPI';
  transactionReference: string;
  paymentDate: string; // ISO datetime
  remarks?: string;
  // NEFT / RTGS
  utrNumber?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  // Cheque
  chequeDate?: string;
  expectedClearanceDate?: string;
  // UPI
  upiId?: string;
  upiApp?: string;
  // Cash
  cashReceiptNumber?: string;
  cashReceivedBy?: string;
}

// ─── Vendor Bank Accounts ─────────────────────────────────────────────────────

export interface VendorBankAccountDto {
  id: string;
  vendorId: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  maskedAccountNumber: string;
  ifscCode: string;
  accountType: 'current' | 'savings' | 'cc' | 'od';
  isPrimary: boolean;
  nickname?: string;
  createdAt: string;
}

export interface CreateVendorBankAccountRequest {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  accountType: 'current' | 'savings' | 'cc' | 'od';
  isPrimary?: boolean;
  nickname?: string;
}

export const inventoryVendorBankAccountApi = {
  list: (vendorId: string): Promise<VendorBankAccountDto[]> =>
    getClient().get(`/vendors/${vendorId}/bank-accounts`).then(r => r.data),

  create: (vendorId: string, req: CreateVendorBankAccountRequest): Promise<VendorBankAccountDto> =>
    getClient().post(`/vendors/${vendorId}/bank-accounts`, req).then(r => r.data),

  remove: (vendorId: string, accountId: string): Promise<void> =>
    getClient().delete(`/vendors/${vendorId}/bank-accounts/${accountId}`).then(() => undefined),

  setPrimary: (vendorId: string, accountId: string): Promise<VendorBankAccountDto> =>
    getClient().patch(`/vendors/${vendorId}/bank-accounts/${accountId}/set-primary`).then(r => r.data),
};

export interface SettlementEventLogDto {
  id: string;
  fromStatus: string;
  toStatus: string;
  eventType: string;
  reason?: string;
  amount?: number;
  actorUserId?: string;
  actorType: 'user' | 'system';
  occurredAt: string;
}

export const inventorySettlementApi = {
  list: (params?: {
    page?: number;
    pageSize?: number;
    status?: SettlementStatus;
  }): Promise<{ total: number; page: number; pageSize: number; items: InvoiceSettlementDto[] }> =>
    getClient().get('/settlements', { params: { page: params?.page ?? 1, pageSize: params?.pageSize ?? 20, ...params } }).then(r => r.data),

  get: (id: string): Promise<InvoiceSettlementDto> =>
    getClient().get(`/settlements/${id}`).then(r => r.data),

  recordPayment: (id: string, req: RecordSettlementPaymentRequest): Promise<InvoiceSettlementDto> =>
    getClient().post(`/settlements/${id}/record-payment`, req).then(r => r.data),

  applyCreditNote: (id: string, purchaseReturnId: string, remarks?: string): Promise<InvoiceSettlementDto> =>
    getClient().post(`/settlements/${id}/apply-credit-note`, { purchaseReturnId, remarks }).then(r => r.data),

  hold: (id: string, reason: string): Promise<InvoiceSettlementDto> =>
    getClient().post(`/settlements/${id}/hold`, { reason }).then(r => r.data),

  resume: (id: string): Promise<InvoiceSettlementDto> =>
    getClient().post(`/settlements/${id}/resume`).then(r => r.data),

  cancel: (id: string, reason: string): Promise<InvoiceSettlementDto> =>
    getClient().post(`/settlements/${id}/cancel`, { reason }).then(r => r.data),

  writeOff: (id: string, reason: string): Promise<InvoiceSettlementDto> =>
    getClient().post(`/settlements/${id}/write-off`, { reason }).then(r => r.data),

  getEventLogs: (id: string): Promise<SettlementEventLogDto[]> =>
    getClient().get(`/settlements/${id}/event-logs`).then(r => r.data),

  uploadPaymentProof: (settlementId: string, paymentId: string, file: File): Promise<{ url: string; filename: string; sizeKb: number }> =>
    getClient().post(`/settlements/${settlementId}/payments/${paymentId}/proof`, file, {
      headers: {
        'Content-Type': file.type,
        'X-Filename': encodeURIComponent(file.name),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    }).then(r => r.data),
};