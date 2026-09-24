/**
 * Phase 3I — refresh CounselingSession.Version after known system writers
 * (e.g. CCMS Auth callback on coverage create/draft) without discarding dirty form fields.
 */
import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';

export async function fetchCounsellingSessionVersion(
  sessionId: string,
): Promise<number | undefined> {
  const fresh = await counsellorsDeskApi.getSession(sessionId, { skipCatalogFallback: true });
  return typeof fresh.version === 'number' ? fresh.version : undefined;
}

/**
 * When a 409 is caused by an out-of-band Version bump (same counsellor, Insurance/CCMS callback),
 * one retry with the authoritative Version is allowed. Never retry when Version did not advance.
 */
export function shouldRetryDraftSaveAfterVersionSync(options: {
  requestVersion: number | undefined;
  freshVersion: number | undefined;
}): boolean {
  if (typeof options.freshVersion !== 'number') return false;
  if (typeof options.requestVersion !== 'number') return typeof options.freshVersion === 'number';
  return options.freshVersion !== options.requestVersion;
}
