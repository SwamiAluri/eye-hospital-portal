/**
 * C-01 — Waiting List limited URL state (PD-C01-05).
 *
 * Navigation / view state only. Does not encode ownership mutation,
 * Assign / Claim / Reassign, or dedicated PHI identity fields (patientName / MRN).
 * Quick search uses `q` for operational deep-link of the existing search box.
 */

import type { WaitingListOwnerFilter } from '@/lib/counsellors-desk/waiting-list-client-filters';
import {
  WAITING_LIST_DEFAULT_PAGE_SIZE,
  WAITING_LIST_PAGE_SIZE_OPTIONS,
  type WaitingListPageSize,
} from '@/lib/counsellors-desk/waiting-list-pagination';

export const WAITING_LIST_URL_PARAMS = {
  tab: 'tab',
  type: 'type',
  owner: 'owner',
  /** Quick-search box only — not a dedicated patientName/MRN identity field. */
  search: 'q',
  page: 'page',
  pageSize: 'pageSize',
} as const;

export const WAITING_LIST_URL_DEFAULTS = {
  tab: 'All',
  type: 'All' as const,
  owner: 'All' as WaitingListOwnerFilter,
  search: '',
  page: 1,
  pageSize: WAITING_LIST_DEFAULT_PAGE_SIZE as WaitingListPageSize,
};

/** Status tab keys accepted in URL (must match toolbar / summary). */
export const WAITING_LIST_URL_TAB_KEYS = [
  'All',
  'Pending',
  'Processed',
  'Done',
  'AddOnSurgery',
  'RepeatCounselling',
  'SurgeryDone',
  'OtReturned',
  'PreAuthQueue',
] as const;

export type WaitingListUrlTab = (typeof WAITING_LIST_URL_TAB_KEYS)[number];

export type WaitingListUrlType = 'All' | 'Procedure' | 'Surgery';

export type WaitingListUrlState = {
  tab: WaitingListUrlTab;
  type: WaitingListUrlType;
  owner: WaitingListOwnerFilter;
  search: string;
  page: number;
  pageSize: WaitingListPageSize;
};

const OWNER_VALUES: ReadonlySet<string> = new Set([
  'All',
  'Mine',
  'Unassigned',
  'Other',
]);

const TYPE_VALUES: ReadonlySet<string> = new Set(['All', 'Procedure', 'Surgery']);

const TAB_VALUES: ReadonlySet<string> = new Set(WAITING_LIST_URL_TAB_KEYS);

const PAGE_SIZE_SET: ReadonlySet<number> = new Set(WAITING_LIST_PAGE_SIZE_OPTIONS);

/** Missing / invalid → All. */
export function parseWaitingListTabParam(
  value: string | null | undefined,
): WaitingListUrlTab {
  if (value == null || value === '') return WAITING_LIST_URL_DEFAULTS.tab;
  return TAB_VALUES.has(value) ? (value as WaitingListUrlTab) : WAITING_LIST_URL_DEFAULTS.tab;
}

/** Missing / invalid → All. */
export function parseWaitingListTypeParam(
  value: string | null | undefined,
): WaitingListUrlType {
  if (value == null || value === '') return WAITING_LIST_URL_DEFAULTS.type;
  return TYPE_VALUES.has(value) ? (value as WaitingListUrlType) : WAITING_LIST_URL_DEFAULTS.type;
}

/** Missing / invalid → All. */
export function parseWaitingListOwnerParam(
  value: string | null | undefined,
): WaitingListOwnerFilter {
  if (value == null || value === '') return WAITING_LIST_URL_DEFAULTS.owner;
  return OWNER_VALUES.has(value)
    ? (value as WaitingListOwnerFilter)
    : WAITING_LIST_URL_DEFAULTS.owner;
}

/**
 * Quick-search string. Empty / missing → ''.
 * Does not parse dedicated patientName or mrd params (those stay Apply-only, not URL).
 */
export function parseWaitingListSearchParam(
  value: string | null | undefined,
): string {
  if (value == null) return '';
  return value;
}

/** Missing / invalid / non-positive → 1. */
export function parseWaitingListPageParam(
  value: string | null | undefined,
): number {
  if (value == null || value === '') return 1;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

/** Missing / invalid → default 10. */
export function parseWaitingListPageSizeParam(
  value: string | null | undefined,
): WaitingListPageSize {
  if (value == null || value === '') return WAITING_LIST_URL_DEFAULTS.pageSize;
  const n = Number.parseInt(value, 10);
  if (!PAGE_SIZE_SET.has(n)) return WAITING_LIST_URL_DEFAULTS.pageSize;
  return n as WaitingListPageSize;
}

export function parseWaitingListUrlState(
  params: URLSearchParams | { get: (key: string) => string | null },
): WaitingListUrlState {
  return {
    tab: parseWaitingListTabParam(params.get(WAITING_LIST_URL_PARAMS.tab)),
    type: parseWaitingListTypeParam(params.get(WAITING_LIST_URL_PARAMS.type)),
    owner: parseWaitingListOwnerParam(params.get(WAITING_LIST_URL_PARAMS.owner)),
    search: parseWaitingListSearchParam(params.get(WAITING_LIST_URL_PARAMS.search)),
    page: parseWaitingListPageParam(params.get(WAITING_LIST_URL_PARAMS.page)),
    pageSize: parseWaitingListPageSizeParam(
      params.get(WAITING_LIST_URL_PARAMS.pageSize),
    ),
  };
}

/**
 * Write view state into search params. Defaults are omitted (missing ≡ default).
 * Preserves unrelated params. Never writes ownership-mutation keys.
 */
export function applyWaitingListUrlState(
  current: URLSearchParams,
  state: WaitingListUrlState,
): URLSearchParams {
  const next = new URLSearchParams(current.toString());

  if (state.tab === WAITING_LIST_URL_DEFAULTS.tab) {
    next.delete(WAITING_LIST_URL_PARAMS.tab);
  } else {
    next.set(WAITING_LIST_URL_PARAMS.tab, state.tab);
  }

  if (state.type === WAITING_LIST_URL_DEFAULTS.type) {
    next.delete(WAITING_LIST_URL_PARAMS.type);
  } else {
    next.set(WAITING_LIST_URL_PARAMS.type, state.type);
  }

  if (state.owner === WAITING_LIST_URL_DEFAULTS.owner) {
    next.delete(WAITING_LIST_URL_PARAMS.owner);
  } else {
    next.set(WAITING_LIST_URL_PARAMS.owner, state.owner);
  }

  const q = state.search.trim();
  if (!q) {
    next.delete(WAITING_LIST_URL_PARAMS.search);
  } else {
    next.set(WAITING_LIST_URL_PARAMS.search, state.search);
  }

  if (state.page <= 1) {
    next.delete(WAITING_LIST_URL_PARAMS.page);
  } else {
    next.set(WAITING_LIST_URL_PARAMS.page, String(Math.floor(state.page)));
  }

  if (state.pageSize === WAITING_LIST_URL_DEFAULTS.pageSize) {
    next.delete(WAITING_LIST_URL_PARAMS.pageSize);
  } else {
    next.set(WAITING_LIST_URL_PARAMS.pageSize, String(state.pageSize));
  }

  return next;
}

/** Reset filter-related URL keys; page → 1. Preserves unrelated params. */
export function resetWaitingListUrlFilters(
  current: URLSearchParams,
): URLSearchParams {
  return applyWaitingListUrlState(current, {
    ...WAITING_LIST_URL_DEFAULTS,
    pageSize: parseWaitingListPageSizeParam(
      current.get(WAITING_LIST_URL_PARAMS.pageSize),
    ),
  });
}
