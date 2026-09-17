'use client';



import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import type { UseCounsellingEstimateResult } from '@/hooks/use-counselling-estimate';
import type { CounsellingDiscountType } from '@/types/counselling-estimate';
import {
  formatInr,
  hasQuotedProcedureOverride,
  resolveProcedureOverride,
} from '@/lib/counsellors-desk/package-preview';
import { addCalendarDays, formatValidityEn } from '@/lib/counsellors-desk/counselling-estimate-pdf-content';
import type { CounsellingPhase } from '@/lib/counsellors-desk/counselling-progress';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import type { CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import type { PriceOverrideRecord } from '@/lib/api/counselling-azure.api';
import { priceSuffix } from '@/lib/api/service-catalog.api';
import { type CounsellingEyeOption } from '@/lib/counsellors-desk/counselling-eye';
import { groupEstimateLinesForDisplay } from '@/lib/counsellors-desk/estimate-engine';
import { sanitizeVariantName } from '@/lib/utils/sanitize-names';
import {
  buildCommittedDiscountPatch,
  canCommitDiscountDraft,
} from '@/lib/counsellors-desk/counselling-discount-contract';
import {
  CounsellingBadge,
  CounsellingButton,
  CounsellingEmptyState,
} from '@/components/counsellors-desk/session/primitives';
import { EstimateLineItemRow } from '@/components/counsellors-desk/session/EstimateLineItemRow';
import { QuoteDiscountPanel } from '@/components/counsellors-desk/session/QuoteDiscountPanel';
import { CounsellingEyeBadge } from '@/components/counsellors-desk/session/CounsellingEyeBadge';



export interface CounsellingQuoteSummaryProps {

  estimate: UseCounsellingEstimateResult;

  estimateDiscountType: CounsellingDiscountType | null;

  estimateDiscountValue: number;

  estimateDiscountReason: string;

  selectedVariant: CounsellorProcedureVariant | null;

  selectedEye?: CounsellingEyeOption;

  savedOverrides: PriceOverrideRecord[];

  isReadOnly: boolean;

  onOpenOverride?: () => void;

  /** Opens package amount override dialog (package mode only). */
  onOpenPackageOverride?: () => void;

  activePhase?: CounsellingPhase;

}



const QuoteModeLabel = memo(function QuoteModeLabel({
  estimateMode,
  activeTemplate,
  selectedVariant,
}: {
  estimateMode: 'custom' | 'package';
  activeTemplate: UseCounsellingEstimateResult['activeTemplate'];
  selectedVariant: CounsellorProcedureVariant | null;
}) {
  const isPackage = estimateMode === 'package';
  const label = isPackage
    ? activeTemplate
      ? `Package · ${activeTemplate.name}`
      : 'Package'
    : selectedVariant
      ? counsellingCopy.customEstimate
      : 'Custom estimate';

  return (
    <p className={counsellingSessionTokens.quoteSummaryMode} data-testid={counsellingTestIds.quoteModeBadge}>
      {label}
    </p>
  );
});



function useDiscountDraft(
  estimate: UseCounsellingEstimateResult,
  estimateDiscountType: CounsellingDiscountType | null,
  estimateDiscountValue: number,
  estimateDiscountReason: string,
) {
  const [draftType, setDraftType] = useState<CounsellingDiscountType | null>(estimateDiscountType);
  const [draftValue, setDraftValue] = useState(String(estimateDiscountValue || ''));
  const [draftReason, setDraftReason] = useState(estimateDiscountReason);

  useEffect(() => {
    setDraftType(estimateDiscountType);
    setDraftValue(String(estimateDiscountValue || ''));
    setDraftReason(estimateDiscountReason);
  }, [estimateDiscountType, estimateDiscountValue, estimateDiscountReason]);

  const applyDiscount = useCallback(() => {
    if (!draftType) {
      estimate.setDiscount({ discountType: null, discountValue: 0, discountReason: '' });
      return;
    }
    const patch = buildCommittedDiscountPatch({
      draftType,
      draftValue,
      draftReason,
    });
    if (!patch) return;
    estimate.setDiscount(patch);
  }, [draftReason, draftType, draftValue, estimate]);

  /** Keep canonical estimate.discountReason in sync with the visible reason field. */
  const updateDraftReason = useCallback(
    (next: string) => {
      setDraftReason(next);
      const hasApplied =
        !!estimateDiscountType && estimateDiscountValue > 0;
      if (hasApplied) {
        estimate.setDiscount({
          discountType: estimateDiscountType,
          discountValue: estimateDiscountValue,
          discountReason: next,
        });
      }
    },
    [estimate, estimateDiscountType, estimateDiscountValue],
  );

  const canApply = canCommitDiscountDraft({
    draftType,
    draftValue,
    draftReason,
  });

  return {
    draftType,
    setDraftType,
    draftValue,
    setDraftValue,
    draftReason,
    setDraftReason: updateDraftReason,
    applyDiscount,
    canApply,
  };
}



function procedureEyeUnitLabel(
  eyeCode: string | undefined,
  variant: CounsellorProcedureVariant | null,
): { eye: CounsellingEyeOption; unit?: string } | null {
  if (!variant) return null;
  const eye = (eyeCode as CounsellingEyeOption) ?? 'RE';
  const suffix = priceSuffix(variant.priceType);
  const unit = suffix === '/eye' ? 'per eye' : suffix === '/both eyes' ? 'both eyes' : undefined;
  return { eye, unit };
}

function QuoteLineSection({
  title,
  lines,
  children,
}: {
  title: string;

  lines: { key: string }[];

  children: ReactNode;

}) {

  if (lines.length === 0) return null;

  return (

    <div>

      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground">

        {title}

      </p>

      <div className="space-y-1.5">{children}</div>

    </div>

  );

}



export const CounsellingQuoteSummary = memo(function CounsellingQuoteSummary({

  estimate,

  estimateDiscountType,

  estimateDiscountValue,

  estimateDiscountReason,

  selectedVariant,

  selectedEye = 'RE',

  savedOverrides,

  isReadOnly,

  onOpenOverride,

  onOpenPackageOverride,

}: CounsellingQuoteSummaryProps) {

  const hasLines = estimate.lines.length > 0;

  const hasPendingProcedure = !hasLines && !!selectedVariant;

  const activeOverride = resolveProcedureOverride(savedOverrides, selectedVariant?.id);

  const estimateMode = estimate.mergedEstimate.estimateMode;

  const isPackage = estimateMode === 'package' && !!estimate.activeTemplate;



  const groupedLines = useMemo(

    () => groupEstimateLinesForDisplay(estimate.lines),

    [estimate.lines],

  );



  const procedureLines = useMemo(
    () => groupedLines.procedurePackage.filter((l) => l.kind === 'procedure'),
    [groupedLines.procedurePackage],
  );

  const iolLines = useMemo(
    () => groupedLines.procedurePackage.filter((l) => l.kind === 'iol'),
    [groupedLines.procedurePackage],
  );

  const procedureSectionTitle = isPackage ? counsellingCopy.package : counsellingCopy.procedure;

  const {
    draftType,
    setDraftType,
    draftValue,
    setDraftValue,
    draftReason,
    setDraftReason,
    applyDiscount,
    canApply,
  } = useDiscountDraft(
    estimate,
    estimateDiscountType,
    estimateDiscountValue,
    estimateDiscountReason,
  );

  const finalPayableBlock = (
    <div className={counsellingSessionTokens.quoteHeroPayable} data-testid={counsellingTestIds.quoteFinalPayable}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground">
        {counsellingCopy.finalPayable}
      </p>
      <p className={`${counsellingSessionTokens.quoteFinalPayableAmount} mt-1`}>
        {formatInr(estimate.finalPayableAmount)}
      </p>
      <QuoteModeLabel
        estimateMode={estimateMode}
        activeTemplate={estimate.activeTemplate}
        selectedVariant={selectedVariant}
      />
      {hasLines ? (
        <p className="mt-1.5 text-[10px] text-counselling-muted-foreground">
          {formatValidityEn(addCalendarDays(new Date(), 3))}
        </p>
      ) : null}
    </div>
  );

  const customItemized = (
    <div className="space-y-4" data-testid={counsellingTestIds.quoteItemizedBreakdown}>
      <QuoteLineSection title={procedureSectionTitle} lines={procedureLines}>
        {procedureLines.map((line) => (
          <EstimateLineItemRow
            key={line.key}
            line={line}
            catalogAmount={
              line.kind === 'procedure' &&
              activeOverride &&
              selectedVariant &&
              activeOverride.overriddenPrice !== selectedVariant.price
                ? selectedVariant.price
                : undefined
            }
            showInternalPricing
            hideTypeDetail
            eyePricingLabel={
              line.kind === 'procedure'
                ? procedureEyeUnitLabel(line.detail, selectedVariant)?.unit
                : undefined
            }
            eye={
              line.kind === 'procedure'
                ? procedureEyeUnitLabel(line.detail, selectedVariant)?.eye ?? selectedEye
                : undefined
            }
            onEditPrice={
              line.kind === 'procedure' && !isPackage && onOpenOverride ? onOpenOverride : undefined
            }
            isReadOnly={isReadOnly}
          />
        ))}
      </QuoteLineSection>

      <QuoteLineSection title={counsellingCopy.lensIol} lines={iolLines}>
        {iolLines.map((line) => (
          <EstimateLineItemRow
            key={line.key}
            line={line}
            showKindBadge
            hideTypeDetail
            isReadOnly={isReadOnly}
          />
        ))}
      </QuoteLineSection>

      <QuoteLineSection title={counsellingCopy.imagingAndOther} lines={groupedLines.imaging}>
        {groupedLines.imaging.map((line) => (
          <EstimateLineItemRow
            key={line.key}
            line={line}
            hideTypeDetail
            isReadOnly={isReadOnly}
          />
        ))}
      </QuoteLineSection>

      <QuoteLineSection title={counsellingCopy.labs} lines={groupedLines.labs}>
        {groupedLines.labs.map((line) => (
          <EstimateLineItemRow
            key={line.key}
            line={line}
            hideTypeDetail
            isReadOnly={isReadOnly}
          />
        ))}
      </QuoteLineSection>

      {estimate.bundleSavings > 0 ? (
        <div className="flex justify-between gap-3 text-sm text-emerald-700">
          <span>{counsellingCopy.bundleSavings}</span>
          <span className="shrink-0 font-medium tabular-nums">−{formatInr(estimate.bundleSavings)}</span>
        </div>
      ) : null}

      {estimate.discountAmount > 0 ? (
        <div className="flex justify-between gap-3 text-sm">
          <span className="text-counselling-muted-foreground">{counsellingCopy.discount}</span>
          <span className="shrink-0 font-medium tabular-nums text-red-700">
            −{formatInr(estimate.discountAmount)}
          </span>
        </div>
      ) : null}
    </div>
  );

  const packageItemized = estimate.activeTemplate ? (
    <div className="space-y-2" data-testid={counsellingTestIds.quoteItemizedBreakdown}>
      <div className="flex items-start justify-between gap-2 py-1 text-sm">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-counselling-foreground">
              {estimate.activeTemplate.name}
            </span>
            <CounsellingEyeBadge
              eye={selectedEye}
              data-testid={counsellingTestIds.quoteEstimateEyeBadge}
            />
            {hasQuotedProcedureOverride(
              estimate.activeTemplate.packageAmount,
              estimate.baseBeforeDiscount,
            ) ? (
              <CounsellingBadge
                variant="outline"
                className="border-amber-200 bg-amber-50 text-[9px] text-amber-800"
              >
                Price adjusted
              </CounsellingBadge>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!isReadOnly && onOpenPackageOverride ? (
            <CounsellingButton
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-amber-700 hover:bg-amber-50"
              onClick={onOpenPackageOverride}
              title={counsellingCopy.modifyPackagePrice}
              data-testid={counsellingTestIds.quotePackageEditPrice}
            >
              <Pencil size={12} />
            </CounsellingButton>
          ) : null}
          <span className="font-medium tabular-nums text-counselling-foreground">
            {formatInr(estimate.baseBeforeDiscount)}
          </span>
        </div>
      </div>
      {[...groupedLines.imaging, ...groupedLines.labs].length > 0 ? (
        <div className="space-y-1 border-t border-counselling-border/40 pt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-counselling-muted-foreground">
            Included in package
          </p>
          {[...groupedLines.imaging, ...groupedLines.labs].map((line) => (
            <p key={line.key} className="text-xs text-counselling-muted-foreground">
              {line.label}
            </p>
          ))}
        </div>
      ) : null}
      {estimate.bundleSavings > 0 ? (
        <div className="flex justify-between gap-3 text-sm text-emerald-700">
          <span>{counsellingCopy.bundleSavings}</span>
          <span className="shrink-0 font-medium tabular-nums">−{formatInr(estimate.bundleSavings)}</span>
        </div>
      ) : null}
      {estimate.discountAmount > 0 ? (
        <div className="flex justify-between gap-3 text-sm">
          <span className="text-counselling-muted-foreground">{counsellingCopy.discount}</span>
          <span className="shrink-0 font-medium tabular-nums text-red-700">
            −{formatInr(estimate.discountAmount)}
          </span>
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="space-y-3">
      {finalPayableBlock}

      {!hasLines ? (
        <CounsellingEmptyState
          compact
          title={hasPendingProcedure ? counsellingCopy.pricePending : counsellingCopy.noItemsYet}
        />
      ) : (
        <div className="space-y-3 border-t border-counselling-border/50 pt-3">
          <p className="text-xs font-semibold text-counselling-foreground">
            {counsellingCopy.itemizedBreakdown}
          </p>
          {isPackage ? packageItemized : customItemized}

          <QuoteDiscountPanel
            estimate={estimate}
            draftType={draftType}
            setDraftType={setDraftType}
            draftValue={draftValue}
            setDraftValue={setDraftValue}
            draftReason={draftReason}
            setDraftReason={setDraftReason}
            applyDiscount={applyDiscount}
            canApply={canApply}
            isReadOnly={isReadOnly}
            estimateDiscountType={estimateDiscountType}
            estimateDiscountValue={estimateDiscountValue}
          />
        </div>
      )}
    </div>
  );
});

