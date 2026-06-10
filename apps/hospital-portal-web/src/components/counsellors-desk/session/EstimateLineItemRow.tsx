'use client';

import { memo } from 'react';
import { Pencil } from 'lucide-react';
import type { EstimateLine } from '@/lib/counsellors-desk/estimate-engine';
import { formatInr, hasQuotedProcedureOverride } from '@/lib/counsellors-desk/package-preview';
import { sanitizeVariantName } from '@/lib/utils/sanitize-names';
import { CounsellingBadge, CounsellingButton } from '@/components/counsellors-desk/session/primitives';

const KIND_LABEL: Record<EstimateLine['kind'], string> = {
  procedure: 'Procedure',
  iol: 'IOL',
  investigation: 'Investigation',
};

export interface EstimateLineItemRowProps {
  line: EstimateLine;
  catalogAmount?: number;
  showInternalPricing?: boolean;
  showKindBadge?: boolean;
  /** e.g. "RE · per eye" — shown bold beside procedure name */
  eyePricingLabel?: string;
  /** Hide Lab/Imaging/Scan type subtitle when lines are grouped by section */
  hideTypeDetail?: boolean;
  onEditPrice?: () => void;
  isReadOnly?: boolean;
  className?: string;
}

export const EstimateLineItemRow = memo(function EstimateLineItemRow({
  line,
  catalogAmount,
  showInternalPricing = false,
  showKindBadge = false,
  eyePricingLabel,
  hideTypeDetail = false,
  onEditPrice,
  isReadOnly = false,
  className = '',
}: EstimateLineItemRowProps) {
  const isAdjusted =
    showInternalPricing &&
    line.kind === 'procedure' &&
    hasQuotedProcedureOverride(catalogAmount ?? 0, line.amount);

  const displayLabel = sanitizeVariantName(line.label);

  const subline =
    line.kind === 'iol' && line.detail
      ? sanitizeVariantName(line.detail)
      : line.kind === 'investigation' && line.detail && !hideTypeDetail
        ? line.detail
        : undefined;

  return (
    <div className={`flex items-start justify-between gap-2 text-sm ${className}`.trim()}>
      <div className="min-w-0 flex-1">
        {line.kind === 'procedure' && eyePricingLabel ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-counselling-foreground">{displayLabel}</span>
            <span className="text-sm font-bold text-counselling-foreground">{eyePricingLabel}</span>
            {isAdjusted && (
              <CounsellingBadge
                variant="outline"
                className="border-amber-200 bg-amber-50 text-[9px] text-amber-800"
              >
                Price adjusted
              </CounsellingBadge>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-counselling-foreground">{displayLabel}</span>
            {showKindBadge && (
              <span className="text-[10px] text-counselling-muted-foreground/80">{KIND_LABEL[line.kind]}</span>
            )}
            {line.kind === 'iol' && !showKindBadge && (
              <span className="text-[10px] text-counselling-muted-foreground/80">IOL</span>
            )}
            {isAdjusted && (
              <CounsellingBadge
                variant="outline"
                className="border-amber-200 bg-amber-50 text-[9px] text-amber-800"
              >
                Price adjusted
              </CounsellingBadge>
            )}
          </div>
        )}
        {subline && (
          <span className="block text-[10px] text-counselling-muted-foreground/80">{subline}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {line.kind === 'procedure' && onEditPrice && !isReadOnly && (
          <CounsellingButton
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-amber-700 hover:bg-amber-50"
            onClick={onEditPrice}
            title="Modify quoted price"
            data-testid="counselling-quote-line-edit-price"
          >
            <Pencil size={12} />
          </CounsellingButton>
        )}
        <span className="font-semibold tabular-nums text-counselling-foreground">
          {formatInr(line.amount)}
        </span>
      </div>
    </div>
  );
});
