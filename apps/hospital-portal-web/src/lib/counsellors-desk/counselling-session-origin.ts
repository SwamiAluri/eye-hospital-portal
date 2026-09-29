/**
 * Origin-aware Close navigation for counselling sessions.
 * Close is navigation-only — never completes/cancels/lifecycle-mutates.
 */

export const COUNSELLING_SESSION_ORIGIN = {
  WaitingList: 'waiting-list',
  FollowUp: 'follow-up',
  Finalize: 'finalize',
  Analytics: 'analytics',
  Sessions: 'sessions',
} as const;

const SESSIONS_LIST_PATH = '/dashboard/counsellors-desk/sessions';

/** List query keys that may round-trip through Open → Close. Not a free-form return URL. */
const SESSIONS_RETURN_KEYS = [
  'branchId',
  'counselorId',
  'sessionDateFrom',
  'sessionDateTo',
  'pendingDecision',
  'patientAgreedToSurgery',
  'recommendedSurgery',
  'analyticsOutcome',
  'agingBucket',
  'reassignmentRequired',
  'page',
] as const;

export type CounsellingSessionOrigin =
  (typeof COUNSELLING_SESSION_ORIGIN)[keyof typeof COUNSELLING_SESSION_ORIGIN];

const ORIGIN_ROUTES: Record<CounsellingSessionOrigin, string> = {
  [COUNSELLING_SESSION_ORIGIN.WaitingList]: '/dashboard/counsellors-desk/waiting-list',
  [COUNSELLING_SESSION_ORIGIN.FollowUp]: '/dashboard/counsellors-desk/surgery-followup',
  [COUNSELLING_SESSION_ORIGIN.Finalize]: '/dashboard/counsellors-desk/finalize-surgery',
  [COUNSELLING_SESSION_ORIGIN.Analytics]: '/dashboard/counselor/analytics',
  [COUNSELLING_SESSION_ORIGIN.Sessions]: SESSIONS_LIST_PATH,
};

const FALLBACK_ORIGIN_ROUTE = ORIGIN_ROUTES[COUNSELLING_SESSION_ORIGIN.WaitingList];

const VALID_ORIGINS = new Set<string>(Object.values(COUNSELLING_SESSION_ORIGIN));

export function parseCounsellingSessionOrigin(
  raw: string | null | undefined,
): CounsellingSessionOrigin | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!VALID_ORIGINS.has(trimmed)) return null;
  return trimmed as CounsellingSessionOrigin;
}

/**
 * Keep only sessions-list parameters. Reject absolute URLs and path values.
 * Other origins ignore this string so a tampered query cannot leave the certified route.
 */
export function sanitizeSessionsReturnQuery(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes('://') || trimmed.startsWith('/') || trimmed.startsWith('\\')) {
    return '';
  }
  const params = new URLSearchParams(trimmed);
  const next = new URLSearchParams();
  for (const key of SESSIONS_RETURN_KEYS) {
    const value = params.get(key);
    if (value != null && value !== '') next.set(key, value);
  }
  return next.toString();
}

/** Resolve Close destination. Invalid/missing → Waiting List. */
export function resolveCounsellingSessionCloseHref(
  rawFrom: string | null | undefined,
  returnQuery?: string | null,
): string {
  const origin = parseCounsellingSessionOrigin(rawFrom);
  if (!origin) return FALLBACK_ORIGIN_ROUTE;
  if (origin !== COUNSELLING_SESSION_ORIGIN.Sessions) return ORIGIN_ROUTES[origin];
  const safe = sanitizeSessionsReturnQuery(returnQuery);
  return safe ? `${SESSIONS_LIST_PATH}?${safe}` : SESSIONS_LIST_PATH;
}

/** Open a session from the register and carry the current list query back on Close. */
export function buildSessionsOpenHref(sessionId: string, listSearch: string): string {
  const params = new URLSearchParams();
  params.set('from', COUNSELLING_SESSION_ORIGIN.Sessions);
  const trimmed = listSearch.replace(/^\?/, '').trim();
  if (trimmed) params.set('returnQuery', trimmed);
  return `/dashboard/counsellors-desk/${sessionId}?${params.toString()}`;
}

/**
 * Footer leave-control presentation for origin-aware exit.
 * Always uses existing Close semantics (dirty Save & Close / leave) —
 * presentation only. When from Waiting List and phase-back is not shown,
 * label as Back so the first counselling phase has an explicit return path.
 */
export interface CounsellingSessionLeaveControl {
  label: string;
  ariaLabel: string;
  showChevron: boolean;
  /** Always true — leave must call handleClose, never lifecycle/ownership. */
  usesCloseSemantics: true;
}

export function resolveCounsellingSessionLeaveControl(input: {
  from: string | null | undefined;
  showPhaseBack: boolean;
}): CounsellingSessionLeaveControl {
  const origin = parseCounsellingSessionOrigin(input.from);
  const fromWaitingList = origin === COUNSELLING_SESSION_ORIGIN.WaitingList;

  if (fromWaitingList && !input.showPhaseBack) {
    return {
      label: 'Back',
      ariaLabel: 'Back to Waiting List',
      showChevron: true,
      usesCloseSemantics: true,
    };
  }

  return {
    label: 'Close',
    ariaLabel: 'Close',
    showChevron: false,
    usesCloseSemantics: true,
  };
}

/** Build session open URL with origin query (preserves other params). */
export function buildCounsellingSessionHref(
  sessionId: string,
  from: CounsellingSessionOrigin,
  extraParams?: Record<string, string>,
): string {
  const params = new URLSearchParams({ from, ...extraParams });
  return `/dashboard/counsellors-desk/${sessionId}?${params.toString()}`;
}
