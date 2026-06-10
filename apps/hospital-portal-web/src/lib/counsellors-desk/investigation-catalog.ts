import type { FullCatalogResponse } from '@/lib/api/service-catalog.api';
import type { MasterCatalogItem } from '@/types/counsellors-desk';

export const INVESTIGATION_CATALOG_CATEGORY_CODES = ['DIAGNOSTICS', 'INVESTIGATIONS'] as const;

/** Service Catalog filter value — shows DIAGNOSTICS + INVESTIGATIONS together. */
export const INVESTIGATION_CATALOG_FILTER = 'investigations';

export function isInvestigationCategoryCode(code: string): boolean {
  return (INVESTIGATION_CATALOG_CATEGORY_CODES as readonly string[]).includes(code);
}

export function matchesServiceCatalogCategoryFilter(categoryCode: string, filter: string): boolean {
  if (filter === 'ALL') return true;
  if (filter === INVESTIGATION_CATALOG_FILTER) return isInvestigationCategoryCode(categoryCode);
  return categoryCode === filter;
}

/** Parse ?category= from Service Catalog URL (investigations | DIAGNOSTICS | INVESTIGATIONS | …). */
export function parseServiceCatalogCategoryParam(param: string | null): string {
  if (!param) return INVESTIGATION_CATALOG_FILTER;
  if (param.toLowerCase() === INVESTIGATION_CATALOG_FILTER) return INVESTIGATION_CATALOG_FILTER;
  const upper = param.toUpperCase();
  if (upper === 'DIAGNOSTICS' || upper === 'INVESTIGATIONS' || upper === 'SURGERY') return upper;
  return INVESTIGATION_CATALOG_FILTER;
}

const DEFAULT_DIAGNOSTICS_UI_CATEGORY = 'Diagnostic Scans';

/** Lab variant codes → counsellor investigation panel grouping (fallback). */
function labUiCategoryFromCode(variantCode: string): string | null {
  if (variantCode === 'LAB-VIRAL') return 'Viral Markers';
  if (variantCode === 'LAB-ECG' || variantCode === 'LAB-CXR') return 'Cardiac Investigations';
  if (variantCode === 'LAB-CBC' || variantCode === 'LAB-BG' || variantCode === 'LAB-URINE') {
    return 'General Investigations';
  }
  return null;
}

function labUiCategory(variantCode: string, serviceName: string): string {
  const fromCode = labUiCategoryFromCode(variantCode);
  if (fromCode) return fromCode;
  const trimmed = serviceName.trim();
  if (trimmed && trimmed !== 'Pre-Op Laboratory Tests') return trimmed;
  return 'Pre-Operative Panel';
}

function diagnosticsUiCategory(serviceName: string): string {
  const trimmed = serviceName.trim();
  if (!trimmed || trimmed === 'Ophthalmic Diagnostics') return DEFAULT_DIAGNOSTICS_UI_CATEGORY;
  return trimmed;
}

function variantsFromCategory(
  catalog: FullCatalogResponse,
  categoryCode: string,
): MasterCatalogItem[] {
  const cat = catalog.categories.find((c) => c.code === categoryCode && c.isActive !== false);
  if (!cat) return [];

  const items: MasterCatalogItem[] = [];

  cat.services
    .filter((svc) => svc.isActive !== false)
    .forEach((svc) => {
      svc.variants
        .filter((v) => v.isActive !== false)
        .forEach((v) => {
          if (categoryCode === 'DIAGNOSTICS') {
            items.push({
              id: v.id,
              name: v.name,
              code: v.code,
              category: diagnosticsUiCategory(svc.name),
              testType: 'Imaging',
              price: v.price,
            });
          } else {
            items.push({
              id: v.id,
              name: v.name,
              code: v.code,
              category: labUiCategory(v.code, svc.name),
              testType: 'Lab',
              price: v.price,
            });
          }
        });
    });

  return items;
}

/**
 * Build counsellor investigation picker lists from Service Catalog only (B2).
 * Legacy `/Counseling/master-catalog` is no longer used.
 */
export function buildInvestigationCatalogFromServiceCatalog(
  catalog: FullCatalogResponse,
): { imaging: MasterCatalogItem[]; scan: MasterCatalogItem[]; lab: MasterCatalogItem[] } {
  const imaging = variantsFromCategory(catalog, 'DIAGNOSTICS');
  const lab = variantsFromCategory(catalog, 'INVESTIGATIONS');
  return { imaging, scan: [], lab };
}
