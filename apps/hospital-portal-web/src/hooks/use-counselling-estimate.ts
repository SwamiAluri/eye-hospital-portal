'use client';

import { useCallback, useMemo, useRef } from 'react';
import type { IolMasterDto } from '@/lib/api/service-catalog.api';
import type { CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import {
  buildPackageApplyPatch,
  buildPackageRestorePatch,
  clearPackageEstimatePatch,
  computeEstimateResult,
  mergeEstimateState,
  shouldClearPackageOnChange,
  type EstimateLine,
  type SelectionChangeKind,
} from '@/lib/counsellors-desk/estimate-engine';
import type {
  CounsellingDiscountType,
  CounsellingEstimateMode,
  CounsellingEstimateState,
  CounsellingPackageTemplate,
  CounsellingSettings,
} from '@/types/counselling-estimate';
import type { InvestigationItem, MasterCatalogItem } from '@/types/counsellors-desk';

export interface UseCounsellingEstimateParams {
  estimate: CounsellingEstimateState;
  onEstimateChange: (patch: Partial<CounsellingEstimateState>) => void;
  procedureVariants: CounsellorProcedureVariant[];
  selectedVariantId: string | null;
  selectedSurgeryId: string | null;
  selectedIolId: string | null;
  selectedEye: 'RE' | 'LE' | 'BE';
  variantSubOption: string | null;
  selectedInvestigations: Map<string, InvestigationItem>;
  iolOptions: IolMasterDto[];
  procedureOverridePrice?: number | null;
  packageTemplates: CounsellingPackageTemplate[];
  settings: CounsellingSettings;
  masterCatalog: {
    imaging: MasterCatalogItem[];
    scan: MasterCatalogItem[];
    lab: MasterCatalogItem[];
  };
  onPackageApply?: (patch: ReturnType<typeof buildPackageApplyPatch>) => void;
  onPackageClear?: () => void;
}

export interface UseCounsellingEstimateResult {
  lines: EstimateLine[];
  itemizedSubtotal: number;
  bundleSavings: number;
  baseBeforeDiscount: number;
  finalPayableAmount: number;
  discountAmount: number;
  discountExceeded: boolean;
  effectiveMaxDiscountPercent: number;
  maxDiscountAmount: number;
  tenantMaxDiscountFlat: number | null;
  isPackageMode: boolean;
  activeTemplate: CounsellingPackageTemplate | null;
  mergedEstimate: CounsellingEstimateState;
  selectPackage: (templateId: string) => void;
  /** Session load: fill missing package selections without wiping discount or investigations. */
  restorePackage: (templateId: string) => boolean;
  setEstimateMode: (mode: CounsellingEstimateMode) => void;
  setDiscount: (patch: {
    discountType?: CounsellingDiscountType | null;
    discountValue?: number;
    discountReason?: string;
  }) => void;
  notifySelectionChange: (kind: SelectionChangeKind) => void;
  isApplyingPackage: () => boolean;
}

export function useCounsellingEstimate(
  params: UseCounsellingEstimateParams,
): UseCounsellingEstimateResult {
  const applyingPackageRef = useRef(false);

  const selectedProcedure = useMemo(
    () => params.procedureVariants.find((v) => v.id === params.selectedVariantId) ?? null,
    [params.procedureVariants, params.selectedVariantId],
  );

  const selectedIol = useMemo(
    () => params.iolOptions.find((i) => i.id === params.selectedIolId) ?? null,
    [params.iolOptions, params.selectedIolId],
  );

  const investigationsList = useMemo(
    () => Array.from(params.selectedInvestigations.values()),
    [params.selectedInvestigations],
  );

  const activeTemplate = useMemo(
    () =>
      params.packageTemplates.find((t) => t.id === params.estimate.packageTemplateId) ?? null,
    [params.packageTemplates, params.estimate.packageTemplateId],
  );

  const computed = useMemo(
    () =>
      computeEstimateResult({
        estimateMode: params.estimate.estimateMode,
        packageTemplate: activeTemplate,
        procedure: selectedProcedure,
        procedureOverridePrice: params.procedureOverridePrice,
        procedureFallbackLabel: selectedProcedure?.name,
        iol: selectedIol,
        investigations: investigationsList,
        selectedEye: params.selectedEye,
        discountType: params.estimate.discountType,
        discountValue: params.estimate.discountValue,
        settings: params.settings,
      }),
    [
      params.estimate.estimateMode,
      params.estimate.discountType,
      params.estimate.discountValue,
      params.settings,
      activeTemplate,
      selectedProcedure,
      params.procedureOverridePrice,
      selectedIol,
      investigationsList,
      params.selectedEye,
    ],
  );

  const mergedEstimate = useMemo(
    () => mergeEstimateState(params.estimate, computed),
    [params.estimate, computed],
  );

  const clearPackageIfNeeded = useCallback(
    (kind: SelectionChangeKind) => {
      if (applyingPackageRef.current) return;
      if (params.estimate.estimateMode !== 'package' || !params.estimate.packageTemplateId) {
        return;
      }
      if (!shouldClearPackageOnChange(kind)) return;
      params.onEstimateChange(clearPackageEstimatePatch());
      params.onPackageClear?.();
    },
    [params],
  );

  const notifySelectionChange = useCallback(
    (kind: SelectionChangeKind) => {
      clearPackageIfNeeded(kind);
    },
    [clearPackageIfNeeded],
  );

  const selectPackage = useCallback(
    (templateId: string) => {
      const template = params.packageTemplates.find((t) => t.id === templateId);
      if (!template) return;

      applyingPackageRef.current = true;
      try {
        const patch = buildPackageApplyPatch(template, params.masterCatalog);
        params.onEstimateChange(patch.estimate);
        params.onPackageApply?.(patch);
      } finally {
        applyingPackageRef.current = false;
      }
    },
    [params],
  );

  const restorePackage = useCallback(
    (templateId: string) => {
      const template = params.packageTemplates.find((t) => t.id === templateId);
      if (!template) return false;

      applyingPackageRef.current = true;
      try {
        const patch = buildPackageRestorePatch(template, params.masterCatalog, {
          estimate: params.estimate,
          selectedVariantId: params.selectedVariantId,
          selectedIolId: params.selectedIolId,
          selectedEye: params.selectedEye,
          variantSubOption: params.variantSubOption,
          selectedSurgeryId: params.selectedSurgeryId,
          investigations: params.selectedInvestigations,
        });
        params.onEstimateChange(patch.estimate);
        params.onPackageApply?.(patch);
        return true;
      } finally {
        applyingPackageRef.current = false;
      }
    },
    [params],
  );

  const setEstimateMode = useCallback(
    (mode: CounsellingEstimateMode) => {
      if (mode === 'custom') {
        const hadPackage = !!params.estimate.packageTemplateId;
        params.onEstimateChange(clearPackageEstimatePatch());
        if (hadPackage) params.onPackageClear?.();
        return;
      }
      params.onEstimateChange({ estimateMode: mode });
    },
    [params],
  );

  const setDiscount = useCallback(
    (patch: {
      discountType?: CounsellingDiscountType | null;
      discountValue?: number;
      discountReason?: string;
    }) => {
      params.onEstimateChange(patch);
    },
    [params.onEstimateChange],
  );

  const isApplyingPackage = useCallback(() => applyingPackageRef.current, []);

  return {
    lines: computed.lines,
    itemizedSubtotal: computed.itemizedSubtotal,
    bundleSavings: computed.bundleSavings,
    baseBeforeDiscount: computed.baseBeforeDiscount,
    finalPayableAmount: computed.finalPayableAmount,
    discountAmount: computed.discount.discountAmount,
    discountExceeded: computed.discount.discountExceeded,
    effectiveMaxDiscountPercent: computed.discount.effectiveMaxPercent,
    maxDiscountAmount: computed.discount.maxDiscountAmount,
    tenantMaxDiscountFlat:
      params.settings.maxDiscountFlat != null && params.settings.maxDiscountFlat >= 0
        ? params.settings.maxDiscountFlat
        : null,
    isPackageMode: params.estimate.estimateMode === 'package' && !!activeTemplate,
    activeTemplate,
    mergedEstimate,
    selectPackage,
    restorePackage,
    setEstimateMode,
    setDiscount,
    notifySelectionChange,
    isApplyingPackage,
  };
}
