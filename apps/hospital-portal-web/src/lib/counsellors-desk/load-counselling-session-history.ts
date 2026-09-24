import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import { counsellingAzureApi, type PriceOverrideRecord } from '@/lib/api/counselling-azure.api';
import { requeueHistoryEntriesFromAdditionalNotes } from '@/lib/counsellors-desk/requeue-notes-presentation';
import type { SessionAuditEntry } from '@/types/counsellors-desk';

export async function loadCounsellingSessionHistory(
  sessionId: string,
  /** Raw AdditionalNotes (may include `[Re-queue …]` markers) for History presentation fallback. */
  additionalNotes?: string | null,
): Promise<SessionAuditEntry[]> {
  const [azureResult, authResult, overridesResult] = await Promise.allSettled([
    counsellingAzureApi.getHistory(sessionId),
    counsellorsDeskApi.getSessionHistory(sessionId),
    counsellingAzureApi.getPriceOverrides(sessionId),
  ]);

  const azureEntries = azureResult.status === 'fulfilled' ? azureResult.value : [];
  const authEntries = authResult.status === 'fulfilled' ? authResult.value : [];
  const priceOverrides: PriceOverrideRecord[] =
    overridesResult.status === 'fulfilled' ? overridesResult.value : [];

  const filtered = azureEntries.filter(
    (e) => e.changeType !== 'Lock' && e.changeType !== 'Unlock',
  );

  const azureFieldChangedSet = new Set(
    filtered
      .filter((e) => e.changeType === 'FieldChanged')
      .map(
        (e) =>
          `${e.fieldName}|${e.changedBy}|${Math.floor(new Date(e.changedAt).getTime() / 5000)}`,
      ),
  );

  const dedupedAuth = authEntries.filter((e) => {
    if (e.changeType !== 'FieldChanged') return true;
    const key = `${e.fieldName}|${e.changedBy}|${Math.floor(new Date(e.changedAt).getTime() / 5000)}`;
    return !azureFieldChangedSet.has(key);
  });

  const merged = [...filtered, ...dedupedAuth].sort(
    (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime(),
  );

  for (const entry of merged) {
    if (entry.changeType !== 'PriceOverride') continue;
    const entryTime = new Date(entry.changedAt).getTime();
    const match = priceOverrides.find((o) => {
      const diff = Math.abs(new Date(o.createdAt).getTime() - entryTime);
      return diff <= 10_000;
    });
    if (match) {
      entry.priceBaseAmount = match.basePrice;
      entry.priceOverriddenAmount = match.overriddenPrice;
      entry.priceVariantName = match.variantName;
      entry.priceReason = match.reason;
      entry.priceRequesterName = match.requestedByName ?? null;
    }
  }

  const consumed = new Set<string>();
  for (const entry of merged) {
    if (entry.changeType !== 'SaveCounselling') continue;
    const saveTime = new Date(entry.changedAt).getTime();
    const children = merged.filter(
      (e) =>
        e.changeType === 'FieldChanged' &&
        e.changedBy === entry.changedBy &&
        Math.abs(new Date(e.changedAt).getTime() - saveTime) <= 5_000 &&
        !consumed.has(e.id),
    );
    if (children.length > 0) {
      entry.children = children;
      children.forEach((c) => consumed.add(c.id));
    }
  }

  const withoutGrouped = merged.filter((e) => !consumed.has(e.id));

  // Prefer authoritative OwnershipRequeued History; fall back to AdditionalNotes markers only
  // when Auth did not emit a trail (already-unassigned ReQueue). Never invent Actor.
  const existingRequeueReasons = new Set(
    withoutGrouped
      .filter((e) => e.changeType === 'OwnershipRequeued')
      .map((e) => (e.reason || '').trim().toLowerCase())
      .filter(Boolean),
  );
  const noteRequeues = requeueHistoryEntriesFromAdditionalNotes(
    additionalNotes,
    existingRequeueReasons,
  );

  return [...withoutGrouped, ...noteRequeues].sort(
    (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
  );
}
