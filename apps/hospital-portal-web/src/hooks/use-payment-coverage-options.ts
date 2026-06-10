'use client';

import { useMemo } from 'react';
import { usePatientTypeMaster } from '@/hooks/use-patient-type-master';
import { usePaymentModes } from '@/hooks/use-payment-modes';
import {
  buildPaymentCoverageOptions,
  type PaymentCoverageGroup,
} from '@/lib/billing/payment-coverage-maps';

/** Unified payment/coverage dropdown groups (B1.4) from patient.patient_type + billing.payment_mode. */
export function usePaymentCoverageOptions() {
  const { configs, loading: patientTypesLoading, error: patientTypesError } = usePatientTypeMaster();
  const { options: paymentModes, loading: modesLoading, error: modesError } = usePaymentModes();

  const groups = useMemo<PaymentCoverageGroup[]>(
    () => buildPaymentCoverageOptions(configs, paymentModes),
    [configs, paymentModes],
  );

  return {
    groups,
    loading: patientTypesLoading || modesLoading,
    error: patientTypesError ?? modesError,
  };
}
