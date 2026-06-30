import type {
  CounsellingEstimateState,
  CounsellingPackageAddonsBlob,
} from '@/types/counselling-estimate';
import { EMPTY_COUNSELLING_ESTIMATE } from '@/types/counselling-estimate';

/** Parse estimate fields from the counsellor package_addons_json blob. */
export function parseEstimateFromBlob(
  blob: CounsellingPackageAddonsBlob | null | undefined,
): CounsellingEstimateState {
  if (!blob) return { ...EMPTY_COUNSELLING_ESTIMATE };

  return {
    estimateMode: blob.estimateMode === 'package' ? 'package' : 'custom',
    packageTemplateId: blob.packageTemplateId ?? null,
    discountType: blob.discountType === 'flat' || blob.discountType === 'percent'
      ? blob.discountType
      : null,
    discountValue: Number(blob.discountValue) || 0,
    discountReason: blob.discountReason ?? '',
    discountAmount: Number(blob.discountAmount) || 0,
    itemizedSubtotal: Number(blob.itemizedSubtotal) || 0,
    bundleSavings: Number(blob.bundleSavings) || 0,
    finalPayableAmount: Number(blob.finalPayableAmount) || 0,
  };
}

/** Merge estimate fields into an existing package addons blob for save. */
export function mergeEstimateIntoBlob(
  base: CounsellingPackageAddonsBlob,
  estimate: Partial<CounsellingEstimateState>,
): CounsellingPackageAddonsBlob {
  const next: CounsellingPackageAddonsBlob = { ...base };

  if (estimate.estimateMode !== undefined) next.estimateMode = estimate.estimateMode;
  if (estimate.packageTemplateId !== undefined) {
    next.packageTemplateId = estimate.packageTemplateId ?? undefined;
  }
  if (estimate.discountType !== undefined) next.discountType = estimate.discountType;
  if (estimate.discountValue !== undefined) next.discountValue = estimate.discountValue;
  if (estimate.discountReason !== undefined) next.discountReason = estimate.discountReason;
  if (estimate.discountAmount !== undefined) next.discountAmount = estimate.discountAmount;
  if (estimate.itemizedSubtotal !== undefined) next.itemizedSubtotal = estimate.itemizedSubtotal;
  if (estimate.bundleSavings !== undefined) next.bundleSavings = estimate.bundleSavings;
  if (estimate.finalPayableAmount !== undefined) {
    next.finalPayableAmount = estimate.finalPayableAmount;
    if (estimate.finalPayableAmount > 0) {
      next.rate = estimate.finalPayableAmount;
    }
  }

  return next;
}
