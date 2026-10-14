import { getApi } from '../api';

// Types - Aligned with backend PatientDto
export interface Patient {
  id: string;
  medicalRecordNumber: string;
  patientCode?: string; // Alias for backward compatibility
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  email?: string;
  contactNumber?: string; // Backend uses contactNumber
  phone?: string;
  photoUrl?: string;  // Patient photo/avatar URL
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  bloodGroup?: string;
  allergies?: string[];
  medicalHistory?: string;
  
  // Enhanced Medical History fields
  chronicConditions?: string;
  currentMedications?: string;
  pastSurgeries?: string;
  familyMedicalHistory?: string;
  knownAllergiesDetails?: string;
  immunizationRecords?: string;
  disabilityStatus?: string;
  specialNeeds?: string;
  
  // Lifestyle fields
  exerciseHabits?: string;
  dietType?: string;
  smokingStatus?: string;
  alcoholUse?: string;
  lifestyleNotes?: string;
  
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  status: string;
  tenantId?: string;
  branchId?: string;
  createdAt: string;
  updatedAt?: string;
  lastVisit?: string;
}

export interface PatientFormData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  bloodGroup?: string;
  allergies?: string[];
  medicalHistory?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  status?: string;
  /** Optional — server ResolveEffectiveBranchAsync when omitted. */
  branchId?: string;
}

export interface PatientDetails extends Patient {
  appointments?: {
    id: string;
    appointmentDate: string;
    appointmentType: string;
    status: string;
    doctorName: string;
    notes?: string;
  }[];
  examinations?: {
    id: string;
    examinationDate: string;
    examinationType: string;
    findings?: string;
    diagnosis?: string;
    prescriptions?: string;
  }[];
}

export interface PatientStats {
  totalPatients: number;
  newPatientsThisMonth: number;
  activePatients: number;
  criticalPatients: number;
}

/**
 * API client for patient operations
 */
export const patientApi = {
  /**
   * Get all patients with optional filtering and pagination.
   * For typeahead search use `searchPatientsUnified` from `@/lib/patients/unified-patient-search`.
   */
  async getAll(params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    branchId?: string;
  }) {
    const api = getApi();

    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.branchId) queryParams.append('branchId', params.branchId);

    const query = queryParams.toString();
    return api.get<Patient[]>(`/patients${query ? `?${query}` : ''}`);
  },

  /**
   * Get a single patient by ID
   */
  async getById(id: string) {
    const api = getApi();
    try {
      return await api.get<Patient>(`/patients/${id}`);
    } catch (error) {
      // Fallback to mock data for development (when backend is not fully connected)
      console.warn(`Patient API failed for ID ${id}, using mock data`);
      return getMockPatientById(id);
    }
  },

  /**
   * Get detailed patient information including appointments and examinations
   */
  async getDetails(id: string) {
    const api = getApi();
    return api.get<PatientDetails>(`/patients/${id}/details`);
  },

  /**
   * DUP-C.2 / DUP-C.3 — Create-scoped duplicate pre-check (patient.create).
   * Minimized response; does not authorize creation.
   */
  async checkDuplicatesForRegistration(data: {
    firstName: string;
    lastName: string;
    dateOfBirth?: string | null;
    contactNumber?: string | null;
    email?: string | null;
  }) {
    const api = getApi();
    return api.post<{
      isDuplicate: boolean;
      message?: string;
      matches: Array<{
        id: string;
        medicalRecordNumber?: string;
        firstName?: string;
        lastName?: string;
        dateOfBirth?: string;
        gender?: string | null;
        matchType?: string;
        matchedAttributes?: string[];
        differentAttributes?: string[];
      }>;
    }>('/patients/registration/check-duplicates', {
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth || null,
      contactNumber: data.contactNumber || null,
      email: data.email || null,
    });
  },

  /**
   * Create a new patient
   */
  async create(data: PatientFormData) {
    const api = getApi();
    const { sanitizePatientWritePayload } = await import('@/lib/patients/patient-write-payload');
    return api.post<Patient>('/patients', sanitizePatientWritePayload(data as unknown as Record<string, unknown>));
  },

  /**
   * Update an existing patient
   */
  async update(id: string, data: Partial<PatientFormData>) {
    const api = getApi();
    const { sanitizePatientWritePayload } = await import('@/lib/patients/patient-write-payload');
    return api.put<Patient>(`/patients/${id}`, sanitizePatientWritePayload(data as unknown as Record<string, unknown>));
  },

  /**
   * Delete a patient (soft delete)
   */
  async delete(id: string) {
    const api = getApi();
    return api.delete(`/patients/${id}`);
  },

  /**
   * @deprecated Use `searchPatientsUnified` from `@/lib/patients/unified-patient-search`.
   */
  async search(query: string, branchId?: string) {
    const { searchPatientsUnified, unifiedHitToPatient } = await import(
      '@/lib/patients/unified-patient-search'
    );
    const hits = await searchPatientsUnified(branchId ?? null, query, 25);
    return { data: hits.map(unifiedHitToPatient) };
  },

  /**
   * Get patient statistics
   */
  async getStatistics(branchId?: string) {
    const api = getApi();
    const query = branchId ? `?branchId=${branchId}` : '';
    return api.get<PatientStats>(`/patients/statistics${query}`);
  },

  /**
   * Get patients by branch
   */
  async getByBranch(branchId: string) {
    const api = getApi();
    return api.get<Patient[]>(`/patients/branch/${branchId}`);
  },

  /**
   * Upload patient photo (Phase 7)
   */
  async uploadPhoto(patientId: string, formData: FormData) {
    const api = getApi();
    return api.post(`/patients/${patientId}/photo`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * Delete patient photo (Phase 7)
   */
  async deletePhoto(patientId: string) {
    const api = getApi();
    return api.delete(`/patients/${patientId}/photo`);
  }
};

// ==========================================
// Mock Data for Development
// ==========================================
function getMockPatientById(id: string): { data: Patient } {
  const mockPatients: Record<string, Patient> = {
    '550e8400-e29b-41d4-a716-446655440001': {
      id: '550e8400-e29b-41d4-a716-446655440001',
      patientCode: 'MRN001234',
      firstName: 'Ramesh',
      lastName: 'Kumar',
      dateOfBirth: '1959-03-15',
      gender: 'Male',
      email: 'ramesh.kumar@email.com',
      phone: '+91-9876543210',
      bloodGroup: 'B+',
      address: '123 MG Road',
      city: 'Bangalore',
      state: 'Karnataka',
      postalCode: '560001',
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
    },
    '550e8400-e29b-41d4-a716-446655440002': {
      id: '550e8400-e29b-41d4-a716-446655440002',
      patientCode: 'MRN005678',
      firstName: 'Lakshmi',
      lastName: 'Devi',
      dateOfBirth: '1968-07-22',
      gender: 'Female',
      email: 'lakshmi.devi@email.com',
      phone: '+91-9123456789',
      bloodGroup: 'O+',
      address: '456 Brigade Road',
      city: 'Bangalore',
      state: 'Karnataka',
      postalCode: '560025',
      status: 'active',
      createdAt: '2024-01-15T00:00:00Z',
    },
    '550e8400-e29b-41d4-a716-446655440003': {
      id: '550e8400-e29b-41d4-a716-446655440003',
      patientCode: 'MRN009012',
      firstName: 'Suresh',
      lastName: 'Babu',
      dateOfBirth: '1954-11-08',
      gender: 'Male',
      email: 'suresh.babu@email.com',
      phone: '+91-9898989898',
      bloodGroup: 'A+',
      address: '789 Residency Road',
      city: 'Bangalore',
      state: 'Karnataka',
      postalCode: '560012',
      status: 'active',
      createdAt: '2024-02-01T00:00:00Z',
    },
    '550e8400-e29b-41d4-a716-446655440004': {
      id: '550e8400-e29b-41d4-a716-446655440004',
      patientCode: 'MRN001122',
      firstName: 'Priya',
      lastName: 'Sharma',
      dateOfBirth: '1981-04-12',
      gender: 'Female',
      email: 'priya.sharma@email.com',
phone: '+91-9765432109',
      bloodGroup: 'AB+',
      address: '321 Koramangala',
      city: 'Bangalore',
      state: 'Karnataka',
      postalCode: '560034',
      medicalHistory: 'Type 2 Diabetes',
      status: 'active',
      createdAt: '2024-02-10T00:00:00Z',
    },
    '550e8400-e29b-41d4-a716-446655440005': {
      id: '550e8400-e29b-41d4-a716-446655440005',
      patientCode: 'MRN003344',
      firstName: 'Arun',
      lastName: 'Nair',
      dateOfBirth: '2018-06-20',
      gender: 'Male',
      email: 'parent.nair@email.com',
      phone: '+91-9543218765',
      bloodGroup: 'O-',
      address: '567 Indiranagar',
      city: 'Bangalore',
      state: 'Karnataka',
      postalCode: '560038',
      emergencyContactName: 'Mrs. Nair',
      emergencyContactPhone: '+91-9543218766',
      emergencyContactRelation: 'Mother',
      status: 'active',
      createdAt: '2024-03-01T00:00:00Z',
    },
    '550e8400-e29b-41d4-a716-446655440006': {
      id: '550e8400-e29b-41d4-a716-446655440006',
      patientCode: 'MRN007788',
      firstName: 'Kavitha',
      lastName: 'Menon',
      dateOfBirth: '1971-09-30',
      gender: 'Female',
      email: 'kavitha.menon@email.com',
      phone: '+91-9632587410',
      bloodGroup: 'B-',
      address: '890 Whitefield',
      city: 'Bangalore',
      state: 'Karnataka',
      postalCode: '560066',
      medicalHistory: 'Post-cataract surgery (LE)',
      status: 'active',
      createdAt: '2024-03-15T00:00:00Z',
    },
    '550e8400-e29b-41d4-a716-446655440007': {
      id: '550e8400-e29b-41d4-a716-446655440007',
      patientCode: 'MRN004455',
      firstName: 'Mohan',
      lastName: 'Das',
      dateOfBirth: '1973-12-05',
      gender: 'Male',
      email: 'mohan.das@email.com',
      phone: '+91-9871236540',
      bloodGroup: 'A-',
      address: '234 HSR Layout',
      city: 'Bangalore',
      state: 'Karnataka',
      postalCode: '560102',
      status: 'active',
      createdAt: '2024-04-01T00:00:00Z',
    },
  };

  const patient = mockPatients[id];
  if (!patient) {
    // Return generic patient for unknown IDs
    return {
      data: {
        id,
        patientCode: 'UNKNOWN',
        firstName: 'Unknown',
        lastName: 'Patient',
        dateOfBirth: '1990-01-01',
        gender: 'Unknown',
        status: 'active',
        createdAt: new Date().toISOString(),
      },
    };
  }

  return { data: patient };
}
