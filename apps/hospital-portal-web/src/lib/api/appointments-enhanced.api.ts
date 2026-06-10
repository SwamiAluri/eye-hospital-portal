import { getApi } from '../api';

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientMrn?: string;
  doctorId: string;
  doctorName: string;
  departmentId?: string;
  departmentName?: string;
  branchId?: string;
  appointmentDate: string;
  startTime?: string;
  endTime?: string;
  appointmentType: string;
  status: string; // Scheduled, Confirmed, In-Progress, Completed, Cancelled, No-Show (case varies)
  notes?: string;
  reasonForVisit?: string;
  durationMinutes: number; // minutes
  duration?: number; // alias for durationMinutes for backward compatibility
  priority?: string; // low, normal, high, urgent
  isRecurring?: boolean;
  recurringPattern?: string;
  reminderSent?: boolean;
  patientPhone?: string;
  patientEmail?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AppointmentFilters {
  startDate?: string;
  endDate?: string;
  doctorId?: string;
  patientId?: string;
  departmentId?: string;
  status?: string;
  appointmentType?: string;
  priority?: string;
}

export interface CreateAppointmentDto {
  patientId: string;
  doctorId: string;
  departmentId?: string;
  appointmentDate: string;
  startTime: string;
  duration: number;
  appointmentType: string;
  reasonForVisit?: string;
  notes?: string;
  priority?: string;
  isRecurring?: boolean;
  recurringPattern?: string;
}

export interface UpdateAppointmentDto extends Partial<CreateAppointmentDto> {
  status?: string;
}

export interface DoctorAvailability {
  doctorId: string;
  date: string;
  availableSlots: TimeSlot[];
  unavailableSlots: TimeSlot[];
  workingHours: {
    start: string;
    end: string;
  };
  breakTimes: TimeSlot[];
  isAvailable: boolean;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  appointmentId?: string;
  duration: number;
  conflictReason?: string;
}

export interface AppointmentConflict {
  type: 'doctor_busy' | 'patient_busy' | 'room_unavailable' | 'outside_hours';
  message: string;
  conflictingAppointmentId?: string;
  suggestedAlternatives?: TimeSlot[];
}

export interface AppointmentStats {
  totalToday: number;
  completedToday: number;
  cancelledToday: number;
  noShowToday: number;
  averageDuration: number;
  mostBookedTimeSlot: string;
  departmentBreakdown: { departmentName: string; count: number }[];
}

export interface RealTimeUpdate {
  type: 'appointment_created' | 'appointment_updated' | 'appointment_cancelled' | 'slot_blocked';
  appointmentId: string;
  doctorId: string;
  timestamp: string;
  data: Partial<Appointment>;
}

export const appointmentsApi = {
  // Enhanced appointment management
  getAll: async (filters?: AppointmentFilters) => {
    const params = new URLSearchParams();
    // Backend expects 'fromDate' and 'toDate', not 'startDate' and 'endDate'
    if (filters?.startDate) params.append('fromDate', filters.startDate);
    if (filters?.endDate) params.append('toDate', filters.endDate);
    if (filters?.doctorId) params.append('doctorId', filters.doctorId);
    if (filters?.patientId) params.append('patientId', filters.patientId);
    if (filters?.departmentId) params.append('departmentId', filters.departmentId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    // Request a large page size to get all appointments for the date range
    params.append('pageSize', '500');
    
    return getApi().get<{ items: Appointment[]; totalCount: number }>(`/appointments?${params.toString()}`);
  },

  getById: async (id: string) => {
    return getApi().get<Appointment>(`/appointments/${id}`);
  },

  getByPatient: async (patientId: string) => {
    return getApi().get<Appointment[]>(`/appointments/patient/${patientId}`);
  },

  getByDoctor: async (doctorId: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return getApi().get<Appointment[]>(`/appointments/doctor/${doctorId}?${params.toString()}`);
  },

  create: async (data: CreateAppointmentDto) => {
    return getApi().post<Appointment>('/appointments', data);
  },

  update: async (id: string, data: UpdateAppointmentDto) => {
    return getApi().put<Appointment>(`/appointments/${id}`, data);
  },

  cancel: async (id: string, reason?: string) => {
    return getApi().delete(`/appointments/${id}`, { data: { reason } });
  },

  updateStatus: async (id: string, status: string, notes?: string) => {
    return getApi().put(`/appointments/${id}/status`, { status, notes });
  },

  // Doctor availability and conflict detection
  getDoctorAvailability: async (doctorId: string, date: string) => {
    return getApi().get<DoctorAvailability>(`/appointments/availability/${doctorId}?date=${date}`);
  },

  checkConflicts: async (doctorId: string, patientId: string, appointmentDate: string, startTime: string, duration: number, excludeAppointmentId?: string) => {
    const params = new URLSearchParams({
      doctorId,
      patientId,
      appointmentDate,
      startTime,
      duration: duration.toString()
    });
    if (excludeAppointmentId) params.append('excludeId', excludeAppointmentId);
    
    return getApi().get<AppointmentConflict[]>(`/appointments/conflicts?${params.toString()}`);
  },

  getSuggestedTimeSlots: async (doctorId: string, date: string, duration: number, preferredTimes?: string[]) => {
    const params = new URLSearchParams({
      doctorId,
      date,
      duration: duration.toString()
    });
    if (preferredTimes && preferredTimes.length > 0) {
      preferredTimes.forEach(time => params.append('preferredTimes', time));
    }
    
    return getApi().get<TimeSlot[]>(`/appointments/suggested-slots?${params.toString()}`);
  },

  // Calendar and scheduling
  getCalendarData: async (startDate: string, endDate: string, doctorIds?: string[], departmentIds?: string[]) => {
    const params = new URLSearchParams({
      startDate,
      endDate
    });
    if (doctorIds && doctorIds.length > 0) {
      doctorIds.forEach(id => params.append('doctorIds', id));
    }
    if (departmentIds && departmentIds.length > 0) {
      departmentIds.forEach(id => params.append('departmentIds', id));
    }
    
    return getApi().get<Appointment[]>(`/appointments/calendar?${params.toString()}`);
  },

  reschedule: async (appointmentId: string, newDate: string, newStartTime: string) => {
    return getApi().put(`/appointments/${appointmentId}/reschedule`, {
      appointmentDate: newDate,
      startTime: newStartTime
    });
  },

  // Bulk operations
  bulkUpdate: async (appointmentIds: string[], updates: Partial<UpdateAppointmentDto>) => {
    return getApi().put('/appointments/bulk', {
      appointmentIds,
      updates
    });
  },

  bulkCancel: async (appointmentIds: string[], reason: string) => {
    return getApi().delete('/appointments/bulk', {
      data: { appointmentIds, reason }
    });
  },

  // Statistics and analytics
  getStats: async (startDate?: string, endDate?: string, doctorId?: string, departmentId?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (doctorId) params.append('doctorId', doctorId);
    if (departmentId) params.append('departmentId', departmentId);
    
    return getApi().get<AppointmentStats>(`/appointments/stats?${params.toString()}`);
  },

  // Day 9: Slot availability with conflict detection
  getDoctorAvailability: async (doctorId: string, date: string, includeBlocked: boolean = true) => {
    const params = new URLSearchParams();
    params.append('date', date);
    params.append('includeBlocked', includeBlocked.toString());
    
    return getApi().get<DoctorAvailability>(`/appointments/doctor/${doctorId}/availability?${params.toString()}`);
  },

  checkConflicts: async (data: {
    doctorId: string;
    patientId: string;
    appointmentDate: string;
    startTime: string;
    duration: number;
    excludeAppointmentId?: string;
  }) => {
    return getApi().post<{ hasConflicts: boolean; conflicts: AppointmentConflict[] }>('/appointments/check-conflicts', data);
  },

  // Real-time updates
  subscribeToUpdates: (callback: (update: RealTimeUpdate) => void) => {
    // This would typically use WebSocket or Server-Sent Events
    // For now, we'll implement polling
    const eventSource = new EventSource(`${process.env.NEXT_PUBLIC_API_URL}/appointments/updates`);
    eventSource.onmessage = (event) => {
      const update: RealTimeUpdate = JSON.parse(event.data);
      callback(update);
    };
    return eventSource;
  },

  // Recurring appointments
  createRecurring: async (data: CreateAppointmentDto & { 
    recurringPattern: string;
    endDate: string;
    occurrences?: number;
  }) => {
    return getApi().post<Appointment[]>('/appointments/recurring', data);
  },

  updateRecurringSeries: async (appointmentId: string, updates: UpdateAppointmentDto, updateType: 'single' | 'future' | 'all') => {
    return getApi().put(`/appointments/${appointmentId}/recurring`, {
      ...updates,
      updateType
    });
  },

  // Reminders and notifications
  sendReminder: async (appointmentId: string, method: 'email' | 'sms' | 'both') => {
    return getApi().post(`/appointments/${appointmentId}/reminder`, { method });
  },

  getUpcomingReminders: async (hours: number = 24) => {
    return getApi().get<Appointment[]>(`/appointments/reminders?hours=${hours}`);
  }
};