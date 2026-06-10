const STORAGE_KEY = 'counselling-recent-procedures';
const MAX_RECENT = 5;

export function loadRecentProcedureIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string').slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function recordRecentProcedurePick(variantId: string): void {
  if (typeof window === 'undefined' || !variantId) return;
  const prev = loadRecentProcedureIds().filter((id) => id !== variantId);
  const next = [variantId, ...prev].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}
