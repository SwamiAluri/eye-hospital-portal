export type PatientLookupTab = 'all' | 'current' | 'new' | 'discharged' | 'high_priority';

export interface PatientActiveEngagement {
  type: string;
  label: string;
  status?: string | null;
  priority?: string | null;
}

export interface PatientIpAdmission {
  isAdmitted: boolean;
  admittedAt?: string | null;
  wardName?: string | null;
  clinicalState?: string | null;
  procedureName?: string | null;
}

export interface PatientLookupRow {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  dateOfBirth: string;
  gender: string;
  phone?: string | null;
  email?: string | null;
  photoThumbnailUrl?: string | null;
  isFavorite: boolean;
  lastVisitAt?: string | null;
  careProgramCodes: string[];
  reasonForVisit?: string | null;
  scheduledAt?: string | null;
  clinicalAcuity: string;
  queuePriority?: string | null;
  activeEngagements: PatientActiveEngagement[];
  assignedProviderName?: string | null;
  assignedProviderRole?: string | null;
  primaryOpenVisitId?: string | null;
  waitingMinutes?: number | null;
  currentStation?: string | null;
  roomNumber?: string | null;
  ipAdmission?: PatientIpAdmission | null;
}

export interface PatientLookupPage {
  items: PatientLookupRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PatientLookupStats {
  all: number;
  current: number;
  new: number;
  discharged: number;
  highPriority: number;
}

export interface PatientSuggestRow {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  healthId?: string | null;
  dateOfBirth: string;
  gender: string;
  phone?: string | null;
  email?: string | null;
  photoThumbnailUrl?: string | null;
}

export interface PatientLookupFilters {
  /** Optional — server resolves effective authorized branch when omitted (single-branch users). */
  branchId?: string;
  q?: string;
  tab?: PatientLookupTab;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  favoritesOnly?: boolean;
  assignedToMe?: boolean;
  engagementTypes?: string[];
  programCodes?: string[];
  patientTypes?: string[];
  gender?: string;
  mrn?: string;
  phone?: string;
  dobFrom?: string;
  dobTo?: string;
  appointmentFrom?: string;
  appointmentTo?: string;
  name?: string;
  diagnosis?: string;
  providerId?: string;
  departmentId?: string;
  wardName?: string;
  admissionFrom?: string;
  admissionTo?: string;
}

export interface PatientSummary {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  dateOfBirth: string;
  gender: string;
  phone?: string | null;
  email?: string | null;
  photoThumbnailUrl?: string | null;
  bloodGroup?: string | null;
  allergies?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  insuranceProvider?: string | null;
  insurancePolicyNumber?: string | null;
  clinicalAcuity: string;
  activeEngagements: PatientActiveEngagement[];
  careProgramCodes: string[];
  reasonForVisit?: string | null;
  scheduledAt?: string | null;
  assignedVisitId?: string | null;
  assignedProviderName?: string | null;
  assignedProviderRole?: string | null;
  currentStation?: string | null;
  ipAdmission?: PatientIpAdmission | null;
  latestVitals?: {
    recordedAt?: string | null;
    bloodPressureSystolic?: number | null;
    bloodPressureDiastolic?: number | null;
    heartRate?: number | null;
    temperature?: number | null;
    oxygenSaturation?: number | null;
    weightKg?: number | null;
    heightCm?: number | null;
    visualAcuityOd?: string | null;
    visualAcuityOs?: string | null;
    iopOd?: number | null;
    iopOs?: number | null;
    isStale?: boolean;
  } | null;
  dataQuality: PatientDataQuality;
}

export interface PatientDataQuality {
  isIncomplete: boolean;
  issues: string[];
  hasStaleVitals?: boolean;
  vitalsStaleDays?: number | null;
}

export interface PatientRecentVisit {
  id: string;
  checkedInAt?: string | null;
  status: string;
  visitType?: string | null;
  currentStation?: string | null;
  tokenNumber?: string | null;
}

export interface UserBranchAssignment {
  id: string;
  userId: string;
  branchId: string;
  branchName: string;
  branchCode?: string | null;
  isDefault: boolean;
  assignedAt?: string;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  status: string;
  notes?: string | null;
}

export interface UserBranchesResponse {
  userId: string;
  count: number;
  branches: UserBranchAssignment[];
}

export interface PatientRecentViewEntry {
  patientId: string;
  firstName: string;
  lastName: string;
  mrn: string;
  photoThumbnailUrl?: string | null;
  viewedAt: string;
}
