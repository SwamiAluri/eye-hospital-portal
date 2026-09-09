'use client';

import { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { CounsellingQuoteBottomSheet } from '@/components/counsellors-desk/session/CounsellingQuoteBottomSheet';
import { CounsellingQuoteSummary } from '@/components/counsellors-desk/session/CounsellingQuoteSummary';
import type { UseCounsellingEstimateResult } from '@/hooks/use-counselling-estimate';
import type { CounsellingDiscountType } from '@/types/counselling-estimate';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { findCounsellorVariant, type CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import type { PriceOverrideRecord } from '@/lib/api/counselling-azure.api';
import type { CounsellingPhase } from '@/lib/counsellors-desk/counselling-progress';
import type { CounsellingEyeOption } from '@/lib/counsellors-desk/counselling-eye';
import { CounsellingPriceOverrideDialog } from './CounsellingPriceOverrideDialog';
import type { CounsellingPriceOverrideDialogProps } from './CounsellingPriceOverrideDialog';
import { cn } from '@/lib/utils';
interface CounsellingQuotePanelProps {
  estimate: UseCounsellingEstimateResult;
  estimateDiscountType: CounsellingDiscountType | null;
  estimateDiscountValue: number;
  estimateDiscountReason: string;
  selectedVariantId: string | null;
  selectedEye: CounsellingEyeOption;
  procedureVariants: CounsellorProcedureVariant[];
  savedOverrides: PriceOverrideRecord[];
  isReadOnly: boolean;
  activePhase?: CounsellingPhase;
  overrideDialogProps: Omit<
    CounsellingPriceOverrideDialogProps,
    'open' | 'onOpenChange' | 'selectedVariant' | 'packageTarget'
  >;
}

export function CounsellingQuotePanel({
  estimate,
  estimateDiscountType,
  estimateDiscountValue,
  estimateDiscountReason,
  selectedVariantId,
  selectedEye,
  procedureVariants,
  savedOverrides,
  isReadOnly,
  activePhase,
  overrideDialogProps,
}: CounsellingQuotePanelProps) {
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideKind, setOverrideKind] = useState<'procedure' | 'package'>('procedure');
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const selectedVariant = useMemo(
    () => findCounsellorVariant(procedureVariants, selectedVariantId) ?? null,
    [procedureVariants, selectedVariantId],
  );

  const packageTarget = useMemo(() => {
    if (!estimate.activeTemplate) return null;
    return {
      id: estimate.activeTemplate.id,
      name: estimate.activeTemplate.name,
      basePrice: estimate.activeTemplate.packageAmount,
    };
  }, [estimate.activeTemplate]);

  const summaryProps = useMemo(
    () => ({
      estimate,
      estimateDiscountType,
      estimateDiscountValue,
      estimateDiscountReason,
      selectedVariant,
      selectedEye,
      savedOverrides,
      isReadOnly,
      onOpenOverride: () => {
        setOverrideKind('procedure');
        setOverrideOpen(true);
      },
      onOpenPackageOverride: () => {
        setOverrideKind('package');
        setOverrideOpen(true);
      },
      activePhase,
    }),
    [
      estimate,
      estimateDiscountType,
      estimateDiscountValue,
      estimateDiscountReason,
      selectedVariant,
      selectedEye,
      savedOverrides,
      isReadOnly,
      activePhase,
    ],
  );

  return (
    <>
      <aside
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
          counsellingSessionTokens.quoteSummaryRail,
        )}
      >
        <div className={`${counsellingSessionTokens.quoteSummaryInner} flex min-h-0 flex-1 flex-col`}>
          <header className="mb-3 shrink-0">
            <h2 className={counsellingSessionTokens.quoteSummaryTitle}>
              <FileText className="h-4 w-4 text-counselling-primary" aria-hidden />
              Estimate
            </h2>
          </header>
          <div className={counsellingSessionTokens.quoteSummaryPanel}>
            <CounsellingQuoteSummary {...summaryProps} />
          </div>
        </div>
      </aside>

      <CounsellingQuoteBottomSheet
        finalPayable={estimate.finalPayableAmount}
        expanded={mobileExpanded}
        onExpandedChange={setMobileExpanded}
      >
        {mobileExpanded ? (
          <>
            <h2 className={counsellingSessionTokens.quoteSummaryTitle}>Quote summary</h2>
            <CounsellingQuoteSummary {...summaryProps} />
          </>
        ) : null}
      </CounsellingQuoteBottomSheet>

      <CounsellingPriceOverrideDialog
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        selectedVariant={overrideKind === 'procedure' ? selectedVariant : null}
        packageTarget={overrideKind === 'package' ? packageTarget : null}
        {...overrideDialogProps}
      />
    </>
  );
}
