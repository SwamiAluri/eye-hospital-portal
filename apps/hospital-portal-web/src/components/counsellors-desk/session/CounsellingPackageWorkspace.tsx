'use client';

import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  computePackagePreview,
  formatInr,
  hasDoctorRecommendationConflict,
  packageIncludedItemCount,
  partitionPackageTemplates,
} from '@/lib/counsellors-desk/package-preview';
import { findCounsellorVariant, type CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import { sanitizeVariantName } from '@/lib/utils/sanitize-names';
import type { CounsellingPackageTemplate } from '@/types/counselling-estimate';
import type { MasterCatalogItem } from '@/types/counsellors-desk';
import type { UseCounsellingEstimateResult } from '@/hooks/use-counselling-estimate';
import type { CounsellingEyeOption } from '@/lib/counsellors-desk/counselling-eye';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { counsellingTestIds, counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import {
  CounsellingBadge,
  CounsellingButton,
  CounsellingEmptyState,
  CounsellingInfoAlert,
  CounsellingLabel,
  CounsellingPricingCard,
  CounsellingSearchInput,
  CounsellingSelect,
  CounsellingSelectContent,
  CounsellingSelectItem,
  CounsellingSelectTrigger,
  CounsellingSelectValue,
} from '@/components/counsellors-desk/session/primitives';

export interface CounsellingPackageWorkspaceProps {
  embedded?: boolean;
  estimate: UseCounsellingEstimateResult;
  packageTemplates: CounsellingPackageTemplate[];
  /** True when user lacks package_templates.read — distinct from empty master-data catalog. */
  packageTemplatesAccessDenied?: boolean;
  procedureVariants: CounsellorProcedureVariant[];
  masterCatalog: {
    imaging: MasterCatalogItem[];
    scan: MasterCatalogItem[];
    lab: MasterCatalogItem[];
  };
  recommendedVariantIds: string[];
  doctorRecommendationName: string | null;
  selectedVariantId: string | null;
  selectedEye: CounsellingEyeOption;
  isReadOnly: boolean;
  onSelectPackage: (templateId: string) => void;
  onSwitchToRecommendedProcedure: (variantId: string, eye: CounsellingEyeOption) => void;
  /** When true and a package is active, hide search + card grid */
  collapseBrowseWhenSelected?: boolean;
}

function resolveInvestigations(
  ids: string[],
  catalog: CounsellingPackageWorkspaceProps['masterCatalog'],
): MasterCatalogItem[] {
  const all = [...catalog.imaging, ...catalog.scan, ...catalog.lab];
  const byId = new Map(all.map((i) => [i.id, i]));
  return ids.map((id) => byId.get(id)).filter((i): i is MasterCatalogItem => !!i);
}

function packageFeatureLines(
  template: CounsellingPackageTemplate,
  procedureVariants: CounsellorProcedureVariant[],
  masterCatalog: CounsellingPackageWorkspaceProps['masterCatalog'],
): string[] {
  const lines: string[] = [];
  const procedure = findCounsellorVariant(procedureVariants, template.procedureVariantId ?? null);
  if (procedure) lines.push(sanitizeVariantName(procedure.name));
  const investigations = resolveInvestigations(template.investigationIds ?? [], masterCatalog);
  investigations.slice(0, 4).forEach((inv) => lines.push(inv.name));
  return lines;
}

export function CounsellingPackageWorkspace({
  embedded = false,
  estimate,
  packageTemplates,
  packageTemplatesAccessDenied = false,
  procedureVariants,
  masterCatalog,
  recommendedVariantIds,
  doctorRecommendationName,
  selectedVariantId,
  selectedEye,
  isReadOnly,
  onSelectPackage,
  onSwitchToRecommendedProcedure,
  collapseBrowseWhenSelected = false,
}: CounsellingPackageWorkspaceProps) {
  const [categoryFilter, setCategoryFilter] = useState('');
  const [packageSearch, setPackageSearch] = useState('');

  const activeTemplates = useMemo(
    () => packageTemplates.filter((t) => t.isActive !== false),
    [packageTemplates],
  );

  const categoryOptions = useMemo(() => {
    const cats = new Set<string>();
    activeTemplates.forEach((t) => {
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats).sort((a, b) => a.localeCompare(b));
  }, [activeTemplates]);

  const doctorCategory = useMemo(() => {
    const recId = recommendedVariantIds[0];
    if (!recId) return null;
    return findCounsellorVariant(procedureVariants, recId)?.categoryName ?? null;
  }, [recommendedVariantIds, procedureVariants]);

  const { suggested, rest } = useMemo(
    () => partitionPackageTemplates(activeTemplates, recommendedVariantIds, doctorCategory),
    [activeTemplates, recommendedVariantIds, doctorCategory],
  );

  const activeTemplateId = estimate.activeTemplate?.id ?? null;
  const hasConflict = hasDoctorRecommendationConflict(recommendedVariantIds, selectedVariantId);
  const hasActiveFilters = !!categoryFilter || packageSearch.trim().length > 0;

  const filteredPackages = useMemo(() => {
    const q = packageSearch.trim().toLowerCase();
    return activeTemplates.filter((t) => {
      if (categoryFilter && (t.category ?? 'Other') !== categoryFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        (t.category ?? '').toLowerCase().includes(q)
      );
    });
  }, [activeTemplates, categoryFilter, packageSearch]);

  const showBrowseCatalog =
    !(collapseBrowseWhenSelected && activeTemplateId) &&
    (embedded || !!categoryFilter || packageSearch.trim().length > 0);

  const matchingRecommendedPackage = useMemo(() => {
    const recId = recommendedVariantIds[0];
    if (!recId) return null;
    return (
      packageTemplates.find((t) => t.isActive !== false && t.procedureVariantId === recId) ?? null
    );
  }, [packageTemplates, recommendedVariantIds]);

  const handleSwitchToRecommended = () => {
    if (isReadOnly) return;
    const recId = recommendedVariantIds[0];
    if (!recId) return;

    if (matchingRecommendedPackage) {
      onSelectPackage(matchingRecommendedPackage.id);
      return;
    }

    const variant = findCounsellorVariant(procedureVariants, recId);
    if (!variant) return;

    estimate.setEstimateMode('custom');
    const eye = variant.priceType === 'BOTH_EYES' ? 'BE' : selectedEye;
    onSwitchToRecommendedProcedure(recId, eye);
  };

  if (collapseBrowseWhenSelected && activeTemplateId) {
    return (
      <>
        {hasConflict && (
          <CounsellingInfoAlert variant="warning" className="mb-4">
            <p>
              Selected procedure differs from doctor&apos;s recommendation
              {doctorRecommendationName ? ` (${doctorRecommendationName})` : ''}.
            </p>
            {!isReadOnly && recommendedVariantIds.length > 0 && (
              <CounsellingButton
                type="button"
                size="sm"
                className="mt-2"
                onClick={handleSwitchToRecommended}
              >
                Switch to recommended
                {matchingRecommendedPackage ? ` (${matchingRecommendedPackage.name})` : ''}
              </CounsellingButton>
            )}
          </CounsellingInfoAlert>
        )}
      </>
    );
  }

  const renderPackageCard = (template: CounsellingPackageTemplate, suggestedRow: boolean) => {
    const procedure = findCounsellorVariant(procedureVariants, template.procedureVariantId ?? null);
    const investigations = resolveInvestigations(template.investigationIds ?? [], masterCatalog);
    const preview = computePackagePreview({
      packageAmount: template.packageAmount,
      procedure: procedure ?? null,
      investigations,
      defaultEye: template.defaultEye,
    });
    const features = packageFeatureLines(template, procedureVariants, masterCatalog);
    const includedCount = packageIncludedItemCount(template);

    return (
      <CounsellingPricingCard
        key={template.id}
        name={template.name}
        code={template.code}
        priceLabel={formatInr(template.packageAmount)}
        features={features}
        extraFeatureCount={Math.max(0, includedCount - features.length)}
        savingsLabel={preview.bundleSavings > 0 ? `Save ${formatInr(preview.bundleSavings)}` : undefined}
        selected={activeTemplateId === template.id}
        suggested={suggestedRow}
        disabled={isReadOnly}
        selectLabel={counsellingCopy.selectPackage}
        selectedLabel={counsellingCopy.selected}
        data-testid={counsellingTestIds.packageCard(template.id)}
        badges={
          <>
            {template.category ? (
              <CounsellingBadge variant="outline" className="text-[10px]">
                {template.category}
              </CounsellingBadge>
            ) : null}
            {template.isDefault ? (
              <CounsellingBadge className="bg-counselling-accent text-[10px] text-counselling-primary hover:bg-counselling-accent">
                Default
              </CounsellingBadge>
            ) : null}
          </>
        }
        onSelect={() => onSelectPackage(template.id)}
      />
    );
  };

  if (packageTemplatesAccessDenied) {
    const denied = (
      <CounsellingEmptyState
        title={counsellingCopy.package}
        description={counsellingCopy.packageTemplatesUnavailable}
      />
    );
    if (embedded) {
      return (
        <p className="text-sm text-counselling-muted-foreground">
          {counsellingCopy.packageTemplatesUnavailable}
        </p>
      );
    }
    return (
      <section className="rounded-xl border border-dashed border-counselling-border bg-counselling-card p-4 shadow-sm">
        {denied}
      </section>
    );
  }

  if (packageTemplates.length === 0) {
    const empty = (
      <p className="text-sm text-counselling-muted-foreground">
        No counselling packages configured. Add templates in Master Data → Counselling packages.
      </p>
    );
    if (embedded) return empty;
    return (
      <section className="rounded-xl border border-dashed border-counselling-border bg-counselling-card p-4 shadow-sm">
        {empty}
      </section>
    );
  }

  const browseList = showBrowseCatalog ? filteredPackages : [];

  const content = (
    <>
      {hasConflict && (
        <CounsellingInfoAlert variant="warning" className="mb-4">
          <p>
            Selected procedure differs from doctor&apos;s recommendation
            {doctorRecommendationName ? ` (${doctorRecommendationName})` : ''}.
          </p>
          {!isReadOnly && recommendedVariantIds.length > 0 && (
            <CounsellingButton
              type="button"
              size="sm"
              className="mt-2"
              onClick={handleSwitchToRecommended}
            >
              Switch to recommended
              {matchingRecommendedPackage ? ` (${matchingRecommendedPackage.name})` : ''}
            </CounsellingButton>
          )}
        </CounsellingInfoAlert>
      )}

      <div className="rounded-lg border border-counselling-border/60">
        <div
          className={`${counsellingSessionTokens.catalogStickyFilters} flex flex-col gap-2 sm:flex-row sm:items-center`}
        >
          <div className="sm:w-44">
            <CounsellingLabel className="sr-only">Category</CounsellingLabel>
            <CounsellingSelect
              value={categoryFilter || undefined}
              onValueChange={setCategoryFilter}
              disabled={isReadOnly}
            >
              <CounsellingSelectTrigger className={`${counsellingSessionTokens.catalogInput} w-full`}>
                <CounsellingSelectValue placeholder={counsellingCopy.procedureCategoryPlaceholder} />
              </CounsellingSelectTrigger>
              <CounsellingSelectContent>
                {categoryOptions.map((cat) => (
                  <CounsellingSelectItem key={cat} value={cat}>
                    {cat}
                  </CounsellingSelectItem>
                ))}
              </CounsellingSelectContent>
            </CounsellingSelect>
          </div>
          <CounsellingSearchInput
            value={packageSearch}
            onChange={setPackageSearch}
            placeholder={counsellingCopy.searchPackages}
            disabled={isReadOnly}
            data-testid={counsellingTestIds.packageSearch}
            className="min-w-0 flex-1"
          />
        </div>

        <div className="p-3">
          {!hasActiveFilters && suggested.length > 0 && showBrowseCatalog && (
            <div className="mb-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-800">
                <Sparkles size={12} />
                Suggested
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {suggested.map((t) => renderPackageCard(t, true))}
              </div>
            </div>
          )}

          {!showBrowseCatalog ? (
            <CounsellingEmptyState
              compact
              title={counsellingCopy.selectCategoryToBrowse}
            />
          ) : browseList.length === 0 ? (
            <CounsellingEmptyState
              compact
              title="No packages match"
            />
          ) : (
            <>
              {!hasActiveFilters && suggested.length > 0 && browseList.length > 0 && (
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-counselling-muted-foreground">
                  All packages
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {browseList.map((t) => renderPackageCard(t, false))}
              </div>
            </>
          )}
        </div>
        <p className="border-t border-counselling-border/60 px-3 py-1.5 text-[10px] text-counselling-muted-foreground">
          {filteredPackages.length} package{filteredPackages.length === 1 ? '' : 's'}
        </p>
      </div>
    </>
  );

  if (embedded) return content;

  return (
    <section
      id="counselling-step-2"
      className="scroll-mt-24 rounded-xl border border-counselling-border bg-counselling-card p-4 shadow-sm"
    >
      {content}
    </section>
  );
}
