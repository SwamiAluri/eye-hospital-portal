import { getApi } from '../api';
import { unwrapPagedItems, type PagedResult } from './paged-result';

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  departmentId?: string;
  departmentName?: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  appointmentType: string;
  consultationType?: string;
  priority?: string;
  appointmentCategory?: 'OPD' | 'Surgery' | 'Diagnostic' | 'Follow-up' | 'Emergency';
  specialty?: string;
  status: 'scheduled' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  reasonForVisit?: string;
  duration: number; // minutes
  // Eye Hospital Specific Fields
  requiresPreOp?: boolean;
  preOpClearanceDate?: string;
  preOpClearedBy?: string;
  preOpNotes?: string;
  requiresIOLSelection?: boolean;
  selectedIOLId?: string;
  selectedIOLModel?: string;
  iolPower?: string;
  biometryData?: {
    axialLength?: number;
    k1?: number;
    k2?: number;
    acd?: number;
    calculatedPower?: string;
  };
}

export interface AppointmentFilters {
  /** ISO date (YYYY-MM-DD) - maps to backend fromDate/toDate. */
  startDate?: string;
  /** ISO date (YYYY-MM-DD) - maps to backend fromDate/toDate. */
  endDate?: string;
  doctorId?: string;
  patientId?: string;
  departmentId?: string;
  status?: string;
  appointmentType?: string;
  appointmentCategory?: 'OPD' | 'Surgery' | 'Diagnostic' | 'Follow-up' | 'Emergency';
  specialty?: string;
}

export interface CreateAppointmentDto {
  patientId: string;
  doctorId: string;
  departmentId?: string;
  appointmentDate: string;
  startTime: string;
  duration: number;
  appointmentType: string;
  consultationType?: string;
  priority?: string;
  appointmentCategory?: 'OPD' | 'Surgery' | 'Diagnostic' | 'Follow-up' | 'Emergency';
  specialty?: string;
  reasonForVisit?: string;
  notes?: string;
  // Eye Hospital Specific
  requiresPreOp?: boolean;
  preOpClearanceDate?: string;
  preOpNotes?: string;
  requiresIOLSelection?: boolean;
  selectedIOLId?: string;
  iolPower?: string;
}

export interface UpdateAppointmentDto extends Partial<CreateAppointmentDto> {
  status?: string;
}

export interface PreOpClearance {
  patientId: string;
  patientName: string;
  isCleared: boolean;
  clearanceDate?: string;
  clearedBy?: string;
  expiryDate?: string;
  medicalConditions?: string[];
  medications?: string[];
  allergies?: string[];
  notes?: string;
  requiredTests?: {
    testName: string;
    completed: boolean;
    completedDate?: string;
    result?: string;
  }[];
}

export interface IOLInventoryItem {
  id: string;
  manufacturer: string; // Alcon, J&J, Zeiss
  model: string;
  type: 'Monofocal' | 'Multifocal' | 'Toric' | 'EDOF';
  power: string; // e.g., "+20.0 D"
  material: string;
  availability: number;
  price?: number;
}

export interface BiometryData {
  patientId: string;
  eye: 'OD' | 'OS';
  axialLength: number;
  k1: number;
  k2: number;
  acd: number; // Anterior chamber depth
  lensThickness?: number;
  whiteToWhite?: number;
  calculatedPower: string;
  formula: 'SRK/T' | 'Haigis' | 'Holladay' | 'Barrett';
  targetRefraction: string;
  measurementDate: string;
}

export interface SpecialtySlot {
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
  bookedCount: number;
  maxCapacity: number;
  doctorId: string;
  doctorName: string;
  appointmentType: string;
  specialty: string;
}

export const appointmentsApi = {
  // List appointments with filters
  getAll: async (filters?: AppointmentFilters) => {
    const params = new URLSearchParams();
    // Backend expects fromDate/toDate. Keep startDate/endDate in type for UI callsites.
    if (filters?.startDate) params.append('fromDate', filters.startDate);
    if (filters?.endDate) params.append('toDate', filters.endDate);
    if (filters?.doctorId) params.append('doctorId', filters.doctorId);
    if (filters?.patientId) params.append('patientId', filters.patientId);
    if (filters?.departmentId) params.append('departmentId', filters.departmentId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.appointmentCategory) params.append('appointmentCategory', filters.appointmentCategory);
    if (filters?.specialty) params.append('specialty', filters.specialty);
    
    return getApi().get<Appointment[]>(`/appointments?${params.toString()}`);
  },

  // Get single appointment
  getById: async (id: string) => {
    return getApi().get<Appointment>(`/appointments/${id}`);
  },

  // Get appointments for a specific patient (unwraps PagedResult from API)
  getByPatient: async (patientId: string, pageSize = 100) => {
    const response = await getApi().get<PagedResult<Appointment> | Appointment[]>(
      `/appointments/patient/${patientId}`,
      { params: { page: 1, pageSize } },
    );
    return { ...response, data: unwrapPagedItems(response.data) };
  },

  // Create appointment
  create: async (data: CreateAppointmentDto) => {
    return getApi().post<Appointment>('/appointments', data);
  },

  // Update appointment
  update: async (id: string, data: UpdateAppointmentDto) => {
    return getApi().put<Appointment>(`/appointments/${id}`, data);
  },

  // Delete/Cancel appointment
  cancel: async (id: string) => {
    return getApi().delete(`/appointments/${id}`);
  },

  // Change status
  updateStatus: async (id: string, status: string) => {
    return getApi().put(`/appointments/${id}/status`, { status });
  },

  // Get calendar view data
  getCalendarData: async (startDate: string, endDate: string) => {
    return getApi().get<Appointment[]>(`/appointments/calendar?startDate=${startDate}&endDate=${endDate}`);
  },

  // Check availability (optional)
  checkAvailability: async (doctorId: string, date: string, startTime: string, duration: number) => {
    return getApi().get(`/appointments/availability?doctorId=${doctorId}&date=${date}&startTime=${startTime}&duration=${duration}`);
  },

  // ===== Eye Hospital Specialty Methods =====

  // Get OPD slots for a specific date and specialty
  getOPDSlots: async (date: string, specialty?: string, doctorId?: string) => {
    const params = new URLSearchParams();
    params.append('date', date);
    params.append('category', 'OPD');
    if (specialty) params.append('specialty', specialty);
    if (doctorId) params.append('doctorId', doctorId);
    
    // TODO: Replace with actual endpoint
    return getApi().get<SpecialtySlot[]>(`/appointments/specialty-slots?${params.toString()}`);
  },

  // Get Surgery slots for a specific date and surgery type
  getSurgerySlots: async (date: string, surgeryType?: string, doctorId?: string) => {
    const params = new URLSearchParams();
    params.append('date', date);
    params.append('category', 'Surgery');
    if (surgeryType) params.append('appointmentType', surgeryType);
    if (doctorId) params.append('doctorId', doctorId);
    
    // TODO: Replace with actual endpoint
    return getApi().get<SpecialtySlot[]>(`/appointments/specialty-slots?${params.toString()}`);
  },

  // Check pre-operative clearance status
  checkPreOpClearance: async (patientId: string) => {
    // TODO: Replace with actual endpoint
    return getApi().get<PreOpClearance>(`/patients/${patientId}/pre-op-clearance`);
  },

  // Update pre-operative clearance
  updatePreOpClearance: async (patientId: string, data: Partial<PreOpClearance>) => {
    // TODO: Replace with actual endpoint
    return getApi().post<PreOpClearance>(`/patients/${patientId}/pre-op-clearance`, data);
  },

  // Get IOL inventory for selection
  getIOLInventory: async (power?: string, type?: string) => {
    const params = new URLSearchParams();
    if (power) params.append('power', power);
    if (type) params.append('type', type);
    
    // TODO: Replace with actual endpoint
    return getApi().get<IOLInventoryItem[]>(`/iol-inventory/available?${params.toString()}`);
  },

  // Get biometry data for IOL calculation
  getBiometryData: async (patientId: string, eye?: 'OD' | 'OS') => {
    const params = eye ? `?eye=${eye}` : '';
    // TODO: Replace with actual endpoint
    return getApi().get<BiometryData[]>(`/patients/${patientId}/biometry${params}`);
  },

  // Calculate IOL power based on biometry
  calculateIOLPower: async (patientId: string, eye: 'OD' | 'OS', formula: string = 'SRK/T') => {
    // TODO: Replace with actual endpoint
    return getApi().post<BiometryData>(`/patients/${patientId}/calculate-iol`, { eye, formula });
  },

  // Create specialty-specific appointment slot template
  createSpecialtySlot: async (data: {
    doctorId: string;
    appointmentTypeId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    capacity: number;
    category: 'OPD' | 'Surgery';
  }) => {
    // TODO: Replace with actual endpoint
    return getApi().post('/appointments/specialty-slot-templates', data);
  },

  // Get appointments requiring pre-op clearance
  getPendingPreOpAppointments: async () => {
    return getApi().get<Appointment[]>('/appointments/pending-pre-op');
  },

  // Get surgery schedule (filtered for surgery appointments)
  getSurgerySchedule: async (startDate: string, endDate: string, surgeonId?: string) => {
    const params = new URLSearchParams();
    params.append('startDate', startDate);
    params.append('endDate', endDate);
    params.append('category', 'Surgery');
    if (surgeonId) params.append('doctorId', surgeonId);
    
    return getApi().get<Appointment[]>(`/appointments?${params.toString()}`);
  }
};
