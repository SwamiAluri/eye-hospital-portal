import { getApi } from '../api';

// ==========================================
// Optometrist Queue & Workflow API
// ==========================================

export interface OptometryQueueItem {
  id: string;
  visitId?: string;
  patientId: string;
  patientName: string;
  mrn: string;
  age: number;
  gender: string;
  tokenNumber: string;
  appointmentTime: string;
  chiefComplaint: string;
  source: 'OPD' | 'Walk-in' | 'Post-Op' | 'Follow-up';
  status: 'Waiting' | 'In Progress' | 'Completed' | 'Referred' | 'Skipped';
  urgency: 'Emergency' | 'Urgent' | 'Routine';
  assignedOptometrist?: string;
  waitingSince?: string;
  completedExams: string[];
  hasRedFlags: boolean;
  redFlags?: string[];
  // Optometry summary (populated after exams)
  visualAcuityOD?: string;
  visualAcuityOS?: string;
  iopOD?: number;
  iopOS?: number;
  refractionCompleted?: boolean;
  passNumber?: number;
  reasonCode?: string;
  reasonLabel?: string;
  isReturnVisit?: boolean;
  roomCode?: string;
}

export interface ServiceRoom {
  code: string;
  label: string;
  roomCode: string;
  branchId?: string;
  station?: string;
}

export interface OptometryCallNextRequest {
  branchId: string;
  roomCode: string;
  optometristName?: string;
}

export interface OptometryOpenExamRequest {
  branchId: string;
  patientId: string;
  roomCode?: string;
  optometristName?: string;
  chiefComplaint?: string;
}

export interface OptometryPatientSearchRow {
  id: string;
  patientName: string;
  mrn: string;
  phone?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
}

export interface OptometryQueueStats {
  totalWaiting: number;
  inProgress: number;
  completed: number;
  referred: number;
  emergencyCount: number;
  urgentCount: number;
  averageWaitTime: number; // minutes
}

export interface PatientEducationRecord {
  id?: string;
  patientId: string;
  visitId?: string;
  spectacleRecommendation?: {
    wearType: 'Full-time' | 'Distance only' | 'Reading only' | 'As needed';
    lensType: 'Single Vision' | 'Bifocal' | 'Progressive' | 'Computer/Intermediate';
    coatings: string[];
    specialInstructions?: string;
  };
  contactLensGuidance?: {
    wearSchedule: string;
    cleaningInstructions: string;
    followUpSchedule: string;
    warningSignsExplained: boolean;
  };
  opticalShopReferral?: {
    referred: boolean;
    referredAt?: string;
    prescriptionAttached: boolean;
    notes?: string;
  };
  generalEducation?: {
    eyeHygiene: boolean;
    screenTimeGuidance: boolean;
    uvProtection: boolean;
    dietaryAdvice: boolean;
    exerciseGuidance: boolean;
    notes?: string;
  };
  educatedBy: string;
  educatedAt: string;
  patientAcknowledged: boolean;
  notes?: string;
}

export interface DoctorReferral {
  id?: string;
  patientId: string;
  visitId?: string;
  referredByOptometristId: string;
  referredByOptometristName?: string;
  referredToDoctorId?: string;
  referredToDoctorName?: string;
  urgency: 'Emergency' | 'Urgent' | 'Routine';
  reason: string;
  alerts: string[];
  optometrySummary: {
    visualAcuity?: { od: string; os: string };
    refraction?: { 
      od: { sphere: number; cylinder?: number; axis?: number };
      os: { sphere: number; cylinder?: number; axis?: number };
    };
    iop?: { od: number; os: number; method: string };
    keratometry?: { od: string; os: string };
    pachymetry?: { od: number; os: number };
    additionalFindings?: string;
  };
  status: 'Pending' | 'Accepted' | 'In Progress' | 'Completed' | 'Cancelled';
  referredAt: string;
  acceptedAt?: string;
  completedAt?: string;
  doctorNotes?: string;
}

export interface OptometryCompleteSummary {
  patientId: string;
  visitDate: string;
  visualAcuity?: {
    distanceOD: string;
    distanceOS: string;
    nearOD?: string;
    nearOS?: string;
    pinholeOD?: string;
    pinholeOS?: string;
  };
  refraction?: {
    finalRxOD: { sphere: number; cylinder?: number; axis?: number };
    finalRxOS: { sphere: number; cylinder?: number; axis?: number };
    nearAddOD?: number;
    nearAddOS?: number;
  };
  tonometry?: {
    iopOD: number;
    iopOS: number;
    method: string;
    time: string;
  };
  keratometry?: {
    k1OD: number; k2OD: number; axisOD: number;
    k1OS: number; k2OS: number; axisOS: number;
  };
  pachymetry?: {
    cctOD: number;
    cctOS: number;
  };
  colorVision?: { result: string };
  contrastSensitivity?: { result: string };
  visualField?: { result: string; flaggedForPerimetry: boolean };
  alerts: string[];
  completedExams: string[];
  overallStatus: 'Complete' | 'Partial' | 'Pending';
}

// ==========================================
// Queue Management API (live visit-based queue)
// ==========================================
function mapQueueItem(raw: Record<string, unknown>): OptometryQueueItem {
  return {
    id: String(raw.id ?? raw.visitId ?? ''),
    visitId: raw.visitId ? String(raw.visitId) : String(raw.id ?? ''),
    patientId: String(raw.patientId ?? ''),
    patientName: String(raw.patientName ?? 'Unknown'),
    mrn: String(raw.mrn ?? raw.Mrn ?? ''),
    age: Number(raw.age ?? raw.Age ?? 0),
    gender: String(raw.gender ?? raw.Gender ?? ''),
    tokenNumber: String(raw.tokenNumber ?? raw.TokenNumber ?? ''),
    appointmentTime: String(raw.appointmentTime ?? raw.AppointmentTime ?? ''),
    chiefComplaint: String(raw.chiefComplaint ?? raw.ChiefComplaint ?? ''),
    source: (raw.source ?? raw.Source ?? 'OPD') as OptometryQueueItem['source'],
    status: (raw.status ?? raw.Status ?? 'Waiting') as OptometryQueueItem['status'],
    urgency: (raw.urgency ?? raw.Urgency ?? 'Routine') as OptometryQueueItem['urgency'],
    assignedOptometrist: raw.assignedOptometrist as string | undefined,
    waitingSince: raw.waitingSince as string | undefined,
    completedExams: (raw.completedExams as string[]) ?? [],
    hasRedFlags: Boolean(raw.hasRedFlags),
    redFlags: (raw.redFlags as string[]) ?? [],
    visualAcuityOD: raw.visualAcuityOD as string | undefined,
    visualAcuityOS: raw.visualAcuityOS as string | undefined,
    iopOD: raw.iopOD as number | undefined,
    iopOS: raw.iopOS as number | undefined,
    refractionCompleted: Boolean(raw.refractionCompleted),
    passNumber: raw.passNumber as number | undefined,
    reasonCode: raw.reasonCode as string | undefined,
    reasonLabel: raw.reasonLabel as string | undefined,
    isReturnVisit: Boolean(raw.isReturnVisit),
    roomCode: raw.roomCode as string | undefined,
  };
}

function mapStats(raw: Record<string, unknown>): OptometryQueueStats {
  return {
    totalWaiting: Number(raw.totalWaiting ?? raw.TotalWaiting ?? 0),
    inProgress: Number(raw.inProgress ?? raw.InProgress ?? 0),
    completed: Number(raw.completed ?? raw.Completed ?? 0),
    referred: Number(raw.referred ?? raw.Referred ?? 0),
    emergencyCount: Number(raw.emergencyCount ?? raw.EmergencyCount ?? 0),
    urgentCount: Number(raw.urgentCount ?? raw.UrgentCount ?? 0),
    averageWaitTime: Number(raw.averageWaitTime ?? raw.AverageWaitTime ?? 0),
  };
}

export const optometryQueueApi = {
  getQueue: async (branchId: string, includeCompletedToday = true): Promise<OptometryQueueItem[]> => {
    const response = await getApi().get('/visits/queue/optometrist', {
      params: { branchId, includeCompletedToday },
    });
    const rows = Array.isArray(response.data) ? response.data : [];
    return rows.map((row: Record<string, unknown>) => mapQueueItem(row));
  },

  getStats: async (branchId: string): Promise<OptometryQueueStats> => {
    const response = await getApi().get('/visits/queue/optometrist/stats', {
      params: { branchId },
    });
    return mapStats(response.data ?? {});
  },

  callNext: async (request: OptometryCallNextRequest): Promise<OptometryQueueItem> => {
    const response = await getApi().post('/visits/queue/optometrist/call-next', request);
    return mapQueueItem(response.data);
  },

  openExam: async (request: OptometryOpenExamRequest): Promise<OptometryQueueItem> => {
    const response = await getApi().post('/visits/queue/optometrist/open-exam', request);
    return mapQueueItem(response.data);
  },

  searchPatients: async (branchId: string, q: string, limit = 20): Promise<OptometryPatientSearchRow[]> => {
    const response = await getApi().get<OptometryPatientSearchRow[]>(
      '/visits/queue/optometrist/patients/search',
      { params: { branchId, q, limit } },
    );
    const rows = response.data ?? [];
    return rows.map((row) => ({
      id: String((row as { id?: string; Id?: string }).id ?? (row as { Id?: string }).Id ?? ''),
      patientName: row.patientName ?? (row as { PatientName?: string }).PatientName ?? '',
      mrn: row.mrn ?? (row as { Mrn?: string }).Mrn ?? '',
      phone: row.phone ?? (row as { Phone?: string | null }).Phone ?? null,
      gender: row.gender ?? (row as { Gender?: string | null }).Gender ?? null,
      dateOfBirth: row.dateOfBirth ?? (row as { DateOfBirth?: string | null }).DateOfBirth ?? null,
    }));
  },

  startExam: async (visitId: string, roomCode?: string): Promise<OptometryQueueItem> => {
    const response = await getApi().post(
      `/visits/queue/optometrist/${visitId}/start`,
      null,
      { params: roomCode ? { roomCode } : undefined },
    );
    return mapQueueItem(response.data);
  },

  skipPatient: async (visitId: string, reason: string) => {
    const response = await getApi().post(`/visits/queue/optometrist/${visitId}/skip`, { reason });
    return mapQueueItem(response.data);
  },

  referPatient: async (visitId: string, reason: string) => {
    const response = await getApi().post(`/visits/queue/optometrist/${visitId}/refer`, { reason });
    return mapQueueItem(response.data);
  },

  completeLeg: async (visitId: string, nextStation?: string) => {
    const response = await getApi().post(`/visits/queue/optometrist/${visitId}/complete`, {
      nextStation,
    });
    return mapQueueItem(response.data);
  },

  getServiceRooms: async (branchId: string): Promise<ServiceRoom[]> => {
    try {
      const response = await getApi().get('/master-values/lookup/operations.service_room');
      const items = response.data?.items ?? response.data?.Items ?? [];
      return (items as Array<{ code: string; label: string; metadata?: string | Record<string, unknown> }>)
        .map((item) => {
          let meta: Record<string, unknown> = {};
          try {
            meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : (item.metadata ?? {});
          } catch {
            meta = {};
          }
          return {
            code: item.code,
            label: item.label,
            roomCode: String(meta.roomCode ?? item.code),
            branchId: meta.branchId ? String(meta.branchId) : undefined,
            station: meta.station ? String(meta.station) : undefined,
          };
        })
        .filter((r) => r.station === 'optometrist' && (!r.branchId || r.branchId === branchId));
    } catch {
      return [];
    }
  },
};

// ==========================================
// Patient Education API
// ==========================================
export const patientEducationApi = {
  get: async (patientId: string) => {
    const response = await getApi().get(`/clinical/patient-education/${patientId}`);
    return response.data;
  },

  save: async (data: PatientEducationRecord) => {
    const response = await getApi().post('/clinical/patient-education', data);
    return response.data;
  },

  update: async (id: string, data: Partial<PatientEducationRecord>) => {
    const response = await getApi().put(`/clinical/patient-education/${id}`, data);
    return response.data;
  },

  sendToOpticalShop: async (patientId: string, prescriptionData: any) => {
    const response = await getApi().post(`/clinical/patient-education/${patientId}/optical-referral`, prescriptionData);
    return response.data;
  },
};

// ==========================================
// Referral to Doctor API
// ==========================================
export const doctorReferralApi = {
  create: async (data: DoctorReferral) => {
    const response = await getApi().post('/clinical/referral/doctor', data);
    return response.data;
  },

  get: async (referralId: string) => {
    const response = await getApi().get(`/clinical/referral/doctor/${referralId}`);
    return response.data;
  },

  getByPatient: async (patientId: string) => {
    const response = await getApi().get(`/clinical/referral/doctor/patient/${patientId}`);
    return response.data;
  },

  getPendingForDoctor: async (doctorId?: string) => {
    const response = await getApi().get('/clinical/referral/doctor/pending', { params: { doctorId } });
    return response.data;
  },

  updateStatus: async (referralId: string, status: string, notes?: string) => {
    const response = await getApi().put(`/clinical/referral/doctor/${referralId}/status`, { status, notes });
    return response.data;
  },
};

// ==========================================
// Optometry Complete Summary API  
// ==========================================
export const optometrySummaryApi = {
  getCompleteSummary: async (patientId: string): Promise<OptometryCompleteSummary> => {
    const response = await getApi().get(`/clinical/optometry/summary/${patientId}`);
    return response.data;
  },

  getExamStatus: async (patientId: string) => {
    const response = await getApi().get(`/clinical/optometry/status/${patientId}`);
    return response.data;
  },
};
