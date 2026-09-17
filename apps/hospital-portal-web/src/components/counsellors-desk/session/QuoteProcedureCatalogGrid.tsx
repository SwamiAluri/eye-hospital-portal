'use client';

import { useMemo, useState } from 'react';
import { priceSuffix } from '@/lib/api/service-catalog.api';
import { sanitizeVariantName } from '@/lib/utils/sanitize-names';
import type { CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import type { CounsellingEyeOption } from '@/lib/counsellors-desk/counselling-eye';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { CounsellingProcedureCatalogSkeleton } from '@/components/counsellors-desk/session/CounsellingProcedureCatalogSkeleton';
import {
  CounsellingBadge,
  CounsellingButton,
  CounsellingEmptyState,
  CounsellingInfoAlert,
  CounsellingPricingCard,
  CounsellingSearchInput,
} from '@/components/counsellors-desk/session/primitives';

function procedureFeatureLines(variant: CounsellorProcedureVariant): string[] {
  const lines: string[] = [];
  if (variant.categoryName) lines.push(variant.categoryName);
  if (variant.code) lines.push(variant.code);
  if (variant.priceType === 'BOTH_EYES') lines.push('Both eyes pricing');
  if ((variant.subOptions?.length ?? 0) > 0) {
    lines.push('Lens / sub-type required');
  } else if (variant.hasIolOptions) {
    lines.push('IOL selection available');
  }
  return lines;
}

export interface QuoteProcedureCatalogGridProps {
  procedureVariants: CounsellorProcedureVariant[];
  procedureLoading: boolean;
  procedureError: boolean;
  loadProcedures: () => void;
  recommendedVariantIds: string[];
  selectedVariantId: string | null;
  selectedEye: CounsellingEyeOption;
  isReadOnly: boolean;
  isDoneState: boolean;
  onPickVariant: (variantId: string, surgeryId: string, eye: CounsellingEyeOption) => void;
  onReEvaluate: () => void;
  markDirty: () => void;
}

export function QuoteProcedureCatalogGrid({
  procedureVariants,
  procedureLoading,
  procedureError,
  loadProcedures,
  recommendedVariantIds,
  selectedVariantId,
  selectedEye,
  isReadOnly,
  isDoneState,
  onPickVariant,
  onReEvaluate,
  markDirty,
}: QuoteProcedureCatalogGridProps) {
  const [procedureSearch, setProcedureSearch] = useState('');

  const recommendedSet = useMemo(() => new Set(recommendedVariantIds), [recommendedVariantIds]);

  const filteredProcedures = useMemo(() => {
    const q = procedureSearch.trim().toLowerCase();
    const sorted = [...procedureVariants].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted;
    return sorted.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.code.toLowerCase().includes(q) ||
        (v.categoryName ?? '').toLowerCase().includes(q) ||
        (v.serviceName ?? '').toLowerCase().includes(q),
    );
  }, [procedureVariants, procedureSearch]);

  const recommended = useMemo(
    () => filteredProcedures.filter((v) => recommendedSet.has(v.id)),
    [filteredProcedures, recommendedSet],
  );

  const others = useMemo(
    () => filteredProcedures.filter((v) => !recommendedSet.has(v.id)),
    [filteredProcedures, recommendedSet],
  );

  const pickVariant = (v: CounsellorProcedureVariant) => {
    if (isReadOnly) return;
    if (isDoneState && v.id !== selectedVariantId) {
      onReEvaluate();
      return;
    }
    const eye = v.priceType === 'BOTH_EYES' ? 'BE' : selectedEye;
    onPickVariant(v.id, `type-${v.id}-${eye}`, eye);
    markDirty();
  };

  const renderCard = (v: CounsellorProcedureVariant, suggested: boolean) => (
    <CounsellingPricingCard
      key={v.id}
      name={sanitizeVariantName(v.name)}
      code={v.code}
      priceLabel={`₹${v.price.toLocaleString('en-IN')}${priceSuffix(v.priceType)}`}
      features={procedureFeatureLines(v)}
      selected={selectedVariantId === v.id}
      suggested={suggested}
      disabled={isReadOnly}
      selectLabel={counsellingCopy.selectProcedure}
      selectedLabel={counsellingCopy.selected}
      data-testid={counsellingTestIds.procedureCatalogCard(v.id)}
      badges={
        suggested ? (
          <CounsellingBadge className="bg-amber-100 text-[10px] text-amber-900 hover:bg-amber-100">
            Recommended
          </CounsellingBadge>
        ) : null
      }
      onSelect={() => pickVariant(v)}
    />
  );

  return (
    <div
      className="rounded-lg border border-counselling-border/60 bg-counselling-card/40"
      data-testid={counsellingTestIds.quoteProcedureCatalogGrid}
    >
      <div className={`${counsellingSessionTokens.catalogStickyFilters} px-3 py-2`}>
        <CounsellingSearchInput
          value={procedureSearch}
          onChange={setProcedureSearch}
          placeholder={counsellingCopy.searchProcedures}
          disabled={isReadOnly || procedureLoading}
          data-testid={counsellingTestIds.procedureSearch}
          className="w-full"
        />
      </div>

      <div className="p-3">
        {procedureLoading ? <CounsellingProcedureCatalogSkeleton /> : null}

        {!procedureLoading && (procedureError || procedureVariants.length === 0) ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <p className="text-sm text-counselling-muted-foreground">Unable to load procedures.</p>
            <CounsellingButton type="button" variant="outline" size="sm" onClick={() => void loadProcedures()}>
              Retry
            </CounsellingButton>
          </div>
        ) : null}

        {!procedureLoading && procedureVariants.length > 0 ? (
          <>
            {recommended.length > 0 && !procedureSearch.trim() ? (
              <CounsellingInfoAlert variant="warning" title="Doctor's recommendation" className="mb-3">
                <div className="grid gap-3 sm:grid-cols-2">{recommended.map((v) => renderCard(v, true))}</div>
              </CounsellingInfoAlert>
            ) : null}

            {filteredProcedures.length === 0 ? (
              <CounsellingEmptyState
                compact
                title="No procedures match"
              />
            ) : procedureSearch.trim() ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredProcedures.map((v) => renderCard(v, recommendedSet.has(v.id)))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">{others.map((v) => renderCard(v, false))}</div>
            )}
          </>
        ) : null}
      </div>

      {!procedureLoading && procedureVariants.length > 0 ? (
        <p className="border-t border-counselling-border/60 px-3 py-1.5 text-[10px] text-counselling-muted-foreground">
          {filteredProcedures.length} procedure{filteredProcedures.length === 1 ? '' : 's'}
        </p>
      ) : null}
    </div>
  );
}
