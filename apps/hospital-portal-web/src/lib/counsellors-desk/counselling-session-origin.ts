/**
 * Origin-aware Close navigation for counselling sessions.
 * Close is navigation-only — never completes/cancels/lifecycle-mutates.
 */

export const COUNSELLING_SESSION_ORIGIN = {
  WaitingList: 'waiting-list',
  FollowUp: 'follow-up',
  Finalize: 'finalize',
  Analytics: 'analytics',
} as const;

export type CounsellingSessionOrigin =
  (typeof COUNSELLING_SESSION_ORIGIN)[keyof typeof COUNSELLING_SESSION_ORIGIN];

const ORIGIN_ROUTES: Record<CounsellingSessionOrigin, string> = {
  [COUNSELLING_SESSION_ORIGIN.WaitingList]: '/dashboard/counsellors-desk/waiting-list',
  [COUNSELLING_SESSION_ORIGIN.FollowUp]: '/dashboard/counsellors-desk/surgery-followup',
  [COUNSELLING_SESSION_ORIGIN.Finalize]: '/dashboard/counsellors-desk/finalize-surgery',
  [COUNSELLING_SESSION_ORIGIN.Analytics]: '/dashboard/counselor/analytics',
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

/** Resolve Close destination. Invalid/missing → Waiting List. */
export function resolveCounsellingSessionCloseHref(
  rawFrom: string | null | undefined,
): string {
  const origin = parseCounsellingSessionOrigin(rawFrom);
  if (!origin) return FALLBACK_ORIGIN_ROUTE;
  return ORIGIN_ROUTES[origin];
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
