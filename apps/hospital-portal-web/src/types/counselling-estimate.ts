/** Estimate mode: package bundle vs custom line-item selection. */
export type CounsellingEstimateMode = 'package' | 'custom';

export type CounsellingDiscountType = 'flat' | 'percent';

/** Fields persisted inside counseling_sessions.package_addons_json (counsellor blob). */
export interface CounsellingPackageAddonsBlob {
  selectedSurgeryId?: string;
  packageName?: string;
  variantId?: string;
  eye?: string;
  decision?: string;
  paymentType?: string;
  insuranceCompany?: string;
  followUpDate?: string;
  schedule?: unknown;
  patientRemarks?: string;
  doctorNotes?: string;
  rate?: number | string;
  wantToSeeDoctor?: boolean;
  interestedToUpgrade?: boolean;
  notRequiredPreAuth?: boolean;
  previousPackageName?: string;
  previousPackageAmount?: number;
  ccmsCoverageCaseId?: string;
  ccmsCaseNumber?: string;
  ccmsCurrentState?: string;
  ccmsLastEvent?: string;

  /** Phase 1+ estimate engine fields */
  estimateMode?: CounsellingEstimateMode;
  packageTemplateId?: string;
  discountType?: CounsellingDiscountType | null;
  discountValue?: number;
  discountReason?: string;
  discountAmount?: number;
  itemizedSubtotal?: number;
  bundleSavings?: number;
  finalPayableAmount?: number;
}

export interface CounsellingEstimateState {
  estimateMode: CounsellingEstimateMode;
  packageTemplateId: string | null;
  discountType: CounsellingDiscountType | null;
  discountValue: number;
  discountReason: string;
  discountAmount: number;
  itemizedSubtotal: number;
  bundleSavings: number;
  finalPayableAmount: number;
}

export const EMPTY_COUNSELLING_ESTIMATE: CounsellingEstimateState = {
  estimateMode: 'custom',
  packageTemplateId: null,
  discountType: null,
  discountValue: 0,
  discountReason: '',
  discountAmount: 0,
  itemizedSubtotal: 0,
  bundleSavings: 0,
  finalPayableAmount: 0,
};

export interface CounsellingPackageTemplate {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string | null;
  category?: string | null;
  packageAmount: number;
  currency: string;
  procedureVariantId?: string | null;
  defaultEye: 'RE' | 'LE' | 'BE';
  variantSubOption?: string | null;
  iolId?: string | null;
  investigationIds: string[];
  maxDiscountPercent: number;
  legacyMasterCode?: string | null;
  isDefault: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

export interface CreateCounsellingPackageTemplateRequest {
  code: string;
  name: string;
  description?: string;
  category?: string;
  packageAmount: number;
  currency?: string;
  procedureVariantId?: string;
  defaultEye?: 'RE' | 'LE' | 'BE';
  variantSubOption?: string;
  iolId?: string;
  investigationIds?: string[];
  maxDiscountPercent?: number;
  legacyMasterCode?: string;
  isDefault?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateCounsellingPackageTemplateRequest {
  name?: string;
  description?: string;
  category?: string;
  packageAmount?: number;
  procedureVariantId?: string;
  defaultEye?: 'RE' | 'LE' | 'BE';
  variantSubOption?: string;
  iolId?: string;
  investigationIds?: string[];
  maxDiscountPercent?: number;
  legacyMasterCode?: string;
  isDefault?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CounsellingSettings {
  maxDiscountPercent: number;
  maxDiscountFlat?: number | null;
}

/** Canonical aliases (B5 — single export surface). */
export type EstimateMode = CounsellingEstimateMode;
export type CounsellingEstimate = CounsellingEstimateState;
export type PackageTemplate = CounsellingPackageTemplate;

export type { EstimateLine } from '@/lib/counsellors-desk/estimate-engine';
