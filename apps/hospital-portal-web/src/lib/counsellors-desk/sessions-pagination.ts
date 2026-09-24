/**
 * Phase 3I Slice 13 Package B — Sessions list pagination helpers
 * (PD-S13-PAG-01 / PD-S13-PAG-02).
 *
 * Server-side pagination only — do not client-slice Sessions rows.
 */

export const SESSIONS_PAGE_SIZE = 20;

export const SESSIONS_PAGE_QUERY_PARAM = 'page';

/** Missing / invalid / non-positive → page 1. */
export function parseSessionsPageParam(value: string | null | undefined): number {
  if (value == null || value === '') return 1;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

/**
 * Update `page` in search params. Page 1 omits the param (missing ≡ 1).
 * Preserves all other params (including reassignmentRequired).
 */
export function setSessionsPageInSearchParams(
  current: URLSearchParams,
  page: number,
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  const safe = page < 1 ? 1 : Math.floor(page);
  if (safe <= 1) {
    next.delete(SESSIONS_PAGE_QUERY_PARAM);
  } else {
    next.set(SESSIONS_PAGE_QUERY_PARAM, String(safe));
  }
  return next;
}

/** Clamp requested page into [1, totalPages], treating empty lists as page 1. */
export function clampSessionsPage(page: number, totalPages: number): number {
  const safeTotal = Math.max(1, totalPages);
  if (!Number.isFinite(page) || page < 1) return 1;
  if (page > safeTotal) return safeTotal;
  return page;
}
