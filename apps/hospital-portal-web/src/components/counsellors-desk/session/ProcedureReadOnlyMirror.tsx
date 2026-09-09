'use client';

import type { IolMasterDto } from '@/lib/api/service-catalog.api';
import { priceSuffix } from '@/lib/api/service-catalog.api';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { sanitizeVariantName } from '@/lib/utils/sanitize-names';
import { findCounsellorVariant, type CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import { formatInr } from '@/lib/counsellors-desk/package-preview';
import type { CounsellingPackageTemplate } from '@/types/counselling-estimate';
import { type CounsellingEyeOption } from '@/lib/counsellors-desk/counselling-eye';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives';
import { CounsellingEyeBadge } from '@/components/counsellors-desk/session/CounsellingEyeBadge';

export interface ProcedureReadOnlyMirrorProps {
  procedureVariants: CounsellorProcedureVariant[];
  selectedVariantId: string | null;
  selectedEye: CounsellingEyeOption;
  variantSubOption: string | null;
  selectedIolId: string | null;
  iolOptions: IolMasterDto[];
  activeTemplate: CounsellingPackageTemplate | null;
  isReadOnly: boolean;
  onSwitchToCustom: () => void;
}

export function ProcedureReadOnlyMirror({
  procedureVariants,
  selectedVariantId,
  selectedEye,
  variantSubOption,
  selectedIolId,
  iolOptions,
  activeTemplate,
  isReadOnly,
  onSwitchToCustom,
}: ProcedureReadOnlyMirrorProps) {
  const variant = findCounsellorVariant(procedureVariants, selectedVariantId);
  const iol = iolOptions.find((i) => i.id === selectedIolId) ?? null;
  const eyeForVariant =
    variant?.priceType === 'BOTH_EYES' ? ('BE' as CounsellingEyeOption) : selectedEye;

  return (
    <div className="space-y-3">
      <p className="text-xs text-counselling-muted-foreground">
        Package pricing is active. Procedure details are read-only.
      </p>

      {variant ? (
        <div data-testid={counsellingTestIds.quoteSelectedProcedure}>
          <p className={counsellingSessionTokens.quoteSelectedProcedureLabel}>Selected procedure</p>
          <div className={counsellingSessionTokens.quoteSelectedProcedureBox}>
            <div className={counsellingSessionTokens.quoteSelectedProcedureRow}>
              <div className={counsellingSessionTokens.quoteSelectedProcedureMain}>
                <p className={`flex flex-wrap items-center gap-2 ${counsellingSessionTokens.quoteSelectedProcedureName}`}>
                  {sanitizeVariantName(variant.name)}
                  <CounsellingEyeBadge
                    eye={eyeForVariant}
                    data-testid={counsellingTestIds.quoteSelectedEyeBadge}
                  />
                </p>
                {variantSubOption ? (
                  <p className="mt-0.5 text-xs text-counselling-muted-foreground">
                    Lens / sub-type: <span className="font-medium">{variantSubOption}</span>
                  </p>
                ) : null}
                {iol ? (
                  <p className="mt-0.5 text-xs text-counselling-muted-foreground">
                    Lens: {iol.modelName} · {formatInr(iol.price)}
                  </p>
                ) : null}
              </div>
              <p className={counsellingSessionTokens.quoteSelectedProcedurePrice}>
                {formatInr(variant.price)}
                <span className={counsellingSessionTokens.quoteSelectedProcedureMeta}>
                  {priceSuffix(variant.priceType)}
                </span>
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-counselling-muted-foreground">No procedure linked to this package yet.</p>
      )}

      {activeTemplate ? (
        <p className="text-xs text-counselling-primary">
          Package: <span className="font-semibold">{activeTemplate.name}</span> ·{' '}
          {formatInr(activeTemplate.packageAmount)}
        </p>
      ) : null}

      {!isReadOnly ? (
        <CounsellingButton
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={onSwitchToCustom}
        >
          Switch to custom pricing
        </CounsellingButton>
      ) : null}
    </div>
  );
}
