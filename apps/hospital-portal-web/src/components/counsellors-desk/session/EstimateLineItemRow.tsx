'use client';

import { memo } from 'react';
import { Pencil } from 'lucide-react';
import type { EstimateLine } from '@/lib/counsellors-desk/estimate-engine';
import { formatInr, hasQuotedProcedureOverride } from '@/lib/counsellors-desk/package-preview';
import { sanitizeVariantName } from '@/lib/utils/sanitize-names';
import type { CounsellingEyeOption } from '@/lib/counsellors-desk/counselling-eye';
import { counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { CounsellingBadge, CounsellingButton } from '@/components/counsellors-desk/session/primitives';
import { CounsellingEyeBadge } from '@/components/counsellors-desk/session/CounsellingEyeBadge';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';

const KIND_LABEL: Record<EstimateLine['kind'], string> = {
  procedure: 'Procedure',
  iol: 'Lens / IOL',
  investigation: 'Investigation',
};

export interface EstimateLineItemRowProps {
  line: EstimateLine;
  catalogAmount?: number;
  showInternalPricing?: boolean;
  showKindBadge?: boolean;
  /** Unit pricing hint e.g. "per eye" — eye badge shown separately via `eye` */
  eyePricingLabel?: string;
  eye?: CounsellingEyeOption;
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
  eye,
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

  const showEyeRow = line.kind === 'procedure' && (eye || eyePricingLabel);

  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-0.5 text-sm ${className}`.trim()}
    >
      <div className="min-w-0">
        {showEyeRow ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-counselling-foreground">{displayLabel}</span>
            {eye ? (
              <CounsellingEyeBadge
                eye={eye}
                data-testid={counsellingTestIds.quoteEstimateEyeBadge}
              />
            ) : null}
            {eyePricingLabel ? (
              <span className="text-xs text-counselling-muted-foreground">{eyePricingLabel}</span>
            ) : null}
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
              <span className="text-[10px] text-counselling-muted-foreground/80">Lens / IOL</span>
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
      <div className="flex shrink-0 items-center justify-end gap-1 self-start">
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
        <span className="text-right font-semibold tabular-nums text-counselling-foreground">
          {line.kind === 'iol' && line.amount <= 0
            ? counsellingCopy.included
            : formatInr(line.amount)}
        </span>
      </div>
    </div>
  );
});
