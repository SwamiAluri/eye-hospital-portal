/**
 * Visits API Service
 * Handles OPD visits, check-in, queue management
 * Part of Phase 1 OPD Workflow implementation
 */

import { getApi } from '../api';
import { normalizeStationId } from '../frontdesk/station-ids';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface Visit {
  id: string;
  tenantId: string;
  patientId: string;
  appointmentId: string;
  opdBillId?: string;
  branchId: string;
  consultantId?: string;
  departmentId?: string;
  visitType: VisitType;
  visitCategory: VisitCategory;
  status: VisitStatus;
  tokenNumber: string;
  tokenSequence: number;
  checkedInAt?: string;
  checkedInBy?: string;
  currentStation?: string;
  assignedTo?: string;
  assignedAt?: string;
  completedAt?: string;
  completedBy?: string;
  outcome?: string;
  outcomeNotes?: string;
  isEmergency: boolean;
  emergencyAuthorizedBy?: string;
  emergencyReason?: string;
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
  appointment?: {
    id: string;
    appointmentDate: string;
    appointmentTime: string;
    consultantName?: string;
    departmentName?: string;
  };
  opdBill?: {
    id: string;
    billNumber: string;
    netAmount: number;
    amountPaid: number;
    status: string;
  };
}

export type VisitType = 'new' | 'follow_up' | 'review' | 'emergency';
export type VisitCategory = 'consultation' | 'procedure' | 'diagnostic' | 'surgery' | 'post_op';
export type VisitStatus = 
  | 'checked_in'
  | 'waiting'
  | 'in_consultation'
  | 'in_procedure'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface CheckInValidation {
  // Backend field names
  patientValid: boolean;
  patientMessage?: string;
  appointmentValid: boolean;
  appointmentMessage?: string;
  billValid: boolean;
  billMessage?: string;
  billId?: string;
  paymentValid: boolean;
  paymentMessage?: string;
  amountDue?: number;
  canCheckIn: boolean;
  canEmergencyCheckIn: boolean;
}

export interface CheckInRequest {
  appointmentId: string;
  opdBillId?: string;
  departmentId?: string;
  notes?: string;
  isEmergency?: boolean;
  emergencyReason?: string;
}

export interface CheckInResult {
  success: boolean;
  visit?: Visit;
  tokenNumber?: string;
  message?: string;
  errors?: string[];
}

export interface SendToRequest {
  visitId: string;
  station: string;
  assignedTo?: string;
  notes?: string;
  reasonCode?: string;
}

export interface CompleteVisitRequest {
  visitId: string;
  outcome?: string;
  outcomeNotes?: string;
}

export interface QueueItem {
  visitId: string;
  tokenNumber: string;
  tokenSequence: number;
  patientName: string;
  mrn: string;
  appointmentTime: string;
  consultantName?: string;
  departmentName?: string;
  currentStation?: string;
  status: VisitStatus;
  waitTime: number; // in minutes
  isEmergency: boolean;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get Visit by ID
 */
export const getVisit = async (id: string): Promise<Visit> => {
  const api = getApi();
  const response = await api.get(`/visits/${id}`);
  return response.data;
};

/**
 * Get Visit by Appointment ID
 */
export const getVisitByAppointment = async (appointmentId: string): Promise<Visit | null> => {
  const api = getApi();
  try {
    const response = await api.get(`/visits/by-appointment/${appointmentId}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) return null;
    throw error;
  }
};

/**
 * Validate check-in (4-condition gate)
 */
export const validateCheckIn = async (appointmentId: string): Promise<CheckInValidation> => {
  const api = getApi();
  const response = await api.get(`/visits/validate-checkin/${appointmentId}`);
  return response.data;
};

/**
 * Perform check-in
 */
export const checkIn = async (request: CheckInRequest): Promise<CheckInResult> => {
  const api = getApi();
  const response = await api.post('/visits/checkin', request);
  return response.data;
};

/**
 * Send patient to station
 */
export const sendTo = async (request: SendToRequest): Promise<Visit> => {
  const api = getApi();
  const response = await api.post('/visits/send-to', {
    ...request,
    station: normalizeStationId(request.station),
  });
  return response.data;
};

/**
 * Complete visit
 */
export const completeVisit = async (request: CompleteVisitRequest): Promise<Visit> => {
  const api = getApi();
  const response = await api.post('/visits/complete', request);
  return response.data;
};

/**
 * Cancel visit
 */
export const cancelVisit = async (visitId: string, reason?: string): Promise<Visit> => {
  const api = getApi();
  const response = await api.post(`/visits/${visitId}/cancel`, { reason });
  return response.data;
};

/**
 * Mark patient as no-show
 */
export const markNoShow = async (visitId: string): Promise<Visit> => {
  const api = getApi();
  const response = await api.post(`/visits/${visitId}/no-show`);
  return response.data;
};

/**
 * Mark patient as walkout (Phase 1 Critical Gates)
 */
export const markWalkout = async (visitId: string, reason: string): Promise<Visit> => {
  const api = getApi();
  const response = await api.post(`/visits/${visitId}/walkout`, { reason });
  return response.data;
};

/**
 * Get queue for a branch
 */
export const getQueue = async (branchId: string, date?: string): Promise<QueueItem[]> => {
  const api = getApi();
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  const response = await api.get(`/visits/queue/${branchId}?${params.toString()}`);
  return response.data;
};

/**
 * Get queue by consultant
 */
export const getConsultantQueue = async (consultantId: string, date?: string): Promise<QueueItem[]> => {
  const api = getApi();
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  const response = await api.get(`/visits/queue/consultant/${consultantId}?${params.toString()}`);
  return response.data;
};

/**
 * Get queue by department
 */
export const getDepartmentQueue = async (departmentId: string, date?: string): Promise<QueueItem[]> => {
  const api = getApi();
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  const response = await api.get(`/visits/queue/department/${departmentId}?${params.toString()}`);
  return response.data;
};

/**
 * Get today's visits for a patient
 */
export const getPatientVisits = async (patientId: string, date?: string): Promise<Visit[]> => {
  const api = getApi();
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  const response = await api.get(`/visits/patient/${patientId}?${params.toString()}`);
  return response.data;
};

// ============================================================================
// Export as namespace
// ============================================================================

export const visitsApi = {
  getVisit,
  getVisitByAppointment,
  validateCheckIn,
  checkIn,
  sendTo,
  completeVisit,
  cancelVisit,
  markNoShow,
  markWalkout,
  getQueue,
  getConsultantQueue,
  getDepartmentQueue,
  getPatientVisits,
};

export default visitsApi;
