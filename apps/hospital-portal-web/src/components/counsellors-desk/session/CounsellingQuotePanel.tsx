'use client';

import { useMemo, useState } from 'react';
import { Receipt } from 'lucide-react';
import { CounsellingQuoteBottomSheet } from '@/components/counsellors-desk/session/CounsellingQuoteBottomSheet';
import { CounsellingQuoteSummary } from '@/components/counsellors-desk/session/CounsellingQuoteSummary';
import type { UseCounsellingEstimateResult } from '@/hooks/use-counselling-estimate';
import type { CounsellingDiscountType } from '@/types/counselling-estimate';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { findCounsellorVariant, type CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import type { PriceOverrideRecord } from '@/lib/api/counselling-azure.api';
import type { CounsellingPhase } from '@/lib/counsellors-desk/counselling-progress';
import { CounsellingPriceOverrideDialog } from './CounsellingPriceOverrideDialog';
import type { CounsellingPriceOverrideDialogProps } from './CounsellingPriceOverrideDialog';
import {
  CounsellingCard,
  CounsellingCardContent,
  CounsellingCardHeader,
  CounsellingCardTitle,
} from '@/components/counsellors-desk/session/primitives';

interface CounsellingQuotePanelProps {
  estimate: UseCounsellingEstimateResult;
  estimateDiscountType: CounsellingDiscountType | null;
  estimateDiscountValue: number;
  estimateDiscountReason: string;
  selectedVariantId: string | null;
  procedureVariants: CounsellorProcedureVariant[];
  savedOverrides: PriceOverrideRecord[];
  isReadOnly: boolean;
  activePhase?: CounsellingPhase;
  onGoToBuildQuote?: () => void;
  overrideDialogProps: Omit<
    CounsellingPriceOverrideDialogProps,
    'open' | 'onOpenChange' | 'selectedVariant'
  >;
}

export function CounsellingQuotePanel({
  estimate,
  estimateDiscountType,
  estimateDiscountValue,
  estimateDiscountReason,
  selectedVariantId,
  procedureVariants,
  savedOverrides,
  isReadOnly,
  activePhase,
  onGoToBuildQuote,
  overrideDialogProps,
}: CounsellingQuotePanelProps) {
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const selectedVariant = useMemo(
    () => findCounsellorVariant(procedureVariants, selectedVariantId) ?? null,
    [procedureVariants, selectedVariantId],
  );

  const summaryProps = useMemo(
    () => ({
      estimate,
      estimateDiscountType,
      estimateDiscountValue,
      estimateDiscountReason,
      selectedVariant,
      savedOverrides,
      isReadOnly,
      onOpenOverride: () => setOverrideOpen(true),
      activePhase,
      onGoToBuildQuote,
    }),
    [
      estimate,
      estimateDiscountType,
      estimateDiscountValue,
      estimateDiscountReason,
      selectedVariant,
      savedOverrides,
      isReadOnly,
      activePhase,
      onGoToBuildQuote,
    ],
  );

  return (
    <>
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:max-h-full lg:min-h-0 lg:min-w-0 lg:flex-[1_1_45%] lg:shrink-0 lg:self-start lg:flex-col">
        <CounsellingCard
          data-testid={counsellingTestIds.quotePanel}
          className={`${counsellingSessionTokens.card} flex w-full max-h-full min-h-0 flex-col overflow-hidden`}
        >
          <CounsellingCardHeader className={`${counsellingSessionTokens.cardHeader} shrink-0`}>
            <CounsellingCardTitle className="flex items-center gap-2 text-sm font-semibold text-counselling-foreground">
              <Receipt size={16} className="text-counselling-primary" />
              Quote
            </CounsellingCardTitle>
          </CounsellingCardHeader>
          <CounsellingCardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
            <div className="min-h-0 max-h-full flex-1 overflow-y-auto overscroll-contain px-5 pb-5 scrollbar-hide">
              <CounsellingQuoteSummary {...summaryProps} />
            </div>
          </CounsellingCardContent>
        </CounsellingCard>
      </aside>

      <CounsellingQuoteBottomSheet
        finalPayable={estimate.finalPayableAmount}
        expanded={mobileExpanded}
        onExpandedChange={setMobileExpanded}
      >
        {mobileExpanded ? <CounsellingQuoteSummary {...summaryProps} /> : null}
      </CounsellingQuoteBottomSheet>

      <CounsellingPriceOverrideDialog
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        selectedVariant={selectedVariant}
        {...overrideDialogProps}
      />
    </>
  );
}
