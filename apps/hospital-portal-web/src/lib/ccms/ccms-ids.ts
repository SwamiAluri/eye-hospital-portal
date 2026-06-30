import type { AlignedCcmsPayer } from '@/lib/ccms/resolve-ccms-payers';
import { findCcmsPayerIdForMasterCode } from '@/lib/ccms/resolve-ccms-payers';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when value is a CCMS/API GUID (not a master provider code like HDFC_ERGO). */
export function isCcmsUuid(value?: string | null): boolean {
  if (!value?.trim()) return false;
  return UUID_RE.test(value.trim());
}

/** Resolve master provider code or CCMS UUID → CCMS payer UUID for API payloads. */
export function resolveCcmsProviderUuid(
  value: string | undefined,
  aligned: AlignedCcmsPayer[],
): string | undefined {
  if (!value?.trim()) return undefined;
  const trimmed = value.trim();
  if (isCcmsUuid(trimmed)) return trimmed;
  return findCcmsPayerIdForMasterCode(aligned, trimmed) ?? undefined;
}
