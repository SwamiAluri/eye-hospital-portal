'use client';

import { useMemo } from 'react';
import { useMasterValues } from '@/hooks/use-master-values';
import {
  buildCounsellorFlatVariants,
  joinMasterIolWithCatalog,
  joinMasterSurgeryWithCatalog,
  type CounsellorProcedureVariant,
  type IolOptionWithPricing,
  type SurgeryTypeWithPricing,
} from '@/lib/master-data/clinical-catalog-master';
import {
  flattenCatalog,
  serviceCatalogApi,
  type FlatVariantDto,
  type IolMasterDto,
} from '@/lib/api/service-catalog.api';
import { useQuery } from '@tanstack/react-query';
import { counsellorsDeskKeys, CATALOG_STALE_MS } from '@/lib/counsellors-desk/counsellors-desk-query-keys';

/** Dropdown surgery types from master (labels); use with catalog join for pricing. */
export function useClinicalSurgeryTypes() {
  return useMasterValues('clinical.surgery_type');
}

/** Dropdown IOL catalog from master (labels); use with catalog join for pricing. */
export function useClinicalIolCatalog() {
  return useMasterValues('clinical.iol_catalog');
}

/** Master surgery types joined to catalog variant pricing (catalog still owns tariffs). */
export function useClinicalSurgeryTypesWithPricing(enabled = true) {
  const { options, loading, error, refetch } = useClinicalSurgeryTypes();
  const catalogQuery = useQuery({
    queryKey: counsellorsDeskKeys.serviceCatalog(),
    queryFn: serviceCatalogApi.getFullCatalog,
    staleTime: CATALOG_STALE_MS,
    enabled,
  });

  const items = useMemo<SurgeryTypeWithPricing[]>(() => {
    if (!catalogQuery.data) return options.map((o) => ({ ...o }));
    const flat = flattenCatalog(catalogQuery.data);
    return joinMasterSurgeryWithCatalog(options, flat);
  }, [options, catalogQuery.data]);

  return {
    items,
    flatVariants: catalogQuery.data ? flattenCatalog(catalogQuery.data) : ([] as FlatVariantDto[]),
    loading: loading || (enabled && catalogQuery.isLoading),
    error: error || catalogQuery.isError,
    refetch: () => {
      refetch();
      void catalogQuery.refetch();
    },
  };
}

/** Counsellor procedure picker: master labels + catalog pricing. */
export function useCounsellorProcedureVariants(enabled = true) {
  const surgery = useClinicalSurgeryTypesWithPricing(enabled);
  const variants = useMemo<CounsellorProcedureVariant[]>(
    () => (enabled ? buildCounsellorFlatVariants(surgery.items) : []),
    [enabled, surgery.items],
  );
  return {
    variants,
    loading: enabled && surgery.loading,
    error: surgery.error,
    refetch: surgery.refetch,
  };
}

/** Master IOL options for a variant, joined to catalog IOL pricing. */
export function useClinicalIolWithPricing(variantId?: string) {
  const { options, loading, error, refetch } = useClinicalIolCatalog();
  const iolQuery = useQuery({
    queryKey: [...counsellorsDeskKeys.serviceCatalog(), 'variant-iol', variantId],
    queryFn: () => serviceCatalogApi.getVariantIolOptions(variantId!),
    enabled: !!variantId,
    staleTime: CATALOG_STALE_MS,
  });

  const items = useMemo<IolOptionWithPricing[]>(() => {
    const iols = iolQuery.data ?? [];
    if (!variantId) return options.map((o) => ({ ...o }));
    const linked = options.filter(
      (o) => iols.some((i) => i.id === o.metadata?.catalogIolId),
    );
    return joinMasterIolWithCatalog(linked.length > 0 ? linked : options, iols);
  }, [options, iolQuery.data, variantId]);

  return {
    items,
    iolDtos: (iolQuery.data ?? []) as IolMasterDto[],
    loading: loading || iolQuery.isLoading,
    error: error || iolQuery.isError,
    refetch: () => {
      refetch();
      void iolQuery.refetch();
    },
  };
}
