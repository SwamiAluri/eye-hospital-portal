// Module 3.6 - Insurance Pre-Authorization Workflow API
import { getApi } from '../api';

export interface InsurancePreAuthorization {
  id: string;
  tenantId: string;
  patientId: string;
  insuranceProvider: string;
  policyNumber: string;
  estimatedAmount: number;
  approvedAmount?: number;
  surgeryType: string;
  surgeryDate: string;
  diagnosis: string;
  currentStage: string;
  currentStatus: string;
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePreAuthorizationRequest {
  patientId: string;
  insuranceProvider: string;
  policyNumber: string;
  estimatedAmount: number;
  surgeryType: string;
  surgeryDate: string;
  diagnosis: string;
  requestedBy: string;
  notes?: string;
}

export interface SubmitToTPARequest {
  tpaName: string;
  tpaContactPerson: string;
  tpaEmail: string;
  tpaPhone: string;
  urgencyLevel: 'Low' | 'Normal' | 'High' | 'Critical';
}

export interface ApprovalWorkflow {
  id: string;
  preauthorizationId: string;
  currentStage: string;
  currentStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface InsuranceDocument {
  id: string;
  preauthorizationId: string;
  documentType: string;
  fileName: string;
  filePath: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface TPACommunicationLog {
  id: string;
  preauthorizationId: string;
  communicationType: string;
  sentBy: string;
  sentAt: string;
  receivedBy?: string;
  receivedAt?: string;
  messageContent: string;
  responseContent?: string;
}

class InsuranceApi {
  private static readonly LegacyWriteFrozen = Object.assign(
    new Error(
      'Legacy insurance writes are frozen (Phase 2). Use CCMS at /dashboard/ccms/cases.',
    ),
    { code: 'CCMS_LEGACY_WRITE_FROZEN', ccmsRedirect: '/dashboard/ccms/cases' },
  );

  // Pre-Authorization endpoints
  async getAllPreAuthorizations(filters?: {
    status?: string;
    patientId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<InsurancePreAuthorization[]> {
    const api = getApi();
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.patientId) params.append('patientId', filters.patientId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await api.get(`/insurance/pre-authorizations${query}`);
    return response.data;
  }

  async getPreAuthorizationById(id: string): Promise<InsurancePreAuthorization> {
    const api = getApi();
    const response = await api.get(`/insurance/pre-authorizations/${id}`);
    return response.data;
  }

  /** @deprecated Phase 2 — competing insurance writes frozen; use CCMS. */
  async createPreAuthorization(_data: CreatePreAuthorizationRequest): Promise<InsurancePreAuthorization> {
    throw InsuranceApi.LegacyWriteFrozen;
  }

  /** @deprecated Phase 2 — competing insurance writes frozen; use CCMS. */
  async updatePreAuthorization(_id: string, _data: Partial<CreatePreAuthorizationRequest>): Promise<InsurancePreAuthorization> {
    throw InsuranceApi.LegacyWriteFrozen;
  }

  /** @deprecated Phase 2 — competing insurance writes frozen; use CCMS. */
  async deletePreAuthorization(_id: string): Promise<void> {
    throw InsuranceApi.LegacyWriteFrozen;
  }

  /** @deprecated Phase 2 — competing insurance writes frozen; use CCMS. */
  async submitToTPA(_id: string, _data: SubmitToTPARequest): Promise<InsurancePreAuthorization> {
    throw InsuranceApi.LegacyWriteFrozen;
  }

  /** @deprecated Phase 2 — competing insurance writes frozen; use CCMS. */
  async approvePreAuthorization(_id: string, _approvedAmount: number, _notes?: string): Promise<InsurancePreAuthorization> {
    throw InsuranceApi.LegacyWriteFrozen;
  }

  /** @deprecated Phase 2 — competing insurance writes frozen; use CCMS. */
  async rejectPreAuthorization(_id: string, _rejectionReason: string): Promise<InsurancePreAuthorization> {
    throw InsuranceApi.LegacyWriteFrozen;
  }

  // Approval Workflow endpoints
  async getWorkflowByPreAuthId(preAuthId: string): Promise<ApprovalWorkflow> {
    const api = getApi();
    const response = await api.get(`/insurance/pre-authorizations/${preAuthId}/workflow`);
    return response.data;
  }

  /** @deprecated Phase 2 — competing insurance writes frozen; use CCMS. */
  async updateWorkflowStage(_workflowId: string, _newStage: string, _notes?: string): Promise<ApprovalWorkflow> {
    throw InsuranceApi.LegacyWriteFrozen;
  }

  // Insurance Documents endpoints
  async getDocumentsByPreAuthId(preAuthId: string): Promise<InsuranceDocument[]> {
    const api = getApi();
    const response = await api.get(`/insurance/pre-authorizations/${preAuthId}/documents`);
    return response.data;
  }

  /** @deprecated Phase 2 — competing insurance writes frozen; use CCMS. */
  async uploadDocument(_preAuthId: string, _file: File, _documentType: string): Promise<InsuranceDocument> {
    throw InsuranceApi.LegacyWriteFrozen;
  }

  /** @deprecated Phase 2 — competing insurance writes frozen; use CCMS. */
  async deleteDocument(_documentId: string): Promise<void> {
    throw InsuranceApi.LegacyWriteFrozen;
  }

  // TPA Communication endpoints
  async getCommunicationLogs(preAuthId: string): Promise<TPACommunicationLog[]> {
    const api = getApi();
    const response = await api.get(`/insurance/pre-authorizations/${preAuthId}/communications`);
    return response.data;
  }

  /** @deprecated Phase 2 — competing insurance writes frozen; use CCMS. */
  async logCommunication(_preAuthId: string, _data: {
    communicationType: string;
    messageContent: string;
    responseContent?: string;
  }): Promise<TPACommunicationLog> {
    throw InsuranceApi.LegacyWriteFrozen;
  }

  // Statistics and Reports
  async getStatistics(startDate?: string, endDate?: string): Promise<{
    totalPreAuthorizations: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    totalEstimatedAmount: number;
    totalApprovedAmount: number;
    averageProcessingTime: number;
  }> {
    const api = getApi();
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await api.get(`/insurance/statistics${query}`);
    return response.data;
  }
}

export const insuranceApi = new InsuranceApi();
