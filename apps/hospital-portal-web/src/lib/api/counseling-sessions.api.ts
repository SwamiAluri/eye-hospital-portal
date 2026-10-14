// Counseling Sessions API - Module 3
import { getApi } from '../api';
import type { RecommendedProcedureItem } from './master-data.api';

// ============================================================================
// Stage Name Mapping (Frontend kebab-case → Backend PascalCase)
// ============================================================================

/**
 * Convert frontend SessionStage (kebab-case) to backend CurrentStage (PascalCase)
 */
export function mapStageToBackend(frontendStage: string): string {
  const stageMap: Record<string, string> = {
    'queue': 'Queue',
    'initial': 'Initial',
    'clinical-review': 'ClinicalReview',
    'package-selection': 'PackageSelection',
    'iol-selection': 'IolSelection',
    'financial': 'Financial',
    'consent': 'Consent',
    'pre-surgery': 'PreSurgery',
    'scheduling': 'Scheduling',
    'admission': 'Admission',
    'followup': 'Followup',
    'post-operative-care': 'PostOperativeCare',
    'follow-up-scheduling': 'FollowUpScheduling',
    'outcome-tracking': 'OutcomeTracking',
    'completed': 'Completed',
  };
  
  return stageMap[frontendStage] || frontendStage; // Fallback to original if not mapped
}

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface CounselingSession {
  id: string;
  tenantId: string;
  patientId: string;
  patientName?: string;
  patientMRN?: string;
  patientPhone?: string;
  branchId?: string;
  sessionNumber: string;
  sessionDate: string;
  sessionTime?: string;
  sessionType: 'Initial' | 'Followup' | 'PreSurgery' | 'PostSurgery' | 'Financial' | 'Insurance' | 'General';
  patientType: 'Cash' | 'Insurance' | 'CoPay' | 'ESH' | 'CGHS' | 'Arograshree' | 'SGHS' | 'Camp' | 'Railway' | 'Free';
  insuranceProvider?: string;
  tpaName?: string;
  policyNumber?: string;
  governmentSchemeType?: string;
  corporateName?: string;
  counseledbyUserId?: string;
  counseledByUserName?: string;
  sessionStatus: 'Scheduled' | 'InProgress' | 'Completed' | 'NoShow' | 'Cancelled';
  diagnosis?: string;
  visualAcuityLeft?: string;
  visualAcuityRight?: string;
  iopLeft?: number;
  iopRight?: number;
  recommendedSurgery?: string;
  recommendedSurgeryType?: string;
  recommendedIol?: string;
  /** Multi-procedure per-eye selections (deserialized from JSON) */
  recommendedProcedures?: RecommendedProcedureItem[];
  estimatedSurgeryCost?: number;
  additionalNotes?: string;
  agreedToSurgery?: boolean;
  patientAgreedToSurgery?: boolean;
  pendingDecision?: boolean;
  tentativeSurgeryDate?: string;
  sessionDurationMinutes?: number;
  consentFormsSigned?: boolean;
  financialClearanceObtained?: boolean;
  
  // Package Selection Data (added for Module 3.04)
  selectedPackageId?: string;
  packageAmount?: number;
  packageAddonsJson?: string; // JSON string of Dictionary<string, boolean>
  currentStage?: string; // Initial, ClinicalReview, PackageSelection, Financial, etc.
  
  // New fields from backend DTO (surgery scheduling, consent, notes)
  surgeryTentativeDate?: string;
  surgeryTentativeSurgeonId?: string;
  surgeryTentativeSurgeonName?: string;
  surgeryTentativeTimeSlot?: string;
  surgeryTentativeEye?: string;
  consentWitnessName?: string;
  consentWitnessRelation?: string;
  videoConsentRecorded?: boolean;
  consentFormsStatus?: string;
  
  /** Active counselling owner (CounselorId). Display / ownership mutation — not a list visibility filter. */
  counselorId?: string | null;
  counselorName?: string | null;
  status: string;
  createdAt: string;
  updatedAt?: string;
  /** Phase 3I Slice 7 (PD-S7-01) — optimistic concurrency token; send back as expected `version` on the next mutation. */
  version?: number;
}

export interface SessionFilters {
  page?: number;
  pageNumber?: number;
  pageSize?: number;
  branchId?: string;
  counselorId?: string;
  sessionStatus?: string;
  status?: string;
  sessionType?: string;
  patientType?: string;
  patientId?: string;
  sessionDateFrom?: string;
  sessionDateTo?: string;
  /** @deprecated use sessionDateFrom */
  startDate?: string;
  /** @deprecated use sessionDateTo */
  endDate?: string;
  pendingDecision?: boolean;
  patientAgreedToSurgery?: boolean;
  recommendedSurgery?: string;
  search?: string;
  /** @deprecated use search */
  searchTerm?: string;
  /**
   * Phase 3I Slice 12 — Reassignment Required operational filter (PD-S12-14).
   * Server-side: operationally open sessions owned by an unavailable counsellor.
   */
  reassignmentRequired?: boolean;
}

export interface SessionListResponse {
  sessions?: CounselingSession[]; // Backend sends lowercase (actual)
  data?: CounselingSession[];
  Sessions?: CounselingSession[]; // Backend sends PascalCase
  totalCount?: number;
  TotalCount?: number; // Backend sends PascalCase
  pageNumber?: number;
  page?: number; // Backend sends lowercase
  Page?: number; // Backend sends PascalCase
  pageSize?: number;
  PageSize?: number; // Backend sends PascalCase
  totalPages?: number;
  TotalPages?: number; // Backend sends PascalCase
}

export interface CreateCounselingSessionRequest {
  tenantId: string;
  branchId?: string;
  patientId: string;
  visitId?: string;
  referredByDoctorId: string;
  counselorId?: string;
  sessionType: string;
  sessionDate?: string;
  patientType: string;
  clinicalSummary?: string;
  recommendedSurgery?: string;
  recommendedIol?: string;
  iolPower?: string;
  urgency?: string;
  /** JSON-serialized RecommendedProcedureItem[] */
  recommendedProcedures?: string;
  addToQueue?: boolean;
}

export interface UpdateCounselingSessionRequest {
  /** Phase 3I Slice 7 (PD-S7-02) — required expected Version (optimistic concurrency). */
  version?: number;
  counselorId?: string;
  sessionStartTime?: string;
  sessionEndTime?: string;
  clinicalSummary?: string;
  recommendedSurgery?: string;
  recommendedIol?: string;
  iolPower?: string;
  urgency?: string;
  /** JSON-serialized RecommendedProcedureItem[] */
  recommendedProcedures?: string;
  packageDiscussed?: boolean;
  patientAgreedToSurgery?: boolean;
  pendingDecision?: boolean;
  decisionDate?: string;
  reasonsForDelay?: string;
  status?: string;
  
  // Patient Type & Package Data (added for Module 3.04 - Controlled Mutability)
  patientType?: string; // Cash, Insurance, CoPay, ESH, CGHS, Arograshree, SGHS, Camp (updateable until Financial stage)
  selectedPackageId?: string;
  packageAmount?: number;
  packageAddonsJson?: string; // JSON string of Dictionary<string, boolean>
  currentStage?: string; // Initial, ClinicalReview, PackageSelection, Financial, Consent, PreSurgery, Scheduling, Admission, Followup, Completed
  patientIntention?: string; // WillingNow, WillingWeek, WillingTwoWeeks, WillingMonth, WillingQuarter, WillingSixMonths, WillingCallToConfirm, Undecided, WaitingFinancial, WaitingFear, SecondOpinion, Declined, ReferredElsewhere
  additionalNotes?: string;
}

// ============================================================================
// API Functions
// ============================================================================

export const counselingSessionsApi = {
  /**
   * Get all counseling sessions with filters
   */
  getAll: async (filters?: SessionFilters): Promise<SessionListResponse> => {
    const params = new URLSearchParams();
    const page = filters?.page ?? filters?.pageNumber;
    if (page) params.append('page', page.toString());
    if (filters?.pageSize) params.append('pageSize', filters.pageSize.toString());
    if (filters?.branchId) params.append('branchId', filters.branchId);
    if (filters?.counselorId) params.append('counselorId', filters.counselorId);
    if (filters?.sessionStatus) params.append('status', filters.sessionStatus);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.sessionType) params.append('sessionType', filters.sessionType);
    if (filters?.patientType) params.append('patientType', filters.patientType);
    if (filters?.patientId) params.append('patientId', filters.patientId);
    const dateFrom = filters?.sessionDateFrom ?? filters?.startDate;
    const dateTo = filters?.sessionDateTo ?? filters?.endDate;
    if (dateFrom) params.append('sessionDateFrom', dateFrom);
    if (dateTo) params.append('sessionDateTo', dateTo);
    if (filters?.pendingDecision != null) {
      params.append('pendingDecision', String(filters.pendingDecision));
    }
    if (filters?.patientAgreedToSurgery != null) {
      params.append('patientAgreedToSurgery', String(filters.patientAgreedToSurgery));
    }
    if (filters?.recommendedSurgery) params.append('recommendedSurgery', filters.recommendedSurgery);
    const search = filters?.search ?? filters?.searchTerm;
    if (search) params.append('search', search);
    if (filters?.reassignmentRequired === true) {
      params.append('reassignmentRequired', 'true');
    }

    const query = params.toString();
    const url = `/counseling/sessions${query ? `?${query}` : ''}`;
    const response = await getApi().get<SessionListResponse>(url);
    return response.data;
  },

  /**
   * Get session by ID
   */
  getById: async (id: string): Promise<CounselingSession> => {
    const response = await getApi().get<CounselingSession>(`/counseling/sessions/${id}`);
    return response.data;
  },

  /**
   * Get session by session number
   */
  getByNumber: async (sessionNumber: string): Promise<CounselingSession> => {
    const response = await getApi().get<CounselingSession>(`/counseling/sessions/by-number/${sessionNumber}`);
    return response.data;
  },

  /**
   * Create new counseling session
   */
  create: async (data: CreateCounselingSessionRequest): Promise<CounselingSession> => {
    const response = await getApi().post<any>('/counseling/sessions', data);
    // Backend returns SessionOperationResult { success, sessionId, session, message }
    // not a bare CounselingSession — unwrap it.
    const result = response.data;
    if (result?.session) return result.session;
    if (result?.sessionId) return { id: result.sessionId, ...result } as CounselingSession;
    return result as CounselingSession;
  },

  /**
   * Update counseling session
   */
  update: async (id: string, data: UpdateCounselingSessionRequest): Promise<CounselingSession> => {
    // Map currentStage from frontend kebab-case to backend PascalCase
    const backendData = {
      ...data,
      currentStage: data.currentStage ? mapStageToBackend(data.currentStage) : undefined,
    };
    
    console.log('📤 Sending to backend:', {
      sessionId: id,
      originalData: data,
      mappedData: backendData,
    });
    
    const response = await getApi().put<CounselingSession>(`/counseling/sessions/${id}`, backendData);
    return response.data;
  },

  /**
   * Start a counseling session
   * Phase 3I Slice 7 (PD-S7-02) — `version` (expected) is required by the backend.
   */
  start: async (
    id: string,
    version?: number,
  ): Promise<{ success: boolean; message: string }> => {
    const response = await getApi().post(`/counseling/sessions/${id}/start`, { version });
    return response.data;
  },

  /**
   * Complete a counseling session
   * Phase 3I Slice 7 (PD-S7-02) — `version` (expected) is required by the backend.
   */
  complete: async (
    id: string,
    version?: number,
  ): Promise<{ success: boolean; message: string }> => {
    const response = await getApi().post(`/counseling/sessions/${id}/complete`, { version });
    return response.data;
  },

  /**
   * Cancel a counseling session
   * Phase 3I Slice 7 (PD-S7-02) — `version` (expected) is required by the backend.
   */
  cancel: async (
    id: string,
    reason: string,
    version?: number,
  ): Promise<{ success: boolean; message: string }> => {
    const response = await getApi().post(`/counseling/sessions/${id}/cancel`, { reason, version });
    return response.data;
  },

  /**
   * Persist the current workflow step so it survives page refresh.
   * stage is 1-based (1–6).
   * Phase 3I Slice 7 (PD-S7-02) — `version` (expected) is required by the backend.
   */
  advanceStage: async (
    id: string,
    stage: number,
    version?: number,
  ): Promise<{ success: boolean; currentStage: string; version?: number }> => {
    const response = await getApi().put(`/counseling/sessions/${id}/advance-stage`, {
      stage,
      version,
    });
    return response.data;
  },

  /**
   * Delete a counseling session
   * Phase 3I Slice 7 (PD-S7-02) — `version` (expected) is required by the backend (sent as DELETE body).
   */
  delete: async (id: string, version?: number): Promise<boolean> => {
    const response = await getApi().delete(`/counseling/sessions/${id}`, {
      data: { version },
    });
    return response.status === 200;
  },

  /**
   * Upload audio recording for a session
   */
  uploadAudio: async (sessionId: string, audioBlob: Blob, fileName: string): Promise<SessionDocument> => {
    const formData = new FormData();
    formData.append('audioFile', audioBlob, fileName);

    const response = await getApi().post<SessionDocument>(
      `/counseling/sessions/${sessionId}/upload-audio`,
      formData,
    );
    return response.data;
  },

  /**
   * Get session documents (including audio recordings)
   */
  getSessionDocuments: async (sessionId: string): Promise<SessionDocument[]> => {
    const response = await getApi().get<SessionDocument[]>(`/counseling/sessions/${sessionId}/documents`);
    return response.data;
  },

  /**
   * Get session notes
   */
  getSessionNotes: async (sessionId: string): Promise<SessionNote[]> => {
    const response = await getApi().get<SessionNote[]>(`/counseling/sessions/${sessionId}/notes`);
    return response.data;
  },

  /**
   * Create session note
   */
  createSessionNote: async (data: CreateSessionNoteRequest): Promise<SessionNote> => {
    const response = await getApi().post<SessionNote>('/counseling/notes', data);
    return response.data;
  },

  /**
   * Update session note
   */
  updateSessionNote: async (noteId: string, data: UpdateSessionNoteRequest): Promise<SessionNote> => {
    const response = await getApi().put<SessionNote>(`/counseling/notes/${noteId}`, data);
    return response.data;
  },

  /**
   * Delete session note
   */
  deleteSessionNote: async (noteId: string): Promise<boolean> => {
    const response = await getApi().delete(`/counseling/notes/${noteId}`);
    return response.status === 200;
  },

  /**
   * Get all sessions for a specific patient (for history view)
   */
  getPatientSessions: async (patientId: string): Promise<CounselingSession[]> => {
    const response = await getApi().get<any>(`/counseling/patients/${patientId}/sessions`);
    return response.data?.items ?? response.data?.sessions ?? response.data ?? [];
  },
};

// ============================================================================
// Session Document Interface
// ============================================================================

export interface SessionDocument {
  id: string;
  tenantId: string;
  sessionId: string;
  documentType: string;
  documentName: string;
  documentDescription?: string;
  filePath: string;
  fileType?: string;
  fileSizeBytes?: number;
  isVerified: boolean;
  verifiedByUserId?: string;
  verifiedAt?: string;
  verificationNotes?: string;
  status: string;
  createdAt: string;
  createdByUserId: string;
  /** Present when list/API includes uploader identity for remove UX. */
  createdByUserName?: string;
}

// ============================================================================
// Session Note Interfaces
// ============================================================================

export interface SessionNote {
  id: string;
  tenantId: string;
  sessionId: string;
  noteType?: string;
  noteText: string;
  isConfidential: boolean;
  tags?: string[];
  createdAt: string;
  createdByUserId: string;
  createdByUserName?: string;
  updatedAt?: string;
  updatedByUserId?: string;
}

export interface CreateSessionNoteRequest {
  tenantId?: string;
  sessionId: string;
  noteType?: string;
  noteText: string;
  isConfidential?: boolean;
  tags?: string[];
}

export interface UpdateSessionNoteRequest {
  noteType?: string;
  noteText?: string;
  isConfidential?: boolean;
  tags?: string[];
}

/** Patient 360 counselling document metadata. No file path. */
export interface CounselingDocumentPatientMetadata {
  id: string;
  sessionId: string | null;
  documentName: string;
  documentType?: string | null;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
  fileType?: string | null;
  fileSizeBytes?: number | null;
  canonicalDocumentId?: string | null;
  createdByUserId?: string | null;
}

export interface CounselingDocumentsByPatientResponse {
  documents: CounselingDocumentPatientMetadata[];
  totalCount: number;
  pageNumber?: number;
  pageSize?: number;
}

export async function getCounselingDocumentsByPatient(
  patientId: string,
  pageNumber = 1,
  pageSize = 20,
): Promise<CounselingDocumentsByPatientResponse> {
  const { data } = await getApi().get<CounselingDocumentsByPatientResponse>(
    `/counseling-session-documents/by-patient/${patientId}`,
    { params: { pageNumber, pageSize } },
  );
  return data;
}

/** A2 — Counselling-authorized content. Requires session_documents.read. */
export async function downloadCounselingCanonicalDocument(
  patientId: string,
  canonicalDocumentId: string,
): Promise<Blob> {
  const { data } = await getApi().get<Blob>(
    `/counseling-session-documents/by-patient/${patientId}/canonical/${canonicalDocumentId}/content`,
    { responseType: 'blob' },
  );
  return data;
}

/** Certified counselling_session_documents types for generic upload (excludes AudioRecording). */
export const COUNSELLING_GENERIC_DOCUMENT_TYPES = [
  { id: 'ReferralLetter', label: 'Referral Letter' },
  { id: 'PreviousReport', label: 'Previous Report' },
  { id: 'InsuranceCard', label: 'Insurance Card' },
  { id: 'PolicyDocument', label: 'Policy Document' },
  { id: 'IDProof', label: 'ID Proof' },
  { id: 'AddressProof', label: 'Address Proof' },
  { id: 'LabReport', label: 'Lab Report' },
  { id: 'Imaging', label: 'Imaging' },
  { id: 'Other', label: 'Other' },
] as const;

export async function getCounselingSessionContextByPatient(patientId: string): Promise<unknown> {
  const { data } = await getApi().get(
    `/counseling/patients/${patientId}/patient-360/sessions`,
  );
  return data;
}

export async function uploadCounselingSessionDocument(input: {
  sessionId: string;
  file: File;
  documentType: string;
  documentName?: string;
  patientId?: string;
}): Promise<SessionDocument> {
  const form = new FormData();
  form.append('file', input.file);
  form.append('sessionId', input.sessionId);
  form.append('documentType', input.documentType);
  form.append('documentName', input.documentName ?? input.file.name);
  if (input.patientId) form.append('patientId', input.patientId);
  const { data } = await getApi().post<{ document?: SessionDocument } & SessionDocument>(
    '/counseling/documents/upload',
    form,
  );
  return (data as { document?: SessionDocument }).document ?? (data as SessionDocument);
}

/** Patient 360 Counselling upload — patient-level, no session. */
export async function uploadCounselingPatientDocument(input: {
  patientId: string;
  file: File;
  documentType: string;
}): Promise<{ id: string; fileName: string; classification: string }> {
  const form = new FormData();
  form.append('file', input.file);
  form.append('documentType', input.documentType);
  const { data } = await getApi().post<{ id: string; fileName: string; classification: string }>(
    `/counseling-session-documents/by-patient/${input.patientId}`,
    form,
  );
  return data;
}

export async function deleteCounselingSessionDocument(documentId: string): Promise<void> {
  await getApi().delete(`/counseling/documents/${documentId}`);
}
