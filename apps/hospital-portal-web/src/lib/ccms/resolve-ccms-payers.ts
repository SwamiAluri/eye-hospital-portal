import type { MasterOption } from '@/hooks/use-master-values';
import type { InsurancePayer } from '@/lib/api/ccms/ccms-master-data.api';

/** Master `insurance.provider` option joined to its CCMS payer row (by provider_code). */
export interface AlignedCcmsPayer {
  /** Master `insurance.provider` code */
  providerCode: string;
  /** Display label from master */
  name: string;
  /** CCMS row UUID — used as `insuranceProviderId` in CCMS APIs */
  ccmsId: string | null;
  ccmsPayer: InsurancePayer | null;
  /** True when a CCMS payer row exists for this master code */
  selectable: boolean;
}

function payerCode(p: InsurancePayer): string | undefined {
  return p.providerCode ?? p.shortCode;
}

/**
 * Align master insurance providers with CCMS payer records.
 * Dropdown labels come from master; values resolve to CCMS UUIDs.
 */
export function resolveCcmsPayers(
  masterOptions: MasterOption[],
  ccmsPayers: InsurancePayer[],
): AlignedCcmsPayer[] {
  const byCode = new Map<string, InsurancePayer>();
  for (const p of ccmsPayers) {
    const code = payerCode(p);
    if (code) byCode.set(code.toUpperCase(), p);
  }

  return masterOptions.map((m) => {
    const ccms = byCode.get(m.value.toUpperCase()) ?? null;
    return {
      providerCode: m.value,
      name: m.label,
      ccmsId: ccms?.id ?? null,
      ccmsPayer: ccms,
      selectable: ccms != null,
    };
  });
}

/** Payers that can be selected in CCMS forms (master code has a CCMS row). */
export function selectableAlignedPayers(aligned: AlignedCcmsPayer[]): AlignedCcmsPayer[] {
  return aligned.filter((a) => a.selectable);
}

export function findAlignedPayerByCcmsId(
  aligned: AlignedCcmsPayer[],
  ccmsId: string,
): AlignedCcmsPayer | null {
  return aligned.find((a) => a.ccmsId === ccmsId) ?? null;
}

export function findCcmsPayerIdForMasterCode(
  aligned: AlignedCcmsPayer[],
  masterCode: string,
): string | null {
  return aligned.find((a) => a.providerCode === masterCode)?.ccmsId ?? null;
}
