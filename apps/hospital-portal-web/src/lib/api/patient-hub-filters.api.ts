import { getApi } from '@/lib/api';
import type { PatientLookupUrlState } from '@/lib/patients/patient-lookup-filters';

const HUB_FILTER_FIELD = 'HubLookupFilters';

export interface SavedHubFilter {
  id: string;
  searchName: string;
  filters: PatientLookupUrlState;
  isFavorite: boolean;
  createdAt: string;
}

type SavedSearchDto = {
  id: string;
  searchName: string;
  scope: number;
  criteria: Array<{ field: string; operator: number; value?: unknown }>;
  isFavorite: boolean;
  createdAt: string;
};

function filtersFromDto(dto: SavedSearchDto): SavedHubFilter | null {
  const raw = dto.criteria.find((c) => c.field === HUB_FILTER_FIELD)?.value;
  if (typeof raw !== 'string') return null;
  try {
    return {
      id: dto.id,
      searchName: dto.searchName,
      filters: JSON.parse(raw) as PatientLookupUrlState,
      isFavorite: dto.isFavorite,
      createdAt: dto.createdAt,
    };
  } catch {
    return null;
  }
}

/** SearchScope.Patient = 6 */
const PATIENT_SCOPE = 6;

export const patientHubFiltersApi = {
  async list(): Promise<SavedHubFilter[]> {
    const res = await getApi().get<SavedSearchDto[]>('/search/saved', {
      params: { scope: PATIENT_SCOPE },
    });
    return (res.data ?? [])
      .map(filtersFromDto)
      .filter((f): f is SavedHubFilter => f != null);
  },

  async save(name: string, filters: PatientLookupUrlState): Promise<SavedHubFilter> {
    const res = await getApi().post<SavedSearchDto>('/search/save', {
      searchName: name,
      scope: PATIENT_SCOPE,
      criteria: [
        {
          field: HUB_FILTER_FIELD,
          operator: 0,
          value: JSON.stringify(filters),
        },
      ],
      isGlobal: false,
      isFavorite: false,
    });
    const parsed = filtersFromDto(res.data);
    if (!parsed) throw new Error('Failed to parse saved filter');
    return parsed;
  },

  async remove(id: string): Promise<void> {
    await getApi().delete(`/search/saved/${id}`);
  },
};
