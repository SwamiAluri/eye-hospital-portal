// Enhanced Patient Management API with Medical Records, Treatment History, and Patient Portal Integration
// Comprehensive patient management system with HIPAA compliance and multi-tenant support

import axios, { AxiosResponse } from 'axios';
import { getApi } from '../api';

// ===== CORE PATIENT INTERFACES =====

export interface Patient {
  id: string;
  tenantId: string;
  
  // Personal Information
  personalInfo: {
    firstName: string;
    lastName: string;
    middleName?: string;
    dateOfBirth: string;
    gender: 'Male' | 'Female' | 'Other' | 'Prefer not to say';
    ssn?: string; // Encrypted/masked
    maritalStatus: 'Single' | 'Married' | 'Divorced' | 'Widowed' | 'Other';
    preferredLanguage: string;
    ethnicity?: string;
    race?: string;
    religion?: string;
  };

  // Contact Information
  contactInfo: {
    primaryPhone: string;
    secondaryPhone?: string;
    email: string;
    preferredContactMethod: 'Phone' | 'Email' | 'SMS' | 'Portal';
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
      county?: string;
    };
  };

  // Medical Information
  medicalInfo: {
    mrn: string; // Medical Record Number
    bloodType?: string;
    allergies: Allergy[];
    chronicConditions: ChronicCondition[];
    currentMedications: Medication[];
    medicalAlerts: MedicalAlert[];
    disabilities?: string[];
    medicalHistory: MedicalHistoryItem[];
  };

  // Insurance Information
  insurance: {
    primary: InsuranceInfo;
    secondary?: InsuranceInfo;
    verificationStatus: 'Verified' | 'Pending' | 'Expired' | 'Invalid';
    lastVerified?: string;
    copayAmount?: number;
    deductible?: number;
    deductibleMet?: number;
  };

  // Emergency Contacts
  emergencyContacts: EmergencyContact[];

  // Family Information
  family: {
    primaryCaregiver?: FamilyMember;
    familyMembers: FamilyMember[];
    pediatricInfo?: PediatricInfo; // For patients under 18
  };

  // Provider Information
  providers: {
    primaryCareProvider?: Provider;
    specialists: Provider[];
    referringProviders: Provider[];
  };

  // Portal Access
  portalAccess: {
    isEnabled: boolean;
    username?: string;
    lastLogin?: string;
    registrationDate?: string;
    preferences: PatientPortalPreferences;
    securitySettings: PortalSecuritySettings;
  };

  // System Information
  systemInfo: {
    patientNumber: string; // Human-readable patient ID
    status: 'Active' | 'Inactive' | 'Deceased' | 'Transferred' | 'Blocked';
    registrationDate: string;
    registeredBy: string;
    lastVisit?: string;
    totalVisits: number;
    riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
    flags: PatientFlag[];
  };

  // Compliance & Privacy
  compliance: {
    hipaaConsent: boolean;
    consentDate?: string;
    consentExpiry?: string;
    marketingConsent: boolean;
    dataProcessingConsent: boolean;
    privacyNoticeProvided: boolean;
    advanceDirectives?: AdvanceDirective[];
  };

  // Audit Information
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  updatedByUserId: string;
  deletedAt?: string;
}

// ===== SUPPORTING INTERFACES =====

export interface Allergy {
  id: string;
  allergen: string;
  allergenType: 'Drug' | 'Food' | 'Environmental' | 'Other';
  reaction: string;
  severity: 'Mild' | 'Moderate' | 'Severe' | 'Life-threatening';
  onsetDate?: string;
  notes?: string;
  verifiedBy?: string;
  verifiedDate?: string;
}

export interface ChronicCondition {
  id: string;
  condition: string;
  icdCode?: string;
  diagnosisDate: string;
  status: 'Active' | 'Resolved' | 'In Remission' | 'Chronic';
  severity: 'Mild' | 'Moderate' | 'Severe';
  notes?: string;
  treatingPhysician?: string;
}

export interface Medication {
  id: string;
  name: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  route: 'Oral' | 'IV' | 'IM' | 'Topical' | 'Inhaled' | 'Other';
  startDate: string;
  endDate?: string;
  prescribedBy: string;
  pharmacy?: string;
  instructions: string;
  sideEffects?: string[];
  isActive: boolean;
}

export interface MedicalAlert {
  id: string;
  alertType: 'Critical' | 'Warning' | 'Information';
  title: string;
  description: string;
  category: 'Allergy' | 'Drug Interaction' | 'Medical Condition' | 'Fall Risk' | 'Other';
  isActive: boolean;
  createdDate: string;
  expiryDate?: string;
  createdBy: string;
}

export interface MedicalHistoryItem {
  id: string;
  type: 'Surgery' | 'Hospitalization' | 'Procedure' | 'Diagnosis' | 'Injury' | 'Other';
  description: string;
  date: string;
  facility?: string;
  provider?: string;
  outcome?: string;
  complications?: string;
  notes?: string;
}

export interface InsuranceInfo {
  id?: string;
  insuranceCompany: string;
  planName: string;
  policyNumber: string;
  groupNumber?: string;
  subscriberId: string;
  subscriberName: string;
  subscriberRelationship: 'Self' | 'Spouse' | 'Child' | 'Parent' | 'Other';
  effectiveDate: string;
  expiryDate?: string;
  copay?: number;
  deductible?: number;
  contact: {
    phone: string;
    address?: string;
    website?: string;
  };
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  address?: string;
  isPrimary: boolean;
  canMakeDecisions: boolean;
  notes?: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  dateOfBirth?: string;
  phone?: string;
  email?: string;
  isEmergencyContact: boolean;
  medicalHistory?: string[];
  notes?: string;
}

export interface PediatricInfo {
  parentGuardian: string;
  parentGuardianPhone: string;
  school?: string;
  schoolPhone?: string;
  pediatrician?: string;
  birthWeight?: number;
  birthComplications?: string;
  developmentalMilestones?: string[];
  immunizationRecord?: ImmunizationRecord[];
}

export interface ImmunizationRecord {
  id: string;
  vaccine: string;
  date: string;
  lotNumber?: string;
  provider: string;
  notes?: string;
}

export interface Provider {
  id: string;
  name: string;
  specialty: string;
  phone: string;
  email?: string;
  address?: string;
  npi?: string; // National Provider Identifier
  relationship: 'Primary' | 'Specialist' | 'Consulting' | 'Referring';
}

export interface PatientPortalPreferences {
  notificationPreferences: {
    appointmentReminders: boolean;
    testResults: boolean;
    billing: boolean;
    generalHealth: boolean;
    method: 'Email' | 'SMS' | 'Portal' | 'Phone';
  };
  languagePreference: string;
  accessibilityNeeds?: string[];
  communicationFormat: 'Standard' | 'Large Print' | 'Audio' | 'Video';
}

export interface PortalSecuritySettings {
  twoFactorEnabled: boolean;
  securityQuestions?: SecurityQuestion[];
  lastPasswordChange?: string;
  failedLoginAttempts: number;
  accountLocked: boolean;
  lockoutExpiry?: string;
}

export interface SecurityQuestion {
  question: string;
  answerHash: string; // Hashed answer
}

export interface PatientFlag {
  id: string;
  type: 'Medical' | 'Billing' | 'Behavioral' | 'Administrative' | 'Legal';
  title: string;
  description: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  isActive: boolean;
  createdDate: string;
  expiryDate?: string;
  createdBy: string;
}

export interface AdvanceDirective {
  id: string;
  type: 'Living Will' | 'Power of Attorney' | 'DNR' | 'POLST' | 'Other';
  documentUrl?: string;
  summary: string;
  effectiveDate: string;
  expiryDate?: string;
  witnessName?: string;
  attorneyName?: string;
  isActive: boolean;
}

// ===== APPOINTMENT INTEGRATION =====

export interface PatientAppointment {
  id: string;
  patientId: string;
  providerId: string;
  providerName: string;
  appointmentType: string;
  status: 'Scheduled' | 'Confirmed' | 'Checked In' | 'In Progress' | 'Completed' | 'Cancelled' | 'No Show';
  scheduledDateTime: string;
  duration: number;
  location: string;
  department: string;
  chiefComplaint?: string;
  notes?: string;
  visitSummary?: VisitSummary;
}

export interface VisitSummary {
  id: string;
  visitDate: string;
  provider: string;
  department: string;
  visitType: string;
  diagnosis: DiagnosisCode[];
  procedures: ProcedureCode[];
  medications: MedicationPrescription[];
  followUpInstructions: string;
  nextAppointment?: string;
  clinicalNotes: string;
  vitalSigns?: VitalSigns;
}

export interface DiagnosisCode {
  icdCode: string;
  description: string;
  isPrimary: boolean;
}

export interface ProcedureCode {
  cptCode: string;
  description: string;
  quantity: number;
  modifiers?: string[];
}

export interface MedicationPrescription {
  medicationId: string;
  name: string;
  dosage: string;
  frequency: string;
  quantity: number;
  refills: number;
  instructions: string;
  pharmacyId?: string;
}

export interface VitalSigns {
  bloodPressure?: {
    systolic: number;
    diastolic: number;
  };
  heartRate?: number;
  temperature?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  painLevel?: number; // 1-10 scale
}

// ===== MEDICAL RECORDS =====

export interface MedicalRecord {
  id: string;
  patientId: string;
  recordType: 'Lab Results' | 'Imaging' | 'Progress Notes' | 'Discharge Summary' | 'Consultation' | 'Other';
  title: string;
  description: string;
  recordDate: string;
  provider: string;
  department: string;
  documentUrl?: string;
  isConfidential: boolean;
  sharedWithPatient: boolean;
  category: string;
  tags: string[];
  relatedAppointmentId?: string;
}

export interface LabResult {
  id: string;
  patientId: string;
  testName: string;
  testCode: string;
  value: string;
  unit?: string;
  referenceRange: string;
  status: 'Normal' | 'Abnormal' | 'Critical' | 'Pending';
  collectionDate: string;
  resultDate: string;
  orderingProvider: string;
  labFacility: string;
  notes?: string;
}

export interface ImagingStudy {
  id: string;
  patientId: string;
  studyType: string;
  bodyPart: string;
  studyDate: string;
  radiologist: string;
  findings: string;
  impression: string;
  images: ImageFile[];
  isUrgent: boolean;
  orderingProvider: string;
}

export interface ImageFile {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  thumbnailUrl?: string;
  uploadDate: string;
}

// ===== BILLING INTEGRATION =====

export interface PatientBilling {
  id: string;
  patientId: string;
  accountNumber: string;
  balance: number;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  paymentStatus: 'Current' | 'Past Due' | 'Collections' | 'Payment Plan' | 'Paid in Full';
  statements: BillingStatement[];
  paymentMethods: PaymentMethod[];
  paymentPlans: PaymentPlan[];
}

export interface BillingStatement {
  id: string;
  statementDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  charges: BillingCharge[];
  payments: BillingPayment[];
  adjustments: BillingAdjustment[];
}

export interface BillingCharge {
  id: string;
  serviceDate: string;
  description: string;
  cptCode: string;
  amount: number;
  insurancePayment?: number;
  patientResponsibility: number;
  status: 'Billed' | 'Paid' | 'Adjusted' | 'Written Off';
}

export interface BillingPayment {
  id: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  checkNumber?: string;
  notes?: string;
}

export interface BillingAdjustment {
  id: string;
  adjustmentDate: string;
  amount: number;
  reason: string;
  adjustmentCode: string;
}

export interface PaymentMethod {
  id: string;
  type: 'Credit Card' | 'Bank Account' | 'Check' | 'Cash';
  maskedAccount: string;
  isDefault: boolean;
  expiryDate?: string;
  billingAddress?: string;
}

export interface PaymentPlan {
  id: string;
  planAmount: number;
  monthlyPayment: number;
  startDate: string;
  endDate: string;
  remainingBalance: number;
  status: 'Active' | 'Completed' | 'Defaulted' | 'Cancelled';
}

// ===== PATIENT PORTAL INTERFACES =====

export interface PatientPortalUser {
  id: string;
  patientId: string;
  username: string;
  email: string;
  isActive: boolean;
  registrationDate: string;
  lastLoginDate?: string;
  portalFeatures: PortalFeature[];
  preferences: PatientPortalPreferences;
  securitySettings: PortalSecuritySettings;
}

export interface PortalFeature {
  featureName: string;
  isEnabled: boolean;
  lastUsed?: string;
}

export interface PatientMessage {
  id: string;
  patientId: string;
  providerId?: string;
  subject: string;
  message: string;
  messageType: 'General' | 'Appointment' | 'Medical' | 'Billing' | 'Prescription';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Unread' | 'Read' | 'Replied' | 'Closed';
  sentDate: string;
  readDate?: string;
  replyDate?: string;
  attachments: MessageAttachment[];
  threadId: string;
}

export interface MessageAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  uploadDate: string;
}

export interface PatientEducation {
  id: string;
  title: string;
  description: string;
  category: string;
  contentType: 'Article' | 'Video' | 'PDF' | 'Interactive';
  contentUrl: string;
  thumbnailUrl?: string;
  duration?: number; // for videos
  targetAudiences: string[];
  tags: string[];
  lastUpdated: string;
  isActive: boolean;
}

// ===== SEARCH AND FILTER INTERFACES =====

export interface PatientSearchFilters {
  query?: string;
  status?: string;
  ageRange?: {
    min: number;
    max: number;
  };
  gender?: string;
  provider?: string;
  insurance?: string;
  riskLevel?: string;
  hasUpcomingAppointments?: boolean;
  lastVisitRange?: {
    start: string;
    end: string;
  };
  medicalConditions?: string[];
  allergies?: string[];
  flags?: string[];
  zipCode?: string;
  registrationDateRange?: {
    start: string;
    end: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ===== ANALYTICS INTERFACES =====

export interface PatientAnalytics {
  summary: {
    totalPatients: number;
    activePatients: number;
    newPatientsThisMonth: number;
    averageAge: number;
    genderDistribution: GenderDistribution;
    riskLevelDistribution: RiskLevelDistribution;
  };
  demographics: {
    ageGroups: AgeGroupDistribution[];
    ethnicityDistribution: EthnicityDistribution[];
    languageDistribution: LanguageDistribution[];
    geographicDistribution: GeographicDistribution[];
  };
  medical: {
    commonConditions: ConditionStatistic[];
    commonAllergies: AllergyStatistic[];
    medicationUsage: MedicationStatistic[];
    riskFactors: RiskFactorStatistic[];
  };
  utilization: {
    appointmentFrequency: AppointmentFrequency[];
    visitTypes: VisitTypeStatistic[];
    noShowRates: NoShowStatistic[];
    portalUsage: PortalUsageStatistic[];
  };
  financial: {
    insuranceDistribution: InsuranceDistribution[];
    outstandingBalances: number;
    paymentTrends: PaymentTrendStatistic[];
  };
}

export interface GenderDistribution {
  male: number;
  female: number;
  other: number;
  unknown: number;
}

export interface RiskLevelDistribution {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export interface AgeGroupDistribution {
  ageGroup: string;
  count: number;
  percentage: number;
}

export interface EthnicityDistribution {
  ethnicity: string;
  count: number;
  percentage: number;
}

export interface LanguageDistribution {
  language: string;
  count: number;
  percentage: number;
}

export interface GeographicDistribution {
  zipCode: string;
  city: string;
  state: string;
  patientCount: number;
}

export interface ConditionStatistic {
  condition: string;
  count: number;
  percentage: number;
  averageAge: number;
}

export interface AllergyStatistic {
  allergen: string;
  count: number;
  severity: string;
  reactions: string[];
}

export interface MedicationStatistic {
  medication: string;
  count: number;
  category: string;
  averageDuration: number;
}

export interface RiskFactorStatistic {
  riskFactor: string;
  count: number;
  associatedConditions: string[];
}

export interface AppointmentFrequency {
  frequency: string;
  patientCount: number;
  averageVisitsPerYear: number;
}

export interface VisitTypeStatistic {
  visitType: string;
  count: number;
  percentage: number;
  averageDuration: number;
}

export interface NoShowStatistic {
  month: string;
  scheduledAppointments: number;
  noShows: number;
  noShowRate: number;
}

export interface PortalUsageStatistic {
  feature: string;
  activeUsers: number;
  usageFrequency: number;
  lastUsed: string;
}

export interface InsuranceDistribution {
  insuranceCompany: string;
  patientCount: number;
  percentage: number;
}

export interface PaymentTrendStatistic {
  month: string;
  totalPayments: number;
  averagePayment: number;
  onTimePayments: number;
  latePayments: number;
}

// ===== API CLASS =====

export class PatientsEnhancedApi {
  private api = getApi();

  // ===== PATIENT MANAGEMENT =====

  // Get patients with advanced filtering and pagination
  async getPatients(
    filters: PatientSearchFilters = {},
    page: number = 1,
    pageSize: number = 50,
    sortBy: string = 'lastName',
    sortDirection: 'asc' | 'desc' = 'asc'
  ): Promise<PaginatedResponse<Patient>> {
    const response: AxiosResponse<PaginatedResponse<Patient>> = await this.api.get('/patients', {
      params: {
        ...filters,
        page,
        pageSize,
        sortBy,
        sortDirection,
        ageMin: filters.ageRange?.min,
        ageMax: filters.ageRange?.max,
        lastVisitStart: filters.lastVisitRange?.start,
        lastVisitEnd: filters.lastVisitRange?.end,
        registrationStart: filters.registrationDateRange?.start,
        registrationEnd: filters.registrationDateRange?.end
      }
    });
    return response.data;
  }

  // Get single patient by ID
  async getPatient(id: string): Promise<Patient> {
    const response: AxiosResponse<Patient> = await this.api.get(`/patients/${id}`);
    return response.data;
  }

  // Get patient by MRN
  async getPatientByMRN(mrn: string): Promise<Patient> {
    const response: AxiosResponse<Patient> = await this.api.get(`/patients/mrn/${mrn}`);
    return response.data;
  }

  // Create remains on POST /api/patients through the canonical wizard. This client has no create caller.
  async updatePatient(id: string, patient: Partial<Patient>): Promise<Patient> {
    const response: AxiosResponse<Patient> = await this.api.put(`/patients/${id}`, patient);
    return response.data;
  }

  // Delete patient (soft delete)
  async deletePatient(id: string): Promise<void> {
    await this.api.delete(`/patients/${id}`);
  }

  // ===== MEDICAL RECORDS =====

  // Get patient medical records
  async getMedicalRecords(patientId: string, recordType?: string): Promise<MedicalRecord[]> {
    const response: AxiosResponse<MedicalRecord[]> = await this.api.get(`/patients/${patientId}/medical-records`, {
      params: { recordType }
    });
    return response.data;
  }

  // Upload medical record
  async uploadMedicalRecord(patientId: string, recordData: FormData): Promise<MedicalRecord> {
    const response: AxiosResponse<MedicalRecord> = await this.api.post(
      `/patients/${patientId}/medical-records`,
      recordData,
      {
        headers: { 'Content-Type': 'multipart/form-data' }
      }
    );
    return response.data;
  }

  // Get lab results
  async getLabResults(patientId: string, dateRange?: { start: string; end: string }): Promise<LabResult[]> {
    const response: AxiosResponse<LabResult[]> = await this.api.get(`/patients/${patientId}/lab-results`, {
      params: dateRange
    });
    return response.data;
  }

  // Get imaging studies
  async getImagingStudies(patientId: string): Promise<ImagingStudy[]> {
    const response: AxiosResponse<ImagingStudy[]> = await this.api.get(`/patients/${patientId}/imaging-studies`);
    return response.data;
  }

  // ===== APPOINTMENTS INTEGRATION =====

  // Get patient appointments
  async getPatientAppointments(
    patientId: string,
    dateRange?: { start: string; end: string },
    status?: string
  ): Promise<PatientAppointment[]> {
    const response: AxiosResponse<PatientAppointment[]> = await this.api.get(`/patients/${patientId}/appointments`, {
      params: { ...dateRange, status }
    });
    return response.data;
  }

  // Book appointment for patient
  async bookAppointment(patientId: string, appointmentData: any): Promise<PatientAppointment> {
    const response: AxiosResponse<PatientAppointment> = await this.api.post(
      `/patients/${patientId}/appointments`,
      appointmentData
    );
    return response.data;
  }

  // Get visit history
  async getVisitHistory(patientId: string): Promise<VisitSummary[]> {
    const response: AxiosResponse<VisitSummary[]> = await this.api.get(`/patients/${patientId}/visit-history`);
    return response.data;
  }

  // ===== BILLING INTEGRATION =====

  // Get patient billing information
  async getPatientBilling(patientId: string): Promise<PatientBilling> {
    const response: AxiosResponse<PatientBilling> = await this.api.get(`/patients/${patientId}/billing`);
    return response.data;
  }

  // Get billing statements
  async getBillingStatements(patientId: string, year?: number): Promise<BillingStatement[]> {
    const response: AxiosResponse<BillingStatement[]> = await this.api.get(`/patients/${patientId}/statements`, {
      params: { year }
    });
    return response.data;
  }

  // Process payment
  async processPayment(patientId: string, paymentData: any): Promise<BillingPayment> {
    const response: AxiosResponse<BillingPayment> = await this.api.post(
      `/patients/${patientId}/payments`,
      paymentData
    );
    return response.data;
  }

  // ===== PATIENT PORTAL =====

  // Get portal user
  async getPortalUser(patientId: string): Promise<PatientPortalUser> {
    const response: AxiosResponse<PatientPortalUser> = await this.api.get(`/patients/${patientId}/portal-user`);
    return response.data;
  }

  // Register for portal
  async registerForPortal(patientId: string, registrationData: any): Promise<PatientPortalUser> {
    const response: AxiosResponse<PatientPortalUser> = await this.api.post(
      `/patients/${patientId}/portal-registration`,
      registrationData
    );
    return response.data;
  }

  // Get patient messages
  async getPatientMessages(patientId: string, status?: string): Promise<PatientMessage[]> {
    const response: AxiosResponse<PatientMessage[]> = await this.api.get(`/patients/${patientId}/messages`, {
      params: { status }
    });
    return response.data;
  }

  // Send message
  async sendMessage(patientId: string, messageData: any): Promise<PatientMessage> {
    const response: AxiosResponse<PatientMessage> = await this.api.post(
      `/patients/${patientId}/messages`,
      messageData
    );
    return response.data;
  }

  // Get education materials
  async getEducationMaterials(category?: string): Promise<PatientEducation[]> {
    const response: AxiosResponse<PatientEducation[]> = await this.api.get('/patient-education', {
      params: { category }
    });
    return response.data;
  }

  // ===== ANALYTICS =====

  // Get patient analytics
  async getPatientAnalytics(dateRange?: { start: string; end: string }): Promise<PatientAnalytics> {
    const response: AxiosResponse<PatientAnalytics> = await this.api.get('/patients/analytics', {
      params: dateRange
    });
    return response.data;
  }

  // ===== BULK OPERATIONS =====

  // Import patients from CSV
  async importPatients(csvFile: File): Promise<{ success: number; errors: any[] }> {
    const formData = new FormData();
    formData.append('file', csvFile);
    
    const response: AxiosResponse<{ success: number; errors: any[] }> = await this.api.post(
      '/patients/import',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' }
      }
    );
    return response.data;
  }

  // Export patients to CSV/Excel
  async exportPatients(
    format: 'csv' | 'xlsx' = 'xlsx',
    filters: PatientSearchFilters = {}
  ): Promise<void> {
    const response = await this.api.get('/patients/export', {
      params: { format, ...filters },
      responseType: 'blob'
    });

    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `patients_export.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  // Bulk update patients
  async bulkUpdatePatients(patientIds: string[], updateData: Partial<Patient>): Promise<{ updated: number; errors: any[] }> {
    const response: AxiosResponse<{ updated: number; errors: any[] }> = await this.api.patch('/patients/bulk-update', {
      patientIds,
      updateData
    });
    return response.data;
  }

  // ===== SEARCH & ADVANCED QUERIES =====

  // Quick patient search (autocomplete)
  async quickPatientSearch(query: string, limit: number = 10): Promise<Patient[]> {
    const response: AxiosResponse<Patient[]> = await this.api.get('/patients/quick-search', {
      params: { query, limit }
    });
    return response.data;
  }

  // Search patients with similar names (duplicate detection)
  async findSimilarPatients(patient: Partial<Patient>): Promise<Patient[]> {
    const response: AxiosResponse<Patient[]> = await this.api.post('/patients/find-similar', patient);
    return response.data;
  }

  // Advanced patient search
  async advancedPatientSearch(searchCriteria: any): Promise<PaginatedResponse<Patient>> {
    const response: AxiosResponse<PaginatedResponse<Patient>> = await this.api.post('/patients/advanced-search', searchCriteria);
    return response.data;
  }

  // ===== INSURANCE VERIFICATION =====

  // Verify insurance eligibility
  async verifyInsurance(patientId: string): Promise<{ isEligible: boolean; details: any }> {
    const response: AxiosResponse<{ isEligible: boolean; details: any }> = await this.api.post(
      `/patients/${patientId}/verify-insurance`
    );
    return response.data;
  }

  // Update insurance verification status
  async updateInsuranceVerification(patientId: string, verificationData: any): Promise<void> {
    await this.api.patch(`/patients/${patientId}/insurance-verification`, verificationData);
  }
}

// Export singleton instance
export const patientsEnhancedApi = new PatientsEnhancedApi();