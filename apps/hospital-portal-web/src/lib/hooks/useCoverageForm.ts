import { useState, useCallback, useMemo } from 'react';
import type { EstimateTaxBreakdown, EstimateTaxResult } from '@/components/ccms/EstimateTaxSummary';
import { computeEstimate } from '@/components/ccms/EstimateTaxSummary';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CoverageFormState {
  // Payer
  payerType: 'insurance' | 'tpa' | 'government' | 'self_pay' | 'other';
  insuranceProviderId: string;
  tpaProviderId: string;
  governmentSchemeId: string;

  // Policy (primary)
  policyNumber: string;
  membershipNumber: string;
  cardNumber: string;

  // Financial parameters (sourced from payer or manual override)
  estimatedMedicalCost: number;
  approvedAmount: number;
  copayPercent: number;
  copayAmount: number;
  deductibleAmount: number;
  roomRentLimit: number;

  // Service tax
  serviceTaxApplicable: boolean;
  serviceTaxPercent: number;

  // Metadata
  roomClassRequested: string;
  diagnosisJson: string;
  proceduresJson: string;
  clinicalSummary: string;

  // Processing
  isDraft: boolean;
}

export type CoverageFormField = keyof CoverageFormState;

// ─────────────────────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_STATE: CoverageFormState = {
  payerType:              'insurance',
  insuranceProviderId:    '',
  tpaProviderId:          '',
  governmentSchemeId:     '',
  policyNumber:           '',
  membershipNumber:       '',
  cardNumber:             '',
  estimatedMedicalCost:   0,
  approvedAmount:         0,
  copayPercent:           0,
  copayAmount:            0,
  deductibleAmount:       0,
  roomRentLimit:          0,
  serviceTaxApplicable:   false,
  serviceTaxPercent:      0,
  roomClassRequested:     '',
  diagnosisJson:          '',
  proceduresJson:         '',
  clinicalSummary:        '',
  isDraft:                true,
};

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

interface UseCoverageFormOptions {
  initialValues?: Partial<CoverageFormState>;
}

export function useCoverageForm(options: UseCoverageFormOptions = {}) {
  const [form, setForm] = useState<CoverageFormState>({
    ...DEFAULT_STATE,
    ...options.initialValues,
  });

  const [errors, setErrors] = useState<Partial<Record<CoverageFormField, string>>>({});
  const [dirty, setDirty] = useState(false);

  // ── Field setter ───────────────────────────────────────────────────────────

  const setField = useCallback(
    <K extends CoverageFormField>(field: K, value: CoverageFormState[K]) => {
      setForm(prev => ({ ...prev, [field]: value }));
      setDirty(true);
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    [],
  );

  // Bulk patch (e.g. when payer selection auto-fills tax settings)
  const patchForm = useCallback((patch: Partial<CoverageFormState>) => {
    setForm(prev => ({ ...prev, ...patch }));
    setDirty(true);
  }, []);

  // ── Tax calculation (derived, no state) ──────────────────────────────────

  const taxBreakdown: EstimateTaxBreakdown = useMemo(() => ({
    estimatedMedicalCost: form.estimatedMedicalCost,
    serviceTaxApplicable: form.serviceTaxApplicable,
    serviceTaxPercent:    form.serviceTaxPercent,
    approvedAmount:       form.approvedAmount,
    copayPercent:         form.copayPercent > 0 ? form.copayPercent : undefined,
    copayAmount:          form.copayAmount  > 0 ? form.copayAmount  : undefined,
    deductibleAmount:     form.deductibleAmount,
    roomRentLimit:        form.roomRentLimit,
  }), [
    form.estimatedMedicalCost,
    form.serviceTaxApplicable,
    form.serviceTaxPercent,
    form.approvedAmount,
    form.copayPercent,
    form.copayAmount,
    form.deductibleAmount,
    form.roomRentLimit,
  ]);

  const taxResult: EstimateTaxResult = useMemo(
    () => computeEstimate(taxBreakdown),
    [taxBreakdown],
  );

  // ── Validation ─────────────────────────────────────────────────────────────

  const validate = useCallback((): boolean => {
    const errs: Partial<Record<CoverageFormField, string>> = {};

    if (!form.payerType) {
      errs.payerType = 'Payer type is required.';
    }

    if (form.payerType === 'insurance' && !form.insuranceProviderId) {
      errs.insuranceProviderId = 'Select an insurance provider.';
    }

    if (form.estimatedMedicalCost <= 0) {
      errs.estimatedMedicalCost = 'Estimated medical cost must be greater than 0.';
    }

    if (form.serviceTaxApplicable && (form.serviceTaxPercent <= 0 || form.serviceTaxPercent > 100)) {
      errs.serviceTaxPercent = 'Service tax percent must be between 0 and 100.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form]);

  // ── Reset ──────────────────────────────────────────────────────────────────

  const reset = useCallback((values?: Partial<CoverageFormState>) => {
    setForm({ ...DEFAULT_STATE, ...(values ?? {}) });
    setErrors({});
    setDirty(false);
  }, []);

  return {
    form,
    errors,
    dirty,
    setField,
    patchForm,
    validate,
    reset,
    taxBreakdown,
    taxResult,
  };
}
