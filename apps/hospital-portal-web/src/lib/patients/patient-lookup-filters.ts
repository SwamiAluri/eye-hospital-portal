import type { PatientLookupFilters, PatientLookupTab } from '@/types/patient-lookup';



export type PatientLookupSortBy =
  | 'name'
  | 'mrn'
  | 'lastVisit'
  | 'scheduledAt'
  | 'acuity'
  | 'waitingMinutes';

const SORT_BY_VALUES: PatientLookupSortBy[] = [
  'name',
  'mrn',
  'lastVisit',
  'scheduledAt',
  'acuity',
  'waitingMinutes',
];

function parseSortBy(raw: string): PatientLookupSortBy {
  return SORT_BY_VALUES.includes(raw as PatientLookupSortBy)
    ? (raw as PatientLookupSortBy)
    : 'name';
}



export const CARE_PROGRAM_OPTIONS = [
  { code: 'CATARACT', label: 'Cataract' },
  { code: 'GLAUCOMA', label: 'Glaucoma' },
  { code: 'RETINA', label: 'Retina' },
  { code: 'CORNEA', label: 'Cornea' },
  { code: 'REFRACTIVE', label: 'LASIK' },
] as const;



export const ENGAGEMENT_TYPE_OPTIONS = [

  { value: 'opd', label: 'OPD' },

  { value: 'queue', label: 'Queue' },

  { value: 'ip', label: 'IP' },

  { value: 'counselling', label: 'Counselling' },

  { value: 'insurance', label: 'Insurance' },

  { value: 'billing', label: 'Billing' },

  { value: 'camp', label: 'Camp' },

] as const;



export const PATIENT_TYPE_OPTIONS = [

  'Cash',

  'Insurance',

  'CoPay',

  'CGHS',

  'Camp',

] as const;



export const FILTER_SHEET_SECTIONS = [

  { id: 'quick', label: 'Quick' },

  { id: 'identity', label: 'Identity' },

  { id: 'clinical', label: 'Clinical' },

  { id: 'schedule', label: 'Schedule' },

  { id: 'location', label: 'Location' },

  { id: 'care', label: 'Care' },

  { id: 'saved', label: 'Saved' },

] as const;



export interface PatientLookupUrlState extends PatientLookupFilters {

  previewPatientId?: string | null;

}



export function parseListParam(value: string | null): string[] {

  if (!value?.trim()) return [];

  return value.split(',').map((s) => s.trim()).filter(Boolean);

}



export function serializeList(values?: string[]): string | undefined {

  if (!values?.length) return undefined;

  return values.join(',');

}



function parseDateParam(value: string | null): string | undefined {

  if (!value?.trim()) return undefined;

  return value.trim();

}



export function parseLookupUrlParams(searchParams: URLSearchParams): PatientLookupUrlState {

  const tab = (searchParams.get('tab') ?? 'all') as PatientLookupTab;

  const sortByRaw = searchParams.get('sortBy') ?? 'name';

  const sortBy = parseSortBy(sortByRaw);

  const sortDirRaw = searchParams.get('sortDir') ?? 'asc';

  const sortDir = sortDirRaw === 'desc' ? 'desc' : 'asc';

  return {

    branchId: '',

    q: searchParams.get('q') ?? undefined,

    tab: ['all', 'current', 'new', 'discharged', 'high_priority'].includes(tab) ? tab : 'all',

    page: Number(searchParams.get('page') ?? '1') || 1,

    sortBy,

    sortDir,

    favoritesOnly: searchParams.get('favorites') === '1',

    assignedToMe: searchParams.get('assigned') === '1',

    engagementTypes: parseListParam(searchParams.get('engagementTypes')),

    programCodes: parseListParam(searchParams.get('programCodes')),

    patientTypes: parseListParam(searchParams.get('patientTypes')),

    gender: searchParams.get('gender') ?? undefined,

    mrn: searchParams.get('mrn') ?? undefined,

    phone: searchParams.get('phone') ?? undefined,

    name: searchParams.get('name') ?? undefined,

    diagnosis: searchParams.get('diagnosis') ?? undefined,

    providerId: searchParams.get('providerId') ?? undefined,

    departmentId: searchParams.get('departmentId') ?? undefined,

    wardName: searchParams.get('wardName') ?? undefined,

    dobFrom: parseDateParam(searchParams.get('dobFrom')),

    dobTo: parseDateParam(searchParams.get('dobTo')),

    appointmentFrom: parseDateParam(searchParams.get('appointmentFrom')),

    appointmentTo: parseDateParam(searchParams.get('appointmentTo')),

    admissionFrom: parseDateParam(searchParams.get('admissionFrom')),

    admissionTo: parseDateParam(searchParams.get('admissionTo')),

    previewPatientId: searchParams.get('preview'),

  };

}



export function buildLookupUrlParams(state: PatientLookupUrlState): URLSearchParams {

  const params = new URLSearchParams();

  if (state.q) params.set('q', state.q);

  if (state.tab && state.tab !== 'all') params.set('tab', state.tab);

  if (state.page && state.page > 1) params.set('page', String(state.page));

  if (state.sortBy && state.sortBy !== 'name') params.set('sortBy', state.sortBy);

  if (state.sortDir && state.sortDir !== 'asc') params.set('sortDir', state.sortDir);

  if (state.favoritesOnly) params.set('favorites', '1');

  if (state.assignedToMe) params.set('assigned', '1');

  const engagement = serializeList(state.engagementTypes);

  if (engagement) params.set('engagementTypes', engagement);

  const programs = serializeList(state.programCodes);

  if (programs) params.set('programCodes', programs);

  const types = serializeList(state.patientTypes);

  if (types) params.set('patientTypes', types);

  if (state.gender) params.set('gender', state.gender);

  if (state.mrn) params.set('mrn', state.mrn);

  if (state.phone) params.set('phone', state.phone);

  if (state.name) params.set('name', state.name);

  if (state.diagnosis) params.set('diagnosis', state.diagnosis);

  if (state.providerId) params.set('providerId', state.providerId);

  if (state.departmentId) params.set('departmentId', state.departmentId);

  if (state.wardName) params.set('wardName', state.wardName);

  if (state.dobFrom) params.set('dobFrom', state.dobFrom);

  if (state.dobTo) params.set('dobTo', state.dobTo);

  if (state.appointmentFrom) params.set('appointmentFrom', state.appointmentFrom);

  if (state.appointmentTo) params.set('appointmentTo', state.appointmentTo);

  if (state.admissionFrom) params.set('admissionFrom', state.admissionFrom);

  if (state.admissionTo) params.set('admissionTo', state.admissionTo);

  if (state.previewPatientId) params.set('preview', state.previewPatientId);

  return params;

}



export function countActiveFilters(state: PatientLookupUrlState): number {

  let n = 0;

  if (state.favoritesOnly) n++;

  if (state.assignedToMe) n++;

  if (state.engagementTypes?.length) n++;

  if (state.programCodes?.length) n++;

  if (state.patientTypes?.length) n++;

  if (state.gender) n++;

  if (state.mrn) n++;

  if (state.phone) n++;

  if (state.name) n++;

  if (state.diagnosis) n++;

  if (state.providerId) n++;

  if (state.departmentId) n++;

  if (state.wardName) n++;

  if (state.dobFrom || state.dobTo) n++;

  if (state.appointmentFrom || state.appointmentTo) n++;

  if (state.admissionFrom || state.admissionTo) n++;

  return n;

}


