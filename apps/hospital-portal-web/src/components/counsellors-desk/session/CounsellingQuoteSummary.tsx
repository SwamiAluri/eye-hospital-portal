'use client';

import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { UseCounsellingEstimateResult } from '@/hooks/use-counselling-estimate';
import type { CounsellingDiscountType } from '@/types/counselling-estimate';
import { formatInr, resolveProcedureOverride } from '@/lib/counsellors-desk/package-preview';
import { addCalendarDays, formatValidityEn } from '@/lib/counsellors-desk/counselling-estimate-pdf-content';
import type { CounsellingPhase } from '@/lib/counsellors-desk/counselling-progress';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import type { CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import type { PriceOverrideRecord } from '@/lib/api/counselling-azure.api';
import { priceSuffix } from '@/lib/api/service-catalog.api';
import { counsellingEyeLabel, type CounsellingEyeOption } from '@/lib/counsellors-desk/counselling-eye';
import { groupEstimateLinesForDisplay } from '@/lib/counsellors-desk/estimate-engine';
import { sanitizeVariantName } from '@/lib/utils/sanitize-names';
import {
  CounsellingAccordion,
  CounsellingAccordionContent,
  CounsellingAccordionItem,
  CounsellingAccordionTrigger,
  CounsellingBadge,
  CounsellingButton,
  CounsellingEmptyState,
  CounsellingInput,
  CounsellingToggleGroup,
  CounsellingToggleGroupItem,
} from '@/components/counsellors-desk/session/primitives';
import { EstimateLineItemRow } from '@/components/counsellors-desk/session/EstimateLineItemRow';

export interface CounsellingQuoteSummaryProps {
  estimate: UseCounsellingEstimateResult;
  estimateDiscountType: CounsellingDiscountType | null;
  estimateDiscountValue: number;
  estimateDiscountReason: string;
  selectedVariant: CounsellorProcedureVariant | null;
  savedOverrides: PriceOverrideRecord[];
  isReadOnly: boolean;
  onOpenOverride?: () => void;
  activePhase?: CounsellingPhase;
  onGoToBuildQuote?: () => void;
}

const QuoteModeBadge = memo(function QuoteModeBadge({
  estimateMode,
  activeTemplate,
  selectedVariant,
  bundleSavings,
}: {
  estimateMode: 'custom' | 'package';
  activeTemplate: UseCounsellingEstimateResult['activeTemplate'];
  selectedVariant: CounsellorProcedureVariant | null;
  bundleSavings: number;
}) {
  const isPackage = estimateMode === 'package';
  const label = isPackage
    ? activeTemplate
      ? `Package · ${activeTemplate.name}`
      : 'Package'
    : selectedVariant
      ? 'Custom estimate'
      : 'Custom';

  return (
    <CounsellingBadge
      variant="outline"
      data-testid={counsellingTestIds.quoteModeBadge}
      className={
        isPackage
          ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
          : 'border-counselling-primary/30 bg-counselling-accent text-counselling-primary'
      }
    >
      {label}
    </CounsellingBadge>
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
      estimate.setDiscount({ discountType: null, discountValue: 0, discountReason: draftReason });
      return;
    }
    const parsed = Number(draftValue) || 0;
    estimate.setDiscount({
      discountType: draftType,
      discountValue: parsed,
      discountReason: draftReason,
    });
  }, [draftReason, draftType, draftValue, estimate]);

  const canApply =
    draftType != null && draftValue.trim() !== '' && Number(draftValue) > 0;

  return {
    draftType,
    setDraftType,
    draftValue,
    setDraftValue,
    draftReason,
    setDraftReason,
    applyDiscount,
    canApply,
  };
}

function procedureEyePricingLabel(
  eyeCode: string | undefined,
  variant: CounsellorProcedureVariant | null,
): string | undefined {
  if (!variant) return undefined;
  const eye = (eyeCode as CounsellingEyeOption) ?? 'RE';
  const suffix = priceSuffix(variant.priceType);
  const unit =
    suffix === '/eye' ? 'per eye' : suffix === '/both eyes' ? 'both eyes' : null;
  return unit ? `${counsellingEyeLabel(eye)} · ${unit}` : counsellingEyeLabel(eye);
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
  savedOverrides,
  isReadOnly,
  onOpenOverride,
  activePhase,
  onGoToBuildQuote,
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

  const procedureSectionTitle = isPackage ? 'Package' : 'Procedure';

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

  const emptyDescription = hasPendingProcedure
    ? `Confirm eye and lens selection for “${sanitizeVariantName(selectedVariant!.name)}”.`
    : estimateMode === 'package' && !estimate.activeTemplate
      ? 'Select a package to build the estimate.'
      : 'Add a procedure, package, or investigation.';

  const finalPayableBlock = (
    <div
      className="rounded-xl border-2 border-counselling-primary/30 bg-counselling-accent/50 px-4 py-3"
      data-testid={counsellingTestIds.quoteFinalPayable}
    >
      <p className={counsellingSessionTokens.microLabel + ' text-counselling-primary'}>Final payable</p>
      <p className="text-2xl font-extrabold tabular-nums text-counselling-accent-foreground">
        {formatInr(estimate.finalPayableAmount)}
      </p>
      {hasLines && (
        <p className="mt-1 text-[10px] text-counselling-primary">
          {formatValidityEn(addCalendarDays(new Date(), 3))}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      <QuoteModeBadge
        estimateMode={estimateMode}
        activeTemplate={estimate.activeTemplate}
        selectedVariant={selectedVariant}
        bundleSavings={estimate.bundleSavings}
      />

      {hasLines && (
        <div className="sticky top-0 z-10 bg-counselling-card/95 pb-2 pt-0 backdrop-blur-sm">
          {finalPayableBlock}
        </div>
      )}

      {!hasLines ? (
        <div className="space-y-3">
          <CounsellingEmptyState
            compact
            title={hasPendingProcedure ? 'Price pending' : 'No items yet'}
            description={emptyDescription}
          />
          {onGoToBuildQuote && activePhase !== 'estimate' ? (
            <CounsellingButton
              type="button"
              size="sm"
              onClick={onGoToBuildQuote}
              data-testid={counsellingTestIds.quoteGoToEstimate}
              className="w-full bg-counselling-primary hover:bg-counselling-primary/90"
            >
              Go to Build Quote
            </CounsellingButton>
          ) : null}
          {finalPayableBlock}
        </div>
      ) : (
        <>
          <div>
            <p className={counsellingSessionTokens.microLabel}>Itemized breakdown</p>
            <div className="mt-2 space-y-4">
              {isPackage && estimate.activeTemplate && (
                <div className="flex items-start justify-between gap-2 rounded-lg border border-indigo-200/60 bg-indigo-50/50 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 font-semibold text-indigo-900">
                    {estimate.activeTemplate.name}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-indigo-900">
                    {formatInr(estimate.baseBeforeDiscount)}
                  </span>
                </div>
              )}

              <QuoteLineSection title={procedureSectionTitle} lines={groupedLines.procedurePackage}>
                {groupedLines.procedurePackage.map((line) => (
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
                        ? procedureEyePricingLabel(line.detail, selectedVariant)
                        : undefined
                    }
                    onEditPrice={
                      line.kind === 'procedure' && !isPackage && onOpenOverride
                        ? onOpenOverride
                        : undefined
                    }
                    isReadOnly={isReadOnly}
                  />
                ))}
              </QuoteLineSection>

              <QuoteLineSection title="Investigations" lines={groupedLines.imaging}>
                {groupedLines.imaging.map((line) => (
                  <EstimateLineItemRow
                    key={line.key}
                    line={line}
                    hideTypeDetail
                    isReadOnly={isReadOnly}
                  />
                ))}
              </QuoteLineSection>

              <QuoteLineSection title="Labs" lines={groupedLines.labs}>
                {groupedLines.labs.map((line) => (
                  <EstimateLineItemRow
                    key={line.key}
                    line={line}
                    hideTypeDetail
                    isReadOnly={isReadOnly}
                  />
                ))}
              </QuoteLineSection>
            </div>
          </div>

          <div className="space-y-1 border-t border-counselling-border/60 pt-2 text-sm">
            <div className="flex justify-between">
              <span className="text-counselling-muted-foreground">Subtotal</span>
              <span className="font-semibold tabular-nums">{formatInr(estimate.itemizedSubtotal)}</span>
            </div>
            {estimate.isPackageMode && estimate.bundleSavings > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Bundle savings</span>
                <span className="font-semibold tabular-nums">−{formatInr(estimate.bundleSavings)}</span>
              </div>
            )}
            {estimate.discountAmount > 0 && (
              <div className="flex justify-between text-red-700">
                <span>Discount</span>
                <span className="font-semibold tabular-nums">−{formatInr(estimate.discountAmount)}</span>
              </div>
            )}
          </div>

          <CounsellingAccordion type="single" collapsible className="rounded-lg border border-counselling-border/60">
            <CounsellingAccordionItem value="discount" className="border-0">
              <CounsellingAccordionTrigger className="px-3 py-2 text-xs font-semibold hover:no-underline">
                Apply discount
                {estimateDiscountType && estimateDiscountValue > 0 && (
                  <span className="ml-2 font-normal text-counselling-muted-foreground">
                    ({estimateDiscountType === 'percent' ? `${estimateDiscountValue}%` : formatInr(estimateDiscountValue)})
                  </span>
                )}
              </CounsellingAccordionTrigger>
              <CounsellingAccordionContent className="space-y-2 px-3 pb-3">
                <CounsellingToggleGroup
                  type="single"
                  value={draftType ?? ''}
                  onValueChange={(v) => {
                    const t = v as 'percent' | 'flat' | '';
                    setDraftType(t || null);
                    if (!t) setDraftValue('');
                  }}
                  disabled={isReadOnly}
                  className="flex gap-2"
                >
                  {(['percent', 'flat'] as const).map((t) => (
                    <CounsellingToggleGroupItem
                      key={t}
                      value={t}
                      size="sm"
                      className="min-w-[4rem]"
                      data-testid={counsellingTestIds.quoteDiscountType(t)}
                    >
                      {t === 'percent' ? '%' : '₹ Flat'}
                    </CounsellingToggleGroupItem>
                  ))}
                </CounsellingToggleGroup>
                {draftType && (
                  <CounsellingInput
                    type="number"
                    min="0"
                    disabled={isReadOnly}
                    value={draftValue}
                    onChange={(e) => setDraftValue(e.target.value)}
                    placeholder={draftType === 'percent' ? 'Discount %' : 'Discount amount (₹)'}
                    className="tabular-nums"
                    data-testid={counsellingTestIds.quoteDiscountValue}
                  />
                )}
                <CounsellingInput
                  type="text"
                  disabled={isReadOnly}
                  value={draftReason}
                  onChange={(e) => setDraftReason(e.target.value)}
                  className="text-xs"
                  data-testid={counsellingTestIds.quoteDiscountReason}
                />
                <p className="text-[10px] text-counselling-muted-foreground">
                  Max without manager: {estimate.effectiveMaxDiscountPercent}%
                  {estimate.tenantMaxDiscountFlat != null && estimate.tenantMaxDiscountFlat > 0 && (
                    <span> or {formatInr(estimate.tenantMaxDiscountFlat)} flat</span>
                  )}{' '}
                  (cap {formatInr(estimate.maxDiscountAmount)})
                </p>
                {!isReadOnly && (
                  <CounsellingButton
                    type="button"
                    size="sm"
                    disabled={!canApply}
                    onClick={applyDiscount}
                    data-testid={counsellingTestIds.quoteDiscountApply}
                    className="w-full bg-counselling-primary hover:bg-counselling-primary/90"
                  >
                    Add
                  </CounsellingButton>
                )}
                {estimate.discountExceeded && (
                  <p className="text-[10px] font-medium text-amber-700">
                    Discount exceeds cap — applied amount is capped.
                  </p>
                )}
              </CounsellingAccordionContent>
            </CounsellingAccordionItem>
          </CounsellingAccordion>
        </>
      )}

    </div>
  );
});
