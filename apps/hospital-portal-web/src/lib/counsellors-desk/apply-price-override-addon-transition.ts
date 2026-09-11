import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import { counsellingAzureApi } from '@/lib/api/counselling-azure.api';
import { buildQueueTransitionFailureMessage } from '@/lib/counsellors-desk/save-counselling-session';

/**
 * PO-01 — Price Override (Done session, procedure) → Add-On Surgery queue transition.
 *
 * REQUIRED: Auth `markAddOnSurgery` (Waiting List / CounselorQueue status).
 * OPTIONAL: Azure `addOnSurgery` (best-effort / offline-safe, same as CS-01 save path).
 *
 * Callers must not set local queue status or show Add-On success until this resolves.
 */
export async function applyPriceOverrideAddOnTransition(
  sessionId: string,
  reason: string,
): Promise<void> {
  try {
    await counsellorsDeskApi.markAddOnSurgery(sessionId);
  } catch (err) {
    throw new Error(buildQueueTransitionFailureMessage(err, 'addon'));
  }

  // Best-effort secondary sync — do not await as a success gate (Azure wrapper swallows errors).
  counsellingAzureApi.addOnSurgery(sessionId, reason);
}
