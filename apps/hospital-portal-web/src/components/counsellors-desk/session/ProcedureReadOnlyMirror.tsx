'use client';

import type { IolMasterDto } from '@/lib/api/service-catalog.api';
import { priceSuffix } from '@/lib/api/service-catalog.api';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { sanitizeVariantName } from '@/lib/utils/sanitize-names';
import { findCounsellorVariant, type CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import { formatInr } from '@/lib/counsellors-desk/package-preview';
import type { CounsellingPackageTemplate } from '@/types/counselling-estimate';
import {
  counsellingEyeBadgeClass,
  counsellingEyeLabel,
  type CounsellingEyeOption,
} from '@/lib/counsellors-desk/counselling-eye';
import {
  CounsellingBadge,
  CounsellingButton,
  CounsellingCard,
  CounsellingCardContent,
  CounsellingInfoAlert,
} from '@/components/counsellors-desk/session/primitives';

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
    <CounsellingCard className={counsellingSessionTokens.readOnlyPanel}>
      <CounsellingCardContent className="space-y-4 pt-4">
        <CounsellingInfoAlert variant="info" title="Included in package">
          Package pricing is active. Procedure details are read-only.
        </CounsellingInfoAlert>

      {variant ? (
        <div className="space-y-3 rounded-lg border border-counselling-border/80 bg-counselling-card p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-counselling-foreground">
                {sanitizeVariantName(variant.name)}
              </p>
              <p className="text-xs text-counselling-muted-foreground">{variant.categoryName}</p>
            </div>
            <CounsellingBadge className={counsellingEyeBadgeClass(eyeForVariant)}>
              {counsellingEyeLabel(eyeForVariant)}
            </CounsellingBadge>
          </div>

          <p className="text-xs text-counselling-muted-foreground">
            Reference {formatInr(variant.price)}
            {priceSuffix(variant.priceType)}
          </p>

          {variantSubOption ? (
            <p className="text-xs text-counselling-muted-foreground">
              Sub-type: <span className="font-medium">{variantSubOption}</span>
            </p>
          ) : null}

          {iol ? (
            <div className="border-t border-counselling-border/60 pt-2">
              <p className="text-xs font-medium text-counselling-foreground">IOL / lens</p>
              <p className="text-sm text-counselling-foreground">{iol.modelName}</p>
              <p className="text-xs text-counselling-muted-foreground">
                {iol.brandManufacturer} · {formatInr(iol.price)}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-counselling-muted-foreground">No procedure linked to this package yet.</p>
      )}

      {activeTemplate ? (
        <p className="mt-3 text-xs text-counselling-primary">
          Package: <span className="font-semibold">{activeTemplate.name}</span> ·{' '}
          {formatInr(activeTemplate.packageAmount)}
        </p>
      ) : null}

      {!isReadOnly ? (
        <CounsellingButton
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={onSwitchToCustom}
        >
          Switch to custom pricing
        </CounsellingButton>
      ) : null}
      </CounsellingCardContent>
    </CounsellingCard>
  );
}
