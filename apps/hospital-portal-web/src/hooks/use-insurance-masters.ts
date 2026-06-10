'use client';

import { useMasterValues } from '@/hooks/use-master-values';

export function useInsuranceTypeMaster() {
  return useMasterValues('insurance.type');
}

export function useTpaProviderMaster() {
  return useMasterValues('insurance.tpa_provider');
}

export function useGovtSchemeMaster() {
  return useMasterValues('insurance.govt_scheme');
}

/** Map counsellor/CCMS payment type → insurance.type filter code (metadata-aware). */
export function insuranceTypeFilterFromPayment(paymentType?: string): string {
  if (!paymentType) return '';
  switch (paymentType) {
    case 'TPA':
      return 'tpa';
    case 'CGHS':
    case 'SGHS':
    case 'GovernmentScheme':
    case 'Arograshree':
    case 'Railway':
    case 'ESH':
      return 'govt';
    case 'CoPay':
      return 'copay';
    case 'Insurance':
      return 'insurance';
    default:
      return 'cashless';
  }
}
