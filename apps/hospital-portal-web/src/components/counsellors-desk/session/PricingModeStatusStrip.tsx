'use client';

import { formatInr } from '@/lib/counsellors-desk/package-preview';
import { sanitizeVariantName } from '@/lib/utils/sanitize-names';
import { findCounsellorVariant, type CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import type { CounsellingPackageTemplate } from '@/types/counselling-estimate';
import type { CounsellingEyeOption } from '@/lib/counsellors-desk/counselling-eye';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives';
import { CounsellingEyeBadge } from '@/components/counsellors-desk/session/CounsellingEyeBadge';

export interface PricingModeStatusStripProps {
  isPackageMode: boolean;
  activeTemplate: CounsellingPackageTemplate | null;
  selectedVariantId: string | null;
  selectedEye: CounsellingEyeOption;
  procedureVariants: CounsellorProcedureVariant[];
  onSwitchToCustom?: () => void;
  onSwitchToPackage?: () => void;
  onClear?: () => void;
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
  onClear,
}: PricingModeStatusStripProps) {
  const variant = findCounsellorVariant(procedureVariants, selectedVariantId);

  if (isPackageMode && activeTemplate) {
    return (
      <div
        className={`flex flex-wrap items-center justify-between gap-2 ${counsellingSessionTokens.accentPanel}`}
        data-testid={counsellingTestIds.quoteSelectedPackage}
      >
        <p className={`flex flex-wrap items-center gap-2 text-sm ${counsellingSessionTokens.accentText}`}>
          <span className="font-semibold">Package:</span>
          <span>{activeTemplate.name}</span>
          <CounsellingEyeBadge eye={selectedEye} data-testid={counsellingTestIds.quoteSelectedEyeBadge} />
          {/* Catalog amount only — overridden price is shown on Estimate */}
          <span className="tabular-nums font-bold">{formatInr(activeTemplate.packageAmount)}</span>
        </p>
        <div className="flex items-center gap-1">
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
          {onClear ? (
            <CounsellingButton type="button" variant="ghost" size="sm" onClick={onClear}>
              Clear
            </CounsellingButton>
          ) : null}
        </div>
      </div>
    );
  }

  if (variant) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-counselling-border bg-counselling-muted px-3 py-2">
        <p className="flex flex-wrap items-center gap-2 text-sm text-counselling-foreground">
          <span className="font-semibold">Procedure:</span>
          <span>{sanitizeVariantName(variant.name)}</span>
          <CounsellingEyeBadge eye={selectedEye} data-testid={counsellingTestIds.quoteSelectedEyeBadge} />
          <span className={`tabular-nums font-semibold ${counsellingSessionTokens.primaryText}`}>
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
