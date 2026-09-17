import type { CounsellingDiscountType } from '@/types/counselling-estimate';

export interface DiscountFields {
  discountType: CounsellingDiscountType | null;
  discountValue: number;
  discountReason: string;
}

export interface DiscountDraftInput {
  draftType: CounsellingDiscountType | null;
  draftValue: string;
  draftReason: string;
}

/** Business rule: positive applied discount requires a non-empty reason. */
export function validateDiscountForSave(fields: DiscountFields): string | null {
  if (fields.discountType && fields.discountValue > 0 && !fields.discountReason?.trim()) {
    return 'Please enter a discount reason';
  }
  return null;
}

/**
 * Build the canonical discount patch from the Quote discount draft.
 * Returns null when a positive amount is present without a reason (cannot commit).
 */
export function buildCommittedDiscountPatch(
  draft: DiscountDraftInput,
): DiscountFields | null {
  if (!draft.draftType) {
    return {
      discountType: null,
      discountValue: 0,
      discountReason: '',
    };
  }
  const discountValue = Number(draft.draftValue) || 0;
  const discountReason = draft.draftReason.trim();
  if (discountValue > 0 && !discountReason) {
    return null;
  }
  return {
    discountType: draft.draftType,
    discountValue,
    discountReason,
  };
}

export function canCommitDiscountDraft(draft: DiscountDraftInput): boolean {
  if (!draft.draftType) return false;
  const value = Number(draft.draftValue) || 0;
  if (value <= 0 || draft.draftValue.trim() === '') return false;
  return draft.draftReason.trim().length > 0;
}
