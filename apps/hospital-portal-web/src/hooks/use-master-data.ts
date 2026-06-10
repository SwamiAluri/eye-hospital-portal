// Master Data Hooks - React Query hooks for dropdown data
import { useQuery, useMutation, UseQueryOptions } from '@tanstack/react-query';
import {
  masterDataApi,
  type InsuranceProvider,
  type TpaProvider,
  type SurgeryType,
  type AnesthesiaType,
  type GovernmentScheme,
  type PackageCostCalculation,
  type ConsultationFeeResponse,
  type DoctorSearchResult,
} from '@/lib/api/master-data.api';
import {
  serviceCatalogApi,
  type IolMasterDto,
  type FullCatalogResponse,
  type FlatVariantDto,
  flattenCatalog,
} from '@/lib/api/service-catalog.api';
import {
  buildCounsellorIolDtos,
  type CounsellorProcedureVariant,
} from '@/lib/master-data/clinical-catalog-master';
import {
  useClinicalIolWithPricing,
  useCounsellorProcedureVariants,
} from '@/hooks/use-clinical-catalog-master';

// ============================================================================
// Query Keys
// ============================================================================

export const masterDataKeys = {
  all: ['master-data'] as const,
  insuranceProviders: () => [...masterDataKeys.all, 'insurance-providers'] as const,
  insuranceProvider: (id: string) => [...masterDataKeys.insuranceProviders(), id] as const,
  tpaProviders: () => [...masterDataKeys.all, 'tpa-providers'] as const,
  tpaProvider: (id: string) => [...masterDataKeys.tpaProviders(), id] as const,
  anesthesiaTypes: () => [...masterDataKeys.all, 'anesthesia-types'] as const,
  anesthesiaType: (id: string) => [...masterDataKeys.anesthesiaTypes(), id] as const,
  surgeryTypes: () => [...masterDataKeys.all, 'surgery-types'] as const,
  governmentSchemes: () => [...masterDataKeys.all, 'government-schemes'] as const,
  governmentScheme: (id: string) => [...masterDataKeys.governmentSchemes(), id] as const,
  
  // Service catalog keys
  fullCatalog: () => [...masterDataKeys.all, 'full-catalog'] as const,
  iolOptions: (variantId?: string) => [...masterDataKeys.all, 'iol-options', variantId] as const,
  packageCost: (params: Record<string, any>) => [...masterDataKeys.all, 'package-cost', params] as const,
  consultationFee: (params: Record<string, any>) => [...masterDataKeys.all, 'consultation-fee', params] as const,
  doctors: (params?: Record<string, any>) => [...masterDataKeys.all, 'doctors', params] as const,
};

// ============================================================================
// Insurance Provider Hooks
// ============================================================================

export function useInsuranceProviders(
  options?: Omit<UseQueryOptions<InsuranceProvider[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: masterDataKeys.insuranceProviders(),
    queryFn: masterDataApi.getInsuranceProviders,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    ...options,
  });
}

export function useInsuranceProvider(
  id: string,
  options?: Omit<UseQueryOptions<InsuranceProvider>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: masterDataKeys.insuranceProvider(id),
    queryFn: () => masterDataApi.getInsuranceProviderById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    ...options,
  });
}

// ============================================================================
// TPA Provider Hooks
// ============================================================================

export function useTpaProviders(
  options?: Omit<UseQueryOptions<TpaProvider[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: masterDataKeys.tpaProviders(),
    queryFn: masterDataApi.getTpaProviders,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    ...options,
  });
}

export function useTpaProvider(
  id: string,
  options?: Omit<UseQueryOptions<TpaProvider>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: masterDataKeys.tpaProvider(id),
    queryFn: () => masterDataApi.getTpaProviderById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    ...options,
  });
}

// ============================================================================
// Service Catalog Hooks (replaces Surgery Type / IOL Catalog Hooks)
// ============================================================================

/** Full catalog tree: categories → services → variants */
export function useFullCatalog(
  options?: Omit<UseQueryOptions<FullCatalogResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: masterDataKeys.fullCatalog(),
    queryFn: serviceCatalogApi.getFullCatalog,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    ...options,
  });
}

/**
 * IOL options for a variant — master labels joined to catalog pricing.
 * @deprecated Prefer `useClinicalIolWithPricing` from `@/hooks/use-clinical-catalog-master`.
 */
export function useIolOptions(
  variantId?: string,
  options?: Omit<UseQueryOptions<IolMasterDto[]>, 'queryKey' | 'queryFn'> & { enabled?: boolean },
) {
  const enabled = (options?.enabled ?? true) && !!variantId;
  const { items, loading, error, refetch } = useClinicalIolWithPricing(
    enabled ? variantId : undefined,
  );
  const data = enabled ? buildCounsellorIolDtos(items) : undefined;
  return {
    data,
    isLoading: loading,
    isError: error,
    refetch,
    isFetching: loading,
    isSuccess: !loading && !error && !!data,
    status: loading ? 'pending' : error ? 'error' : 'success',
  } as ReturnType<typeof useQuery<IolMasterDto[]>>;
}

/**
 * Backward-compatible hook: master surgery types + catalog pricing.
 * Returns `{ data: { data: CounsellorProcedureVariant[] } }` for legacy callers.
 */
export function useSurgeryTypesWithPricing(
  _params?: { branchId?: string; category?: string },
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? true;
  const { variants, loading, error, refetch } = useCounsellorProcedureVariants(enabled);
  return {
    data: enabled ? { data: variants as CounsellorProcedureVariant[] } : undefined,
    isLoading: loading,
    isError: error,
    refetch,
    isFetching: loading,
    isSuccess: !loading && !error,
    status: loading ? 'pending' : error ? 'error' : 'success',
  } as { data?: { data: FlatVariantDto[] }; isLoading: boolean; isError: boolean; refetch: () => void };
}

/** @deprecated Use useCounsellorProcedureVariants from use-clinical-catalog-master */
export function useSurgeryTypes(
  options?: Omit<UseQueryOptions<SurgeryType[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: masterDataKeys.surgeryTypes(),
    queryFn: masterDataApi.getSurgeryTypes,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    ...options,
  });
}

// ============================================================================
// Anesthesia Type Hooks
// ============================================================================

/** @deprecated Prefer useAnesthesiaTypeMaster — backed by clinical.anesthesia_type master lookup */
export function useAnesthesiaTypes(
  options?: Omit<UseQueryOptions<AnesthesiaType[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: masterDataKeys.anesthesiaTypes(),
    queryFn: async () => {
      const { masterValuesApi } = await import('@/lib/api');
      const res = await masterValuesApi.lookup('clinical.anesthesia_type');
      const raw = res.data?.items ?? res.data?.Items ?? [];
      return (raw as { code: string; label: string; metadata?: Record<string, unknown> }[]).map(
        (row, i) => ({
          id: row.code,
          anesthesiaCode: row.code,
          anesthesiaName: row.label,
          anesthesiaCategory: (typeof row.metadata?.category === 'string'
            ? row.metadata.category
            : 'Local') as AnesthesiaType['anesthesiaCategory'],
          requiresAnesthetist: false,
          displayOrder: i + 1,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      );
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    ...options,
  });
}

export function useAnesthesiaType(
  id: string,
  options?: Omit<UseQueryOptions<AnesthesiaType>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: masterDataKeys.anesthesiaType(id),
    queryFn: () => masterDataApi.getAnesthesiaTypeById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    ...options,
  });
}

// ============================================================================
// Government Scheme Hooks
// ============================================================================

export function useGovernmentSchemes(
  options?: Omit<UseQueryOptions<GovernmentScheme[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: masterDataKeys.governmentSchemes(),
    queryFn: masterDataApi.getGovernmentSchemes,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    ...options,
  });
}

export function useGovernmentScheme(
  id: string,
  options?: Omit<UseQueryOptions<GovernmentScheme>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: masterDataKeys.governmentScheme(id),
    queryFn: () => masterDataApi.getGovernmentSchemeById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    ...options,
  });
}



// ============================================================================
// Package Cost Hooks
// ============================================================================

export function usePackageCost(
  data: {
    branchId: string;
    surgeryTypeId: string;
    iolCatalogId?: string;
    doctorId?: string;
  },
  options?: Omit<UseQueryOptions<PackageCostCalculation>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: masterDataKeys.packageCost(data),
    queryFn: () => masterDataApi.calculatePackageCost(data),
    enabled: !!data.branchId && !!data.surgeryTypeId,
    staleTime: 2 * 60 * 1000, // 2 minutes - pricing may change
    gcTime: 10 * 60 * 1000,
    ...options,
  });
}

export function useCalculatePackageCost() {
  return useMutation({
    mutationFn: masterDataApi.calculatePackageCost,
  });
}

// ============================================================================
// Consultation Fee Hooks
// ============================================================================

export function useConsultationFee(
  params: {
    branchId: string;
    doctorId?: string;
    departmentId?: string;
    specialty?: string;
    isEmergency?: boolean;
    isFollowUp?: boolean;
  },
  options?: Omit<UseQueryOptions<ConsultationFeeResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: masterDataKeys.consultationFee(params),
    queryFn: () => masterDataApi.getConsultationFee(params),
    enabled: !!params.branchId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    ...options,
  });
}

// ============================================================================
// Doctor Search Hooks
// ============================================================================

export function useDoctorSearch(
  params: {
    searchTerm?: string;
    specialty?: string;
    branchId?: string;
    limit?: number;
  },
  options?: Omit<UseQueryOptions<{ data: DoctorSearchResult[]; count: number }>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: masterDataKeys.doctors(params),
    queryFn: () => masterDataApi.searchDoctors(params),
    enabled: params.searchTerm ? params.searchTerm.length >= 2 : false, // Only search with 2+ chars
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 15 * 60 * 1000,
    ...options,
  });
}

// ============================================================================
// Composite Hooks - Fetch all master data in parallel
// ============================================================================

/**
 * Fetch all master data needed for counselor module forms
 * Returns loading state and combined data
 */
export function useAllMasterData() {
  const insuranceProviders = useInsuranceProviders();
  const tpaProviders = useTpaProviders();
  const anesthesiaTypes = useAnesthesiaTypes();
  const governmentSchemes = useGovernmentSchemes();

  const isLoading =
    insuranceProviders.isLoading ||
    tpaProviders.isLoading ||
    anesthesiaTypes.isLoading ||
    governmentSchemes.isLoading;

  const isError =
    insuranceProviders.isError ||
    tpaProviders.isError ||
    anesthesiaTypes.isError ||
    governmentSchemes.isError;

  const error =
    insuranceProviders.error ||
    tpaProviders.error ||
    anesthesiaTypes.error ||
    governmentSchemes.error;

  return {
    isLoading,
    isError,
    error,
    data: {
      insuranceProviders: insuranceProviders.data || [],
      tpaProviders: tpaProviders.data || [],
      anesthesiaTypes: anesthesiaTypes.data || [],
      governmentSchemes: governmentSchemes.data || [],
    },
  };
}

/**
 * Get filtered active master data for dropdowns
 */
export function useActiveMasterData() {
  const { isLoading, isError, error, data } = useAllMasterData();

  return {
    isLoading,
    isError,
    error,
    data: {
      insuranceProviders: data.insuranceProviders.filter(p => p.isActive),
      tpaProviders: data.tpaProviders.filter(p => p.isActive),
      anesthesiaTypes: data.anesthesiaTypes.filter(t => t.isActive),
      governmentSchemes: data.governmentSchemes.filter(s => s.isActive),
    },
  };
}

