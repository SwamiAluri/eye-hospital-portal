import { getApi } from '@/lib/api';
import { serializeList } from '@/lib/patients/patient-lookup-filters';
import type {
  PatientDataQuality,
  PatientLookupFilters,
  PatientLookupPage,
  PatientLookupStats,
  PatientRecentViewEntry,
  PatientRecentVisit,
  PatientSuggestRow,
  PatientSummary,
} from '@/types/patient-lookup';

function toApiSortBy(sortBy?: PatientLookupSortBy): string {
  switch (sortBy) {
    case 'lastVisit':
      return 'lastvisit';
    case 'scheduledAt':
      return 'scheduledat';
    case 'waitingMinutes':
      return 'waitingminutes';
    case 'acuity':
      return 'acuity';
    case 'mrn':
      return 'mrn';
    default:
      return sortBy ?? 'name';
  }
}

function lookupParams(filters: PatientLookupFilters) {
  const sortBy = toApiSortBy(filters.sortBy as PatientLookupSortBy | undefined);
  return {
    branchId: filters.branchId,
    q: filters.q || undefined,
    tab: filters.tab ?? 'all',
    page: filters.page ?? 1,
    pageSize: filters.pageSize ?? 25,
    sortBy,
    sortDir: filters.sortDir ?? 'asc',
    favoritesOnly: filters.favoritesOnly ?? false,
    assignedToMe: filters.assignedToMe ?? false,
    engagementTypes: serializeList(filters.engagementTypes),
    programCodes: serializeList(filters.programCodes),
    patientTypes: serializeList(filters.patientTypes),
    gender: filters.gender || undefined,
    mrn: filters.mrn || undefined,
    phone: filters.phone || undefined,
    name: filters.name || undefined,
    diagnosis: filters.diagnosis || undefined,
    providerId: filters.providerId || undefined,
    departmentId: filters.departmentId || undefined,
    wardName: filters.wardName || undefined,
    dobFrom: filters.dobFrom || undefined,
    dobTo: filters.dobTo || undefined,
    appointmentFrom: filters.appointmentFrom || undefined,
    appointmentTo: filters.appointmentTo || undefined,
    admissionFrom: filters.admissionFrom || undefined,
    admissionTo: filters.admissionTo || undefined,
  };
}

export const patientLookupApi = {
  suggest: async (branchId: string, q: string, limit = 10): Promise<PatientSuggestRow[]> => {
    const { data } = await getApi().get<PatientSuggestRow[]>('/patients/suggest', {
      params: { branchId, q, limit },
    });
    return data ?? [];
  },

  lookup: async (filters: PatientLookupFilters): Promise<PatientLookupPage> => {
    const { data } = await getApi().get<PatientLookupPage>('/patients/lookup', {
      params: lookupParams(filters),
    });
    return data;
  },

  stats: async (branchId: string): Promise<PatientLookupStats> => {
    const { data } = await getApi().get<PatientLookupStats>('/patients/lookup/stats', {
      params: { branchId },
    });
    return data;
  },

  exportCsv: async (filters: PatientLookupFilters): Promise<Blob> => {
    const response = await getApi().get('/patients/lookup/export', {
      params: { ...lookupParams(filters), format: 'csv', pageSize: 5000 },
      responseType: 'blob',
    });
    return response.data;
  },

  toggleFavorite: async (patientId: string): Promise<{ isFavorite: boolean }> => {
    const { data } = await getApi().put<{ isFavorite: boolean }>(`/patients/${patientId}/favorite`);
    return data;
  },

  getSummary: async (
    patientId: string,
    branchId: string,
    options?: { skipPhiAudit?: boolean },
  ): Promise<PatientSummary> => {
    const { data } = await getApi().get<PatientSummary>(`/patients/${patientId}/summary`, {
      params: { branchId, skipPhiAudit: options?.skipPhiAudit ?? false },
    });
    return data;
  },

  getRecentVisits: async (
    patientId: string,
    branchId: string,
    limit = 5,
  ): Promise<PatientRecentVisit[]> => {
    const { data } = await getApi().get<PatientRecentVisit[]>(`/patients/${patientId}/visits/recent`, {
      params: { branchId, limit },
    });
    return data ?? [];
  },

  getDataQuality: async (patientId: string): Promise<PatientDataQuality> => {
    const { data } = await getApi().get<PatientDataQuality>(`/patients/${patientId}/data-quality`);
    return data;
  },

  exportSummaryPdf: async (patientId: string, branchId: string): Promise<Blob> => {
    const response = await getApi().get(`/patients/${patientId}/summary/export`, {
      params: { branchId, format: 'pdf' },
      responseType: 'blob',
    });
    return response.data;
  },

  logPhiAccess: async (patientId: string, context = 'preview'): Promise<void> => {
    await getApi().post(`/patients/${patientId}/phi-access`, { context });
  },

  recordRecentView: async (patientId: string): Promise<void> => {
    await getApi().post(`/patients/${patientId}/recent-view`);
  },

  getRecentViews: async (limit = 6): Promise<PatientRecentViewEntry[]> => {
    const { data } = await getApi().get<PatientRecentViewEntry[]>('/patients/recent-views', {
      params: { limit },
    });
    return (data ?? []).map((row) => ({
      patientId: row.patientId,
      firstName: row.firstName,
      lastName: row.lastName,
      mrn: row.mrn,
      photoThumbnailUrl: row.photoThumbnailUrl,
      viewedAt: row.viewedAt,
    }));
  },

  omniSearch: async (
    branchId: string,
    scope: string,
    q: string,
    limit = 15,
  ) => {
    const { data } = await getApi().get<
      Array<{
        id: string;
        title: string;
        subtitle?: string | null;
        meta?: string | null;
        actionType: string;
        patientId?: string | null;
        hubFilter?: Record<string, string> | null;
        path?: string | null;
      }>
    >('/patients/omni-search', {
      params: { branchId, scope, q, limit },
    });
    return data ?? [];
  },
};
