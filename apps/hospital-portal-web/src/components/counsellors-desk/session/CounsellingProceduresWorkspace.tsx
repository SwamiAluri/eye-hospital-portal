'use client';

import { useMemo, useState } from 'react';
import { Stethoscope, X } from 'lucide-react';
import { priceSuffix } from '@/lib/api/service-catalog.api';
import type { IolMasterDto } from '@/lib/api/service-catalog.api';
import { sanitizeVariantName } from '@/lib/utils/sanitize-names';
import {
  deriveProcedureCategoryFilters,
  findCounsellorVariant,
  type CounsellorProcedureVariant,
} from '@/lib/master-data/clinical-catalog-master';
import { type CounsellingEyeOption } from '@/lib/counsellors-desk/counselling-eye';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import { CounsellingProcedureCatalogSkeleton } from '@/components/counsellors-desk/session/CounsellingProcedureCatalogSkeleton';
import {
  CounsellingButton,
  CounsellingEmptyState,
  CounsellingInfoAlert,
  CounsellingLabel,
  CounsellingRadioGroup,
  CounsellingRadioGroupItem,
  CounsellingSearchInput,
  CounsellingSelect,
  CounsellingSelectContent,
  CounsellingSelectItem,
  CounsellingSelectTrigger,
  CounsellingSelectValue,
  CounsellingSelectableRow,
  CounsellingSeparator,
  CounsellingToggleGroup,
  CounsellingToggleGroupItem,
} from '@/components/counsellors-desk/session/primitives';
import { cn } from '@/lib/utils';

function groupVariantsByCategory(
  variants: CounsellorProcedureVariant[],
): { category: string; items: CounsellorProcedureVariant[] }[] {
  const map = new Map<string, CounsellorProcedureVariant[]>();
  variants.forEach((v) => {
    const cat = v.categoryName || v.categoryCode || 'Other';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(v);
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => ({ category, items }));
}

export interface CounsellingProceduresWorkspaceProps {
  embedded?: boolean;
  procedureVariants: CounsellorProcedureVariant[];
  procedureLoading: boolean;
  procedureError: boolean;
  loadProcedures: () => void;
  recommendedVariantIds: string[];
  selectedVariantId: string | null;
  selectedEye: CounsellingEyeOption;
  variantSubOption: string | null;
  iolOptions: IolMasterDto[];
  selectedIolId: string | null;
  isReadOnly: boolean;
  isDoneState: boolean;
  onSelectVariant: (variantId: string, surgeryId: string, eye: CounsellingEyeOption) => void;
  onClearVariant: () => void;
  onSelectEye: (eye: CounsellingEyeOption) => void;
  onEyeInvestigationSync: (eye: CounsellingEyeOption) => void;
  onVariantSubOption: (opt: string | null) => void;
  onSelectIol: (iolId: string | null) => void;
  onReEvaluate: () => void;
  markDirty: () => void;
  quotedProcedurePrice?: number | null;
}

export function CounsellingProceduresWorkspace({
  embedded = false,
  procedureVariants,
  procedureLoading,
  procedureError,
  loadProcedures,
  recommendedVariantIds,
  selectedVariantId,
  selectedEye,
  variantSubOption,
  iolOptions,
  selectedIolId,
  isReadOnly,
  isDoneState,
  onSelectVariant,
  onClearVariant,
  onVariantSubOption,
  onSelectIol,
  onReEvaluate,
  markDirty,
}: CounsellingProceduresWorkspaceProps) {
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [procedureSearch, setProcedureSearch] = useState('');

  const categoryFilters = useMemo(
    () => deriveProcedureCategoryFilters(procedureVariants),
    [procedureVariants],
  );

  const recommendedSet = useMemo(() => new Set(recommendedVariantIds), [recommendedVariantIds]);

  const recommended = useMemo(
    () => procedureVariants.filter((v) => recommendedSet.has(v.id)),
    [procedureVariants, recommendedSet],
  );

  const filteredProcedures = useMemo(() => {
    const q = procedureSearch.trim().toLowerCase();
    return procedureVariants.filter((v) => {
      if (categoryFilter !== 'All' && v.categoryCode !== categoryFilter) return false;
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        v.code.toLowerCase().includes(q) ||
        (v.categoryName ?? '').toLowerCase().includes(q)
      );
    });
  }, [procedureVariants, categoryFilter, procedureSearch]);

  const groupedBrowse = useMemo(
    () => groupVariantsByCategory(filteredProcedures),
    [filteredProcedures],
  );

  const selectedVariant = findCounsellorVariant(procedureVariants, selectedVariantId);
  const hasActiveFilters = categoryFilter !== 'All' || procedureSearch.trim().length > 0;

  const pickVariant = (v: CounsellorProcedureVariant) => {
    if (isReadOnly) return;
    if (isDoneState && v.id !== selectedVariantId) {
      onReEvaluate();
      return;
    }
    const eye = v.priceType === 'BOTH_EYES' ? 'BE' : selectedEye;
    onSelectVariant(v.id, `type-${v.id}-${eye}`, eye);
    markDirty();
  };

  const content = (
    <>
      {procedureLoading && <CounsellingProcedureCatalogSkeleton />}

      {!procedureLoading && (procedureError || procedureVariants.length === 0) && (
        <div className="flex flex-col items-center justify-center gap-3 py-8">
          <p className="text-sm text-counselling-muted-foreground">Unable to load procedures.</p>
          <CounsellingButton type="button" variant="outline" size="sm" onClick={() => void loadProcedures()}>
            Retry
          </CounsellingButton>
        </div>
      )}

      {!procedureLoading && procedureVariants.length > 0 && (
        <div className="space-y-4">
          {recommended.length > 0 && !hasActiveFilters && (
            <CounsellingInfoAlert variant="warning" title="Doctor's recommendation">
              <div className="space-y-1.5">
                {recommended.map((v) => (
                  <CounsellingSelectableRow
                    key={v.id}
                    selected={selectedVariantId === v.id}
                    disabled={isReadOnly}
                    onClick={() => pickVariant(v)}
                  >
                    <span className="flex flex-1 items-center gap-1.5 font-medium">
                      <Stethoscope size={14} className="shrink-0 text-amber-700" />
                      {sanitizeVariantName(v.name)}
                    </span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-counselling-foreground">
                      ₹{v.price.toLocaleString('en-IN')}
                      <span className="font-normal text-counselling-muted-foreground">{priceSuffix(v.priceType)}</span>
                    </span>
                  </CounsellingSelectableRow>
                ))}
              </div>
            </CounsellingInfoAlert>
          )}

          {selectedVariant && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-counselling-primary/30 bg-counselling-accent/50 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-counselling-accent-foreground">
                  {sanitizeVariantName(selectedVariant.name)}
                </p>
                <p className="text-xs tabular-nums text-counselling-muted-foreground">
                  ₹{selectedVariant.price.toLocaleString('en-IN')}
                  {priceSuffix(selectedVariant.priceType)}
                </p>
              </div>
              {!isReadOnly && (
                <CounsellingButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-counselling-muted-foreground hover:text-counselling-foreground"
                  onClick={() => {
                    onClearVariant();
                    markDirty();
                  }}
                >
                  <X size={14} className="mr-1" />
                  Clear
                </CounsellingButton>
              )}
            </div>
          )}

          <div className="rounded-lg border border-counselling-border/60">
            <div className="flex flex-col gap-2 border-b border-counselling-border/60 p-3 sm:flex-row sm:items-center">
              <div className="sm:w-44">
                <CounsellingLabel className="sr-only">Category</CounsellingLabel>
                <CounsellingSelect
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                  disabled={isReadOnly}
                >
                  <CounsellingSelectTrigger className="h-10 w-full">
                    <CounsellingSelectValue placeholder="Category" />
                  </CounsellingSelectTrigger>
                  <CounsellingSelectContent>
                    <CounsellingSelectItem value="All">All categories</CounsellingSelectItem>
                    {categoryFilters.map((c) => (
                      <CounsellingSelectItem key={c.code} value={c.code}>
                        {c.name}
                      </CounsellingSelectItem>
                    ))}
                  </CounsellingSelectContent>
                </CounsellingSelect>
              </div>
              <CounsellingSearchInput
                value={procedureSearch}
                onChange={setProcedureSearch}
                placeholder="Search by procedure name or code…"
                disabled={isReadOnly}
                data-testid={counsellingTestIds.procedureSearch}
                className="min-w-0 flex-1"
              />
            </div>

            <div className="max-h-72 overflow-y-auto overscroll-contain p-2">
              {groupedBrowse.length === 0 ? (
                <CounsellingEmptyState
                  compact
                  title="No procedures match"
                  description="Try a different category or search term."
                />
              ) : (
                <div className="space-y-3">
                  {groupedBrowse.map(({ category, items }) => (
                    <div key={category}>
                      <p className="mb-1 px-1 text-xs font-semibold text-counselling-muted-foreground">
                        {category}
                        <span className="ml-1 font-normal text-counselling-muted-foreground/70">
                          ({items.length})
                        </span>
                      </p>
                      <CounsellingSeparator className="mb-1.5 bg-counselling-border" />
                      <div className="space-y-1">
                        {items.map((v) => (
                          <CounsellingSelectableRow
                            key={v.id}
                            selected={selectedVariantId === v.id}
                            disabled={isReadOnly}
                            onClick={() => pickVariant(v)}
                          >
                            <span className="min-w-0 flex-1 truncate font-medium">
                              {sanitizeVariantName(v.name)}
                            </span>
                            <span className="shrink-0 text-xs tabular-nums text-counselling-muted-foreground">
                              ₹{v.price.toLocaleString('en-IN')}
                              {priceSuffix(v.priceType)}
                            </span>
                          </CounsellingSelectableRow>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="border-t border-counselling-border/60 px-3 py-1.5 text-[10px] text-counselling-muted-foreground">
              {filteredProcedures.length} procedure{filteredProcedures.length === 1 ? '' : 's'}
            </p>
          </div>

          {selectedVariant &&
            (selectedVariant.subOptions?.length ?? 0) > 0 &&
            !selectedVariant.hasIolOptions && (
              <div className={counsellingSessionTokens.accentPanel}>
                <p className="mb-2 text-sm font-semibold text-counselling-foreground">
                  Sub-type for {sanitizeVariantName(selectedVariant.name)}{' '}
                  <span className="text-red-500">*</span>
                </p>
                <CounsellingToggleGroup
                  type="single"
                  value={variantSubOption ?? ''}
                  onValueChange={(v) => {
                    onVariantSubOption(v || null);
                    markDirty();
                  }}
                  className="flex flex-wrap gap-1"
                >
                  {selectedVariant.subOptions!.map((opt) => (
                    <CounsellingToggleGroupItem
                      key={opt}
                      value={opt}
                      disabled={isReadOnly}
                      className="text-xs"
                    >
                      {opt}
                    </CounsellingToggleGroupItem>
                  ))}
                </CounsellingToggleGroup>
                {!variantSubOption && (
                  <p className="mt-1.5 text-xs text-amber-700">Required before saving.</p>
                )}
              </div>
            )}

          {selectedVariant && iolOptions.length > 0 && (
            <div className="border-t border-counselling-border/60 pt-4">
              <p className="mb-2 text-sm font-semibold text-counselling-foreground">
                IOL / lens for {sanitizeVariantName(selectedVariant.name)}
              </p>
              <CounsellingRadioGroup
                value={selectedIolId ?? ''}
                onValueChange={(v) => {
                  onSelectIol(v || null);
                  markDirty();
                }}
                disabled={isReadOnly}
                className="space-y-1.5"
              >
                {iolOptions.map((iol) => {
                  const selected = selectedIolId === iol.id;
                  return (
                    <label
                      key={iol.id}
                      htmlFor={`counselling-iol-${iol.id}`}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                        selected
                          ? 'border-counselling-primary/30 bg-counselling-accent/60'
                          : 'border-transparent hover:border-counselling-border hover:bg-counselling-muted',
                        isReadOnly && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      <CounsellingRadioGroupItem
                        id={`counselling-iol-${iol.id}`}
                        value={iol.id}
                        className="shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {sanitizeVariantName(iol.modelName)}
                        </span>
                        <span className="text-xs text-counselling-muted-foreground">
                          {sanitizeVariantName(iol.brandManufacturer)}
                        </span>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums text-counselling-foreground">
                        ₹{iol.price.toLocaleString('en-IN')}
                      </span>
                    </label>
                  );
                })}
              </CounsellingRadioGroup>
            </div>
          )}
        </div>
      )}
    </>
  );

  if (embedded) return content;

  return (
    <section
      id="counselling-step-1"
      className="scroll-mt-24 rounded-xl border border-counselling-border bg-counselling-card p-4 shadow-sm"
    >
      {content}
    </section>
  );
}
