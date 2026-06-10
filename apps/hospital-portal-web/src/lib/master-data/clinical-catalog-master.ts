import type { MasterOption } from '@/hooks/use-master-values';
import type { FlatVariantDto, IolMasterDto } from '@/lib/api/service-catalog.api';

export interface CatalogSurgeryMetadata {
  syncedFromCatalog?: boolean;
  catalogVariantId?: string;
  catalogServiceId?: string;
  catalogServiceCode?: string;
  categoryCode?: string;
  categoryName?: string;
  priceType?: string;
  hasIolOptions?: boolean;
  catalogActive?: boolean;
}

export interface CatalogIolMetadata {
  syncedFromCatalog?: boolean;
  catalogIolId?: string;
  manufacturer?: string;
  model?: string;
  lens_type?: string;
  origin?: string;
  productCode?: string;
  sphere_power_min?: number;
  sphere_power_max?: number;
  catalogActive?: boolean;
}

export function isCatalogSyncedOption(option: MasterOption): boolean {
  return option.metadata?.syncedFromCatalog === true;
}

export function catalogVariantId(option: MasterOption): string | undefined {
  const id = option.metadata?.catalogVariantId;
  return typeof id === 'string' ? id : undefined;
}

export function catalogIolId(option: MasterOption): string | undefined {
  const id = option.metadata?.catalogIolId;
  return typeof id === 'string' ? id : undefined;
}

export interface SurgeryTypeWithPricing extends MasterOption {
  variant?: FlatVariantDto;
}

export interface IolOptionWithPricing extends MasterOption {
  iol?: IolMasterDto;
}

/** Join master surgery options to catalog variants for branch/global pricing. */
export function joinMasterSurgeryWithCatalog(
  masterOptions: MasterOption[],
  flatVariants: FlatVariantDto[],
): SurgeryTypeWithPricing[] {
  const byId = new Map(flatVariants.map((v) => [v.id, v]));
  return masterOptions.map((option) => {
    const vid = catalogVariantId(option);
    return { ...option, variant: vid ? byId.get(vid) : undefined };
  });
}

/** Join master IOL options to catalog IOL DTOs (pricing from catalog API). */
export function joinMasterIolWithCatalog(
  masterOptions: MasterOption[],
  iolDtos: IolMasterDto[],
): IolOptionWithPricing[] {
  const byId = new Map(iolDtos.map((i) => [i.id, i]));
  return masterOptions.map((option) => {
    const iid = catalogIolId(option);
    return { ...option, iol: iid ? byId.get(iid) : undefined };
  });
}

/** Flat variant for counsellor UI: master label + catalog pricing fields. */
export type CounsellorProcedureVariant = FlatVariantDto & { defaultPrice: number };

const DEFAULT_EXCLUDED_CATEGORIES = new Set(['DIAGNOSTICS', 'INVESTIGATIONS']);

/** Active master surgery rows joined to catalog variants (pricing from catalog). */
export function buildCounsellorFlatVariants(
  items: SurgeryTypeWithPricing[],
  excludeCategoryCodes: Set<string> = DEFAULT_EXCLUDED_CATEGORIES,
): CounsellorProcedureVariant[] {
  return items
    .filter((item) => item.variant?.isActive !== false)
    .map((item) => {
      const variant = item.variant;
      if (!variant) return null;
      const categoryCode =
        variant.categoryCode || String(item.metadata?.categoryCode ?? '');
      if (excludeCategoryCodes.has(categoryCode.toUpperCase())) return null;
      return {
        ...variant,
        name: item.label,
        categoryCode,
        categoryName:
          variant.categoryName || String(item.metadata?.categoryName ?? categoryCode),
        defaultPrice: variant.price,
      } satisfies CounsellorProcedureVariant;
    })
    .filter((v): v is CounsellorProcedureVariant => v !== null);
}

export function findCounsellorVariant(
  variants: CounsellorProcedureVariant[],
  variantId: string | null | undefined,
): CounsellorProcedureVariant | undefined {
  if (!variantId) return undefined;
  return variants.find((v) => v.id === variantId);
}

export function deriveProcedureCategoryFilters(
  variants: CounsellorProcedureVariant[],
): Array<{ code: string; name: string }> {
  const map = new Map<string, string>();
  variants.forEach((v) => {
    if (v.categoryCode) {
      map.set(v.categoryCode, v.categoryName || v.categoryCode);
    }
  });
  return Array.from(map.entries())
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Master IOL labels with catalog pricing for counsellor lens picker. */
export function buildCounsellorIolDtos(items: IolOptionWithPricing[]): IolMasterDto[] {
  return items
    .filter((item) => item.iol)
    .map((item) => {
      const iol = item.iol!;
      const meta = item.metadata as CatalogIolMetadata | undefined;
      return {
        ...iol,
        modelName: item.label || iol.modelName,
        brandManufacturer: meta?.manufacturer
          ? String(meta.manufacturer)
          : iol.brandManufacturer,
      };
    });
}
