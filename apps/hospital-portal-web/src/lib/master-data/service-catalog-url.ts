import {
  INVESTIGATION_CATALOG_FILTER,
  isInvestigationCategoryCode,
  parseServiceCatalogCategoryParam,
} from '@/lib/counsellors-desk/investigation-catalog';

export type ServiceCatalogMode = 'investigations' | 'surgery' | 'iol' | 'branch';

const MODES: ServiceCatalogMode[] = ['investigations', 'surgery', 'iol', 'branch'];

export function parseServiceCatalogMode(params: URLSearchParams): ServiceCatalogMode {
  const mode = params.get('mode')?.toLowerCase();
  if (mode && MODES.includes(mode as ServiceCatalogMode)) {
    return mode as ServiceCatalogMode;
  }
  const category = params.get('category');
  if (category?.toLowerCase() === INVESTIGATION_CATALOG_FILTER) {
    return 'investigations';
  }
  return 'investigations';
}

/** Investigation / surgery tab category chip filter. */
export function parseServiceCatalogFilterParam(params: URLSearchParams, mode: ServiceCatalogMode): string {
  const raw = params.get('filter') ?? params.get('category');
  if (mode === 'investigations') {
    if (raw) return parseServiceCatalogCategoryParam(raw);
    return INVESTIGATION_CATALOG_FILTER;
  }
  if (mode === 'surgery') {
    if (raw && raw !== INVESTIGATION_CATALOG_FILTER) {
      const upper = raw.toUpperCase();
      if (upper === 'ALL' || upper === 'PROCEDURES') return 'ALL';
      return upper;
    }
    return 'ALL';
  }
  return 'ALL';
}

export function buildServiceCatalogSearchParams(mode: ServiceCatalogMode, filter: string): string {
  const p = new URLSearchParams();
  p.set('mode', mode);
  if (mode === 'investigations' && filter !== 'ALL') {
    p.set('filter', filter);
  } else if (mode === 'surgery' && filter !== 'ALL') {
    p.set('filter', filter);
  }
  return p.toString();
}

/** Surgery tab: all catalog variants except investigation categories. */
export function matchesSurgeryCatalogFilter(categoryCode: string, filter: string): boolean {
  if (isInvestigationCategoryCode(categoryCode)) return false;
  if (filter === 'ALL') return true;
  return categoryCode === filter;
}

export function investigationTypeLabel(categoryCode: string): 'Imaging' | 'Lab' | null {
  if (categoryCode === 'DIAGNOSTICS') return 'Imaging';
  if (categoryCode === 'INVESTIGATIONS') return 'Lab';
  return null;
}
