import {
  buildLookupUrlParams,
  parseLookupUrlParams,
  type PatientLookupUrlState,
} from '@/lib/patients/patient-lookup-filters';

export const PATIENT_DIRECTORY_PATH = '/dashboard/patients';

/**
 * Sync Directory URL without Next.js client navigation.
 * router.replace + useSearchParams inside Suspense remounts PatientHubPage
 * and steals focus from the search input on every debounced keystroke.
 */
export function replaceDirectoryUrlState(
  state: PatientLookupUrlState,
  deps: { history?: Pick<History, 'replaceState' | 'state'>; location?: Pick<Location, 'pathname' | 'search'> } = {},
): string {
  const historyApi = deps.history ?? (typeof window !== 'undefined' ? window.history : undefined);
  const locationApi = deps.location ?? (typeof window !== 'undefined' ? window.location : undefined);
  const params = buildLookupUrlParams(state);
  const qs = params.toString();
  const href = qs ? `${PATIENT_DIRECTORY_PATH}?${qs}` : PATIENT_DIRECTORY_PATH;
  if (!historyApi || !locationApi) return href;

  const current = `${locationApi.pathname}${locationApi.search}`;
  if (current !== href) {
    historyApi.replaceState(historyApi.state, '', href);
  }
  return href;
}

/** Read Directory URL state from the browser location (back/forward / deep link). */
export function readDirectoryUrlStateFromLocation(
  search: string = typeof window !== 'undefined' ? window.location.search : '',
): PatientLookupUrlState {
  return parseLookupUrlParams(new URLSearchParams(search.startsWith('?') ? search.slice(1) : search));
}

/**
 * While the search field is focused, URL hydration must not overwrite local typing.
 * External navigations (back/forward, chips cleared elsewhere) still hydrate when unfocused.
 */
export function shouldHydrateSearchFromUrl(input: {
  searchFocused: boolean;
  localSearch: string;
  urlQ: string | undefined;
}): boolean {
  if (input.searchFocused) return false;
  return (input.localSearch || '') !== (input.urlQ ?? '');
}
