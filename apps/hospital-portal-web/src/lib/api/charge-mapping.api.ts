import { getApi } from '../api';

export interface UnmappedChargeItem {
  itemId?: string | null;
  itemName: string;
  itemCode: string;
  itemType: string;
  useCount: number;
  lastUsedAt?: string | null;
  estimatedValue: number;
  openExceptionCount: number;
  lastPatientName?: string | null;
  lastUhid?: string | null;
}

export interface ChargeMappingKpis {
  unmappedItemCount: number;
  blockedChargeValue: number;
  billsAffected: number;
  mappedThisWeek: number;
}

export interface PackageComponentStatus {
  id: string;
  packageTemplateId: string;
  packageName: string;
  componentKey: string;
  componentName: string;
  serviceVariantId?: string | null;
  variantCode?: string | null;
  allocation: string;
  coversConsumable: boolean;
  catalogPrice?: number | null;
  status: string;
}

export interface ChargeExceptionList {
  kpis: ChargeMappingKpis;
  items: UnmappedChargeItem[];
  unmappedPackageComponents: PackageComponentStatus[];
}

export interface ChargeVariantSearch {
  id: string;
  code: string;
  name: string;
  price: number;
}

export interface ChargeMappingRow {
  id: string;
  itemId: string;
  serviceVariantId: string;
  variantName?: string | null;
  isChargeable: boolean;
  nonChargeableReason?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface ReplayExceptionsResult {
  posted: number;
  needsAdjustment: number;
  stillUnmapped: number;
  markedNonChargeable: number;
  /** Mapped but no verified opd_bill_items line — exception stays Open. */
  blockedNoBill?: number;
}

export const chargeMappingApi = {
  getExceptions: async (lookbackDays = 90): Promise<ChargeExceptionList> => {
    const response = await getApi().get('/chargemapping/exceptions', { params: { lookbackDays } });
    return response.data;
  },
  searchVariants: async (q: string): Promise<ChargeVariantSearch[]> => {
    const response = await getApi().get('/chargemapping/variants', { params: { q } });
    return response.data ?? [];
  },
  createMapping: async (body: {
    itemId: string;
    serviceVariantId: string;
    isChargeable?: boolean;
    nonChargeableReason?: string;
  }): Promise<ChargeMappingRow> => {
    const response = await getApi().post('/chargemapping', body);
    return response.data;
  },
  getHistory: async (itemId: string): Promise<ChargeMappingRow[]> => {
    const response = await getApi().get(`/chargemapping/${itemId}/history`);
    return response.data ?? [];
  },
  getPackage: async (packageId: string): Promise<PackageComponentStatus[]> => {
    const response = await getApi().get(`/chargemapping/package/${packageId}`);
    return response.data ?? [];
  },
  savePackage: async (packageId: string, components: {
    componentKey: string;
    componentName: string;
    serviceVariantId?: string | null;
    allocation?: string;
    coversConsumable?: boolean;
    sortOrder?: number;
  }[]): Promise<PackageComponentStatus[]> => {
    const response = await getApi().put(`/chargemapping/package/${packageId}`, { components });
    return response.data ?? [];
  },
  replay: async (itemId?: string): Promise<ReplayExceptionsResult> => {
    const response = await getApi().post('/chargemapping/replay', null, { params: { itemId } });
    return response.data;
  },
};

export default chargeMappingApi;
