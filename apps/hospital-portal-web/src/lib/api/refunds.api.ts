/**
 * Refunds API Service
 * Phase 1 Critical Gates - Refund Management
 * Handles refund requests, authorization, and completion
 */

import { getApi } from '../api';
import {
  buildAuthorizeRefundBody,
  buildAuthorizeRefundPath,
  buildCompleteRefundBody,
  buildCompleteRefundPath,
  buildRequestRefundRequest,
  refundsByBillPath,
} from '../billing/refund-contract';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface Refund {
  id: string;
  tenantId: string;
  opdBillId: string;
  patientId: string;
  visitId?: string;
  refundAmount: number;
  refundReason: string;
  refundMode: RefundMode;
  requestedByUserId: string;
  requestedAt: string;
  authorizedByUserId?: string;
  authorizedAt?: string;
  completedByUserId?: string;
  completedAt?: string;
  status: RefundStatus;
  denialReason?: string;
  paymentReference?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  
  // Related data
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    mrn: string;
    phone?: string;
  };
  opdBill?: {
    id: string;
    billNumber: string;
    netAmount: number;
    amountPaid: number;
  };
  requestedByUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  authorizedByUser?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export type RefundMode = 'cash' | 'card' | 'upi' | 'net_banking' | 'cheque';
export type RefundStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export interface RequestRefundRequest {
  opdBillId: string;
  refundAmount: number;
  refundReason: string;
  refundMode: RefundMode;
  notes?: string;
}

export interface AuthorizeRefundRequest {
  refundId: string;
  approved: boolean;
  denialReason?: string;
  notes?: string;
}

export interface CompleteRefundRequest {
  refundId: string;
  refundMode: RefundMode;
  notes?: string;
}

export interface RefundStatistics {
  totalRefunds: number;
  totalAmount: number;
  pendingCount: number;
  pendingAmount: number;
  approvedCount: number;
  approvedAmount: number;
  completedCount: number;
  completedAmount: number;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Request a refund
 */
export const requestRefund = async (request: RequestRefundRequest): Promise<Refund> => {
  const api = getApi();
  const response = await api.post('/refunds/request', buildRequestRefundRequest(request));
  return response.data;
};

/**
 * Get refund by ID
 */
export const getRefund = async (id: string): Promise<Refund> => {
  const api = getApi();
  const response = await api.get(`/refunds/${id}`);
  return response.data;
};

/**
 * Get all refunds (with optional filters)
 */
export const getRefunds = async (params?: {
  status?: RefundStatus;
  patientId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: Refund[]; total: number }> => {
  const api = getApi();
  const response = await api.get('/refunds', { params });
  return response.data;
};

/**
 * Get pending refunds (authorization queue)
 */
export const getPendingRefunds = async (): Promise<Refund[]> => {
  const api = getApi();
  const response = await api.get('/refunds/pending');
  return response.data;
};

/**
 * Authorize refund (approve/reject)
 */
export const authorizeRefund = async (request: AuthorizeRefundRequest): Promise<Refund> => {
  const api = getApi();
  const response = await api.post(
    buildAuthorizeRefundPath(request.refundId),
    buildAuthorizeRefundBody(request),
  );
  return response.data;
};

/**
 * Complete refund (mark as paid). Ledger payment reference is assigned by Auth.
 */
export const completeRefund = async (request: CompleteRefundRequest): Promise<Refund> => {
  const api = getApi();
  const response = await api.post(
    buildCompleteRefundPath(request.refundId),
    buildCompleteRefundBody(request),
  );
  return response.data;
};

/**
 * Get refund statistics
 */
export const getRefundStatistics = async (params?: {
  startDate?: string;
  endDate?: string;
}): Promise<RefundStatistics> => {
  const api = getApi();
  const response = await api.get('/refunds/statistics', { params });
  return response.data;
};

/**
 * Get refunds by bill ID
 */
export const getRefundsByBill = async (billId: string): Promise<Refund[]> => {
  const api = getApi();
  const response = await api.get(refundsByBillPath(billId));
  const payload = response.data;
  return Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
};

// ============================================================================
// Export as namespace
// ============================================================================

export const refundsApi = {
  requestRefund,
  getRefund,
  getRefunds,
  getPendingRefunds,
  authorizeRefund,
  completeRefund,
  getRefundStatistics,
  getRefundsByBill,
};

export default refundsApi;
