import { getApi } from '../api';
import type { Patient } from './patients.api';

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

function mapPatientToSearchRow(p: Patient): FrontdeskPatientSearchRow {
  return {
    id: p.id,
    patientName: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(),
    mrn: p.medicalRecordNumber ?? '',
    phone: p.contactNumber ?? p.phone ?? null,
    gender: p.gender,
    dateOfBirth: p.dateOfBirth ?? null,
  };
}

/** Fallback when /frontdesk/patients/search is unavailable (older API build). */
async function searchPatientsLegacy(q: string): Promise<FrontdeskPatientSearchRow[]> {
  const api = getApi();
  const term = q.trim();
  const tokens = term.split(/\s+/).filter(Boolean);
  const searchTerms = [term, ...tokens].filter((v, i, a) => a.indexOf(v) === i);

  const byId = new Map<string, FrontdeskPatientSearchRow>();

  for (const t of searchTerms) {
    const strategies: Array<{ searchTerm: string; searchType: string }> = [
      { searchTerm: t, searchType: 'name' },
      { searchTerm: t, searchType: 'mrn' },
      { searchTerm: t, searchType: 'mobile' },
    ];
    for (const params of strategies) {
      try {
        const { data } = await api.get<Patient[]>('/patients/search', { params });
        for (const p of data ?? []) {
          if (!byId.has(p.id)) byId.set(p.id, mapPatientToSearchRow(p));
        }
      } catch {
        // try next strategy
      }
    }
  }

  return Array.from(byId.values()).slice(0, 20);
}

export const frontdeskApi = {
  getBoard: async (branchId: string, date: string) => {
    const response = await getApi().get<FrontdeskBoardPayload>('/frontdesk/board', {
      params: { branchId, date },
    });
    return response.data;
  },
  searchPatients: async (branchId: string, q: string, limit: number = 20) => {
    const response = await getApi().get<FrontdeskPatientSearchRow[]>('/frontdesk/patients/search', {
      params: { branchId, q, limit },
    });
    return response.data;
  },
  /** Frontdesk search with legacy fallback on 404. */
  searchPatientsWithFallback: async (branchId: string, q: string, limit: number = 20) => {
    try {
      return await frontdeskApi.searchPatients(branchId, q, limit);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        return searchPatientsLegacy(q);
      }
      throw err;
    }
  },
};

