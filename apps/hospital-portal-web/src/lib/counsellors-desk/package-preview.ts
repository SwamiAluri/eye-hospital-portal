import type { PriceOverrideRecord } from '@/lib/api/counselling-azure.api';
import type { FlatVariantDto, IolMasterDto } from '@/lib/api/service-catalog.api';
import type { MasterCatalogItem } from '@/types/counsellors-desk';
import { priceSuffix } from '@/lib/api/service-catalog.api';

export interface PackagePreviewLine {
  key: string;
  label: string;
  detail?: string;
  amount: number;
}

export interface PackagePreviewResult {
  lines: PackagePreviewLine[];
  itemizedTotal: number;
  packageAmount: number;
  bundleSavings: number;
}

export function computePackagePreview(params: {
  packageAmount: number;
  procedure?: FlatVariantDto | null;
  iol?: IolMasterDto | null;
  investigations?: MasterCatalogItem[];
  defaultEye?: 'RE' | 'LE' | 'BE';
}): PackagePreviewResult {
  const lines: PackagePreviewLine[] = [];
  let itemizedTotal = 0;

  if (params.procedure) {
    const suffix = priceSuffix(params.procedure.priceType);
    lines.push({
      key: 'procedure',
      label: params.procedure.name,
      detail: params.defaultEye ?? 'RE',
      amount: params.procedure.price,
    });
    itemizedTotal += params.procedure.price;
  }

  if (params.iol) {
    lines.push({
      key: 'iol',
      label: params.iol.modelName,
      detail: params.iol.brandManufacturer,
      amount: params.iol.price,
    });
    itemizedTotal += params.iol.price;
  }

  for (const inv of params.investigations ?? []) {
    lines.push({
      key: inv.id,
      label: inv.name,
      detail: inv.category,
      amount: inv.price ?? 0,
    });
    itemizedTotal += inv.price ?? 0;
  }

  const packageAmount = Math.max(0, params.packageAmount || 0);
  const bundleSavings = itemizedTotal > packageAmount ? itemizedTotal - packageAmount : 0;

  return { lines, itemizedTotal, packageAmount, bundleSavings };
}

/** Most recent active override for a specific procedure variant, if any. */
export function resolveProcedureOverride(
  overrides: PriceOverrideRecord[],
  selectedVariantId: string | null | undefined,
): PriceOverrideRecord | null {
  if (!selectedVariantId || overrides.length === 0) return null;
  const matches = overrides.filter((o) => o.variantId === selectedVariantId);
  if (matches.length === 0) return null;
  return matches.reduce((latest, o) =>
    new Date(o.createdAt) > new Date(latest.createdAt) ? o : latest,
  );
}

export function resolveProcedureOverridePrice(
  overrides: PriceOverrideRecord[],
  selectedVariantId: string | null | undefined,
): number | null {
  return resolveProcedureOverride(overrides, selectedVariantId)?.overriddenPrice ?? null;
}

/** True when counsellor quoted price differs from catalog procedure price. */
export function hasQuotedProcedureOverride(
  catalogPrice: number,
  quotedPrice?: number | null,
): quotedPrice is number {
  return (
    quotedPrice != null &&
    quotedPrice > 0 &&
    catalogPrice > 0 &&
    Math.abs(catalogPrice - quotedPrice) > 0.009
  );
}

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function packageIncludedItemCount(template: {
  procedureVariantId?: string | null;
  iolId?: string | null;
  investigationIds?: string[];
}): number {
  let count = 0;
  if (template.procedureVariantId) count += 1;
  if (template.iolId) count += 1;
  count += template.investigationIds?.length ?? 0;
  return count;
}

export function hasDoctorRecommendationConflict(
  recommendedVariantIds: string[],
  selectedVariantId: string | null,
): boolean {
  if (recommendedVariantIds.length === 0 || !selectedVariantId) return false;
  return !recommendedVariantIds.includes(selectedVariantId);
}

export function partitionPackageTemplates(
  templates: Array<{
    id: string;
    procedureVariantId?: string | null;
    category?: string | null;
    isDefault?: boolean;
    sortOrder?: number;
    isActive?: boolean;
  }>,
  recommendedVariantIds: string[],
  doctorRecommendationCategory?: string | null,
): { suggested: typeof templates; rest: typeof templates } {
  const active = templates.filter((t) => t.isActive !== false);
  const recommended = new Set(recommendedVariantIds);

  const suggested = active.filter(
    (t) =>
      (t.procedureVariantId && recommended.has(t.procedureVariantId)) ||
      (t.isDefault &&
        doctorRecommendationCategory &&
        (t.category ?? '').toLowerCase() === doctorRecommendationCategory.toLowerCase()),
  );

  const suggestedIds = new Set(suggested.map((t) => t.id));
  const rest = active.filter((t) => !suggestedIds.has(t.id));

  const bySort = (a: (typeof templates)[number], b: (typeof templates)[number]) =>
    (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
    (a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1);

  return {
    suggested: [...suggested].sort(bySort),
    rest: [...rest].sort(bySort),
  };
}
