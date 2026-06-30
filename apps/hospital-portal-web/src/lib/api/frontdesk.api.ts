import { getApi } from '../api';
import { searchPatientsUnified } from '@/lib/patients/unified-patient-search';

export interface FrontdeskBoardAppointment {
  id: string;
  patientId: string;
  patientName?: string;
  doctorId: string;
  doctorName?: string;
  appointmentDate: string;
  startTime?: string | null;
  appointmentType: string;
  status: string;
}

export interface FrontdeskBoardVisit {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  tokenNumber: string;
  status: string;
  currentStation?: string | null;
  checkedInAt?: string | null;
}

export interface FrontdeskBoardRow {
  appointment: FrontdeskBoardAppointment;
  visit?: FrontdeskBoardVisit | null;
  /** Derived: ScheduledNotArrived | CheckedIn | Routed */
  state: string;
}

export interface FrontdeskBoardStats {
  todayAppointments: number;
  checkedIn: number;
  scheduledNotArrived: number;
  routed: number;
}

export interface FrontdeskBoardPayload {
  branchId: string;
  date: string;
  stats: FrontdeskBoardStats;
  rows: FrontdeskBoardRow[];
}

export interface FrontdeskPatientSearchRow {
  id: string;
  patientName: string;
  mrn: string;
  phone?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
}

export const frontdeskApi = {
  getBoard: async (branchId: string, date: string) => {
    const response = await getApi().get<FrontdeskBoardPayload>('/frontdesk/board', {
      params: { branchId, date },
    });
    return response.data;
  },
  searchPatients: async (branchId: string, q: string, limit: number = 20) => {
    const hits = await searchPatientsUnified(branchId, q, limit);
    return hits.map((hit) => ({
      id: hit.id,
      patientName: `${hit.firstName} ${hit.lastName}`.trim(),
      mrn: hit.mrn,
      phone: hit.phone,
      gender: hit.gender,
      dateOfBirth: hit.dateOfBirth,
    }));
  },
  /** Frontdesk search with legacy endpoint fallback when unified suggest is unavailable. */
  searchPatientsWithFallback: async (branchId: string, q: string, limit: number = 20) => {
    try {
      return await frontdeskApi.searchPatients(branchId, q, limit);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 500 || status === 503) {
        const response = await getApi().get<FrontdeskPatientSearchRow[]>('/frontdesk/patients/search', {
          params: { branchId, q, limit },
        });
        return response.data ?? [];
      }
      throw err;
    }
  },
};

