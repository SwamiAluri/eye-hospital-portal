'use client';

import { formatInr } from '@/lib/counsellors-desk/package-preview';
import { sanitizeVariantName } from '@/lib/utils/sanitize-names';
import { findCounsellorVariant, type CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import type { CounsellingPackageTemplate } from '@/types/counselling-estimate';
import {
  counsellingEyeLabel,
  type CounsellingEyeOption,
} from '@/lib/counsellors-desk/counselling-eye';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives';

export interface PricingModeStatusStripProps {
  isPackageMode: boolean;
  activeTemplate: CounsellingPackageTemplate | null;
  selectedVariantId: string | null;
  selectedEye: CounsellingEyeOption;
  procedureVariants: CounsellorProcedureVariant[];
  onSwitchToCustom?: () => void;
  onSwitchToPackage?: () => void;
}

/** Compact status bar shown after a procedure or package is selected. */
export function PricingModeStatusStrip({
  isPackageMode,
  activeTemplate,
  selectedVariantId,
  selectedEye,
  procedureVariants,
  onSwitchToCustom,
  onSwitchToPackage,
}: PricingModeStatusStripProps) {
  const variant = findCounsellorVariant(procedureVariants, selectedVariantId);

  if (isPackageMode && activeTemplate) {
    return (
      <div
        className={`flex flex-wrap items-center justify-between gap-2 ${counsellingSessionTokens.accentPanel}`}
      >
        <p className={`text-sm ${counsellingSessionTokens.accentText}`}>
          <span className="font-semibold">Package:</span> {activeTemplate.name}
          <span className="ml-2 tabular-nums font-bold">{formatInr(activeTemplate.packageAmount)}</span>
        </p>
        {onSwitchToCustom && (
          <CounsellingButton
            type="button"
            variant="ghost"
            size="sm"
            className={counsellingSessionTokens.primaryText}
            onClick={onSwitchToCustom}
          >
            View procedure
          </CounsellingButton>
        )}
      </div>
    );
  }

  if (variant) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-counselling-border bg-counselling-muted px-3 py-2">
        <p className="text-sm text-counselling-foreground">
          <span className="font-semibold">Procedure:</span> {sanitizeVariantName(variant.name)}
          <span className="ml-2 text-counselling-muted-foreground">{counsellingEyeLabel(selectedEye)}</span>
          <span className={`ml-2 tabular-nums font-semibold ${counsellingSessionTokens.primaryText}`}>
            {formatInr(variant.price)}
          </span>
        </p>
        {onSwitchToPackage && (
          <CounsellingButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSwitchToPackage}
          >
            Browse packages
          </CounsellingButton>
        )}
      </div>
    );
  }

  return null;
}
