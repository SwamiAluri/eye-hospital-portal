import type { IolMasterDto } from '@/lib/api/service-catalog.api';
import type { CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import type {
  CounsellingDiscountType,
  CounsellingEstimateMode,
  CounsellingEstimateState,
  CounsellingPackageTemplate,
  CounsellingSettings,
} from '@/types/counselling-estimate';
import type { InvestigationItem, MasterCatalogItem } from '@/types/counsellors-desk';
import { sanitizeVariantName } from '@/lib/utils/sanitize-names';

export type SelectionChangeKind =
  | 'procedure'
  | 'iol'
  | 'subOption'
  | 'investigation'
  | 'eye'
  | 'package-select';

export interface EstimateLine {
  key: string;
  label: string;
  detail?: string;
  amount: number;
  kind: 'procedure' | 'iol' | 'investigation';
}

export interface DiscountCapResult {
  effectiveMaxPercent: number;
  maxDiscountAmount: number;
  discountAmount: number;
  discountExceeded: boolean;
  requestedDiscountAmount: number;
}

export interface ComputeEstimateInput {
  estimateMode: CounsellingEstimateMode;
  packageTemplate: CounsellingPackageTemplate | null;
  /** When set in package mode, replaces catalog packageAmount for payable base. */
  packageOverridePrice?: number | null;
  procedure: CounsellorProcedureVariant | null;
  procedureOverridePrice?: number | null;
  procedureFallbackLabel?: string | null;
  iol: IolMasterDto | null;
  investigations: InvestigationItem[];
  selectedEye?: 'RE' | 'LE' | 'BE';
  discountType: CounsellingDiscountType | null;
  discountValue: number;
  settings: CounsellingSettings;
}

export interface GroupedEstimateLines {
  procedurePackage: EstimateLine[];
  imaging: EstimateLine[];
  labs: EstimateLine[];
}

/** Group quote lines for counsellor-facing itemized breakdown. */
export function groupEstimateLinesForDisplay(lines: EstimateLine[]): GroupedEstimateLines {
  const procedurePackage = lines.filter((l) => l.kind === 'procedure' || l.kind === 'iol');
  const imaging = lines.filter(
    (l) => l.kind === 'investigation' && (l.detail === 'Imaging' || l.detail === 'Scan'),
  );
  const labs = lines.filter((l) => l.kind === 'investigation' && l.detail === 'Lab');
  return { procedurePackage, imaging, labs };
}

export interface ComputeEstimateResult {
  lines: EstimateLine[];
  itemizedSubtotal: number;
  bundleSavings: number;
  baseBeforeDiscount: number;
  discount: DiscountCapResult;
  finalPayableAmount: number;
}

/** Changes that break package binding (investigation / eye / package-select do not). */
export function shouldClearPackageOnChange(kind: SelectionChangeKind): boolean {
  return kind === 'procedure' || kind === 'iol' || kind === 'subOption';
}

export function clearPackageEstimatePatch(): Partial<CounsellingEstimateState> {
  return {
    estimateMode: 'custom',
    packageTemplateId: null,
  };
}

export function effectiveMaxDiscountPercent(
  settings: CounsellingSettings,
  template: CounsellingPackageTemplate | null,
  mode: CounsellingEstimateMode,
): number {
  const tenantCap = Math.max(0, Math.min(100, settings.maxDiscountPercent ?? 50));
  if (mode !== 'package' || !template) return tenantCap;
  const pkgCap = Math.max(0, Math.min(100, template.maxDiscountPercent ?? 100));
  return Math.min(tenantCap, pkgCap);
}

export function computeDiscountAmount(params: {
  baseBeforeDiscount: number;
  discountType: CounsellingDiscountType | null;
  discountValue: number;
  effectiveMaxPercent: number;
  maxDiscountFlat?: number | null;
}): DiscountCapResult {
  const base = Math.max(0, params.baseBeforeDiscount);
  const maxPercent = Math.max(0, Math.min(100, params.effectiveMaxPercent));
  const maxDiscountAmount = Math.min(
    base,
    base * (maxPercent / 100),
    params.maxDiscountFlat != null && params.maxDiscountFlat >= 0
      ? params.maxDiscountFlat
      : Number.POSITIVE_INFINITY,
  );

  let requested = 0;
  if (params.discountType === 'percent') {
    const pct = Math.max(0, Math.min(100, params.discountValue));
    requested = base * (pct / 100);
  } else if (params.discountType === 'flat') {
    requested = Math.max(0, params.discountValue);
  }

  const discountAmount = Math.min(requested, maxDiscountAmount);
  return {
    effectiveMaxPercent: maxPercent,
    maxDiscountAmount,
    discountAmount,
    discountExceeded: requested > maxDiscountAmount + 0.009,
    requestedDiscountAmount: requested,
  };
}

export function computeItemizedLines(input: {
  procedure: CounsellorProcedureVariant | null;
  procedureOverridePrice?: number | null;
  procedureFallbackLabel?: string | null;
  iol: IolMasterDto | null;
  investigations: InvestigationItem[];
  defaultEye?: 'RE' | 'LE' | 'BE';
}): { lines: EstimateLine[]; subtotal: number } {
  const lines: EstimateLine[] = [];
  let subtotal = 0;

  if (input.procedure) {
    const amount =
      input.procedureOverridePrice != null && input.procedureOverridePrice > 0
        ? input.procedureOverridePrice
        : input.procedure.price;
    lines.push({
      key: 'procedure',
      label: sanitizeVariantName(input.procedure.name),
      detail: input.defaultEye ?? 'RE',
      amount,
      kind: 'procedure',
    });
    subtotal += amount;
  } else if (input.procedureOverridePrice != null && input.procedureOverridePrice > 0) {
    const amount = input.procedureOverridePrice;
    const label = sanitizeVariantName(input.procedureFallbackLabel?.trim() || 'Procedure');
    lines.push({
      key: 'procedure',
      label,
      detail: input.defaultEye ?? 'RE',
      amount,
      kind: 'procedure',
    });
    subtotal += amount;
  }

  if (input.iol) {
    // Single charge: procedure carries the payable; selected IOL is listed as included.
    const brand = sanitizeVariantName(input.iol.brandManufacturer);
    lines.push({
      key: `iol-${input.iol.id}`,
      label: sanitizeVariantName(input.iol.modelName),
      detail: brand ? `${brand} · Included` : 'Included',
      amount: 0,
      kind: 'iol',
    });
  }

  for (const inv of input.investigations) {
    lines.push({
      key: inv.catalogId ?? inv.id ?? inv.testName,
      label: sanitizeVariantName(inv.testName),
      detail: inv.testType,
      amount: inv.price ?? 0,
      kind: 'investigation',
    });
    subtotal += inv.price ?? 0;
  }

  return { lines, subtotal };
}

export function computeEstimateResult(input: ComputeEstimateInput): ComputeEstimateResult {
  const { lines, subtotal: itemizedSubtotal } = computeItemizedLines({
    procedure: input.procedure,
    procedureOverridePrice: input.procedureOverridePrice,
    procedureFallbackLabel: input.procedureFallbackLabel ?? input.procedure?.name,
    iol: input.iol,
    investigations: input.investigations,
    defaultEye: input.selectedEye,
  });

  const isPackage = input.estimateMode === 'package' && !!input.packageTemplate;
  const catalogPackageAmount = isPackage ? Math.max(0, input.packageTemplate!.packageAmount) : 0;
  const packageAmount =
    isPackage &&
    input.packageOverridePrice != null &&
    input.packageOverridePrice > 0
      ? Math.max(0, input.packageOverridePrice)
      : catalogPackageAmount;
  const bundleSavings =
    isPackage && itemizedSubtotal > packageAmount ? itemizedSubtotal - packageAmount : 0;
  const baseBeforeDiscount = isPackage ? packageAmount : itemizedSubtotal;

  const effectiveMaxPercent = effectiveMaxDiscountPercent(
    input.settings,
    input.packageTemplate,
    input.estimateMode,
  );

  const discount = computeDiscountAmount({
    baseBeforeDiscount,
    discountType: input.discountType,
    discountValue: input.discountValue,
    effectiveMaxPercent,
    maxDiscountFlat: input.settings.maxDiscountFlat,
  });

  const finalPayableAmount = Math.max(0, baseBeforeDiscount - discount.discountAmount);

  return {
    lines,
    itemizedSubtotal,
    bundleSavings,
    baseBeforeDiscount,
    discount,
    finalPayableAmount,
  };
}

/** Build investigation selection map from package template IDs. */
export function investigationMapFromTemplateIds(
  ids: string[],
  catalog: { imaging: MasterCatalogItem[]; scan: MasterCatalogItem[]; lab: MasterCatalogItem[] },
  defaultEye: 'RE' | 'LE' | 'BE' = 'RE',
): Map<string, InvestigationItem> {
  const all = [...catalog.imaging, ...catalog.scan, ...catalog.lab];
  const byId = new Map(all.map((i) => [i.id, i]));
  const map = new Map<string, InvestigationItem>();

  for (const id of ids) {
    const item = byId.get(id);
    if (!item) continue;
    map.set(id, {
      catalogId: id,
      testName: item.name,
      testCode: item.code,
      testType: item.testType,
      price: item.price,
      urgency: 'Routine',
      source: 'counsellor',
      ...(item.testType !== 'Lab' ? { eye: defaultEye } : {}),
    });
  }

  return map;
}

/** Patch for applying a package template to session selection + legacy package fields. */
export interface PackageApplyPatch {
  estimate: Partial<CounsellingEstimateState>;
  selectedVariantId: string | null;
  selectedIolId: string | null;
  selectedEye: 'RE' | 'LE' | 'BE';
  variantSubOption: string | null;
  selectedSurgeryId: string | null;
  investigations: Map<string, InvestigationItem>;
  packageName: string;
  packageRate: number;
}

export interface PackageRestoreContext {
  estimate: CounsellingEstimateState;
  selectedVariantId: string | null;
  selectedIolId: string | null;
  selectedEye: 'RE' | 'LE' | 'BE';
  variantSubOption: string | null;
  selectedSurgeryId: string | null;
  investigations: Map<string, InvestigationItem>;
}

/** Re-hydrate package selections on session load — preserves discount and saved investigations. */
export function buildPackageRestorePatch(
  template: CounsellingPackageTemplate,
  catalog: { imaging: MasterCatalogItem[]; scan: MasterCatalogItem[]; lab: MasterCatalogItem[] },
  current: PackageRestoreContext,
): PackageApplyPatch {
  const base = buildPackageApplyPatch(template, catalog);
  const eye = current.selectedVariantId ? current.selectedEye : base.selectedEye;
  const variantId = current.selectedVariantId ?? base.selectedVariantId;

  return {
    ...base,
    estimate: {
      estimateMode: 'package',
      packageTemplateId: template.id,
      discountType: current.estimate.discountType,
      discountValue: current.estimate.discountValue,
      discountReason: current.estimate.discountReason,
    },
    selectedVariantId: variantId,
    selectedIolId: current.selectedIolId ?? base.selectedIolId,
    selectedEye: eye,
    variantSubOption: current.variantSubOption ?? base.variantSubOption,
    selectedSurgeryId:
      current.selectedSurgeryId
      ?? (variantId ? `type-${variantId}-${eye}` : base.selectedSurgeryId),
    investigations:
      current.investigations.size > 0 ? new Map(current.investigations) : base.investigations,
    packageName: template.name,
    packageRate: template.packageAmount,
  };
}

export function buildPackageApplyPatch(
  template: CounsellingPackageTemplate,
  catalog: { imaging: MasterCatalogItem[]; scan: MasterCatalogItem[]; lab: MasterCatalogItem[] },
): PackageApplyPatch {
  const eye = template.defaultEye ?? 'RE';
  const variantId = template.procedureVariantId ?? null;
  const investigations = investigationMapFromTemplateIds(
    template.investigationIds ?? [],
    catalog,
    eye,
  );

  return {
    estimate: {
      estimateMode: 'package',
      packageTemplateId: template.id,
      discountType: null,
      discountValue: 0,
      discountReason: '',
    },
    selectedVariantId: variantId,
    selectedIolId: template.iolId ?? null,
    selectedEye: eye,
    variantSubOption: template.variantSubOption ?? null,
    selectedSurgeryId: variantId ? `type-${variantId}-${eye}` : null,
    investigations,
    packageName: template.name,
    packageRate: template.packageAmount,
  };
}

export function mergeEstimateState(
  base: CounsellingEstimateState,
  computed: ComputeEstimateResult,
): CounsellingEstimateState {
  const hasProcedureLine = computed.lines.some(
    (line) => line.kind === 'procedure' || line.kind === 'iol',
  );
  const savedFinal = base.finalPayableAmount ?? 0;
  const liveFinal = computed.finalPayableAmount;
  const finalPayableAmount = hasProcedureLine
    ? liveFinal
    : liveFinal > 0
      ? savedFinal > liveFinal
        ? savedFinal
        : liveFinal
      : savedFinal > 0
        ? savedFinal
        : liveFinal;

  return {
    ...base,
    itemizedSubtotal: computed.itemizedSubtotal,
    bundleSavings: computed.bundleSavings,
    discountAmount: computed.discount.discountAmount,
    finalPayableAmount,
  };
}
