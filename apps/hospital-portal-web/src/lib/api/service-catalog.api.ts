import { getApi } from '../api';

// ============================================================================
// Service Catalog V2 — TypeScript interfaces
// ============================================================================

export interface ServiceVariantDto {
  id: string;
  code: string;
  name: string;
  price: number;
  priceType: 'PER_EYE' | 'BOTH_EYES' | 'FIXED';
  hasIolOptions: boolean;
  displayOrder: number;
  isActive: boolean;
  /** Internal brand/sub-type choices. Null when no sub-options exist. Staff-only — not shown to patient or insurance. */
  subOptions?: string[] | null;
}

export interface CatalogServiceDto {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  variants: ServiceVariantDto[];
}

export interface ServiceCategoryDto {
  id: string;
  code: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  services: CatalogServiceDto[];
}

export interface IolMasterDto {
  id: string;
  modelName: string;
  brandManufacturer: string;
  iolType: string;
  origin: 'Indian' | 'Imported';
  price: number;
  isDefault: boolean;
}

export interface FullCatalogResponse {
  categories: ServiceCategoryDto[];
}

export interface BranchVariantPricingDto {
  variantId: string;
  amount: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isActive: boolean;
}

/** Variant enriched with its parent category/service info — used for flat lists in dropdowns */
export interface FlatVariantDto extends ServiceVariantDto {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  serviceId: string;
  serviceName: string;
}

/** Flatten a FullCatalogResponse into a single array of FlatVariantDto */
export function flattenCatalog(catalog: FullCatalogResponse): FlatVariantDto[] {
  return catalog.categories.flatMap((cat) =>
    cat.services.flatMap((svc) =>
      svc.variants.map((v) => ({
        ...v,
        categoryId: cat.id,
        categoryCode: cat.code,
        categoryName: cat.name,
        serviceId: svc.id,
        serviceName: svc.name,
      })),
    ),
  );
}

// ============================================================================
// API functions
// ============================================================================

export interface ServiceCatalogSyncResult {
  tenantsProcessed: number;
  surgeryTypesUpserted: number;
  iolCatalogUpserted: number;
  deactivated: number;
}

export const serviceCatalogApi = {
  /** Full catalog tree: categories → services → variants */
  async getFullCatalog(): Promise<FullCatalogResponse> {
    const api = getApi();
    const res = await api.get<FullCatalogResponse>('/servicecatalog/full');
    return res.data;
  },

  /** Flat list of active categories */
  async getCategories(): Promise<ServiceCategoryDto[]> {
    const api = getApi();
    const res = await api.get<ServiceCategoryDto[]>('/servicecatalog/categories');
    return res.data;
  },

  /** IOL options for a specific service variant */
  async getVariantIolOptions(variantId: string): Promise<IolMasterDto[]> {
    const api = getApi();
    const res = await api.get<IolMasterDto[]>(`/servicecatalog/variants/${variantId}/iol`);
    return res.data;
  },

  /** Branch-specific price overrides */
  async getBranchPricing(branchId: string): Promise<BranchVariantPricingDto[]> {
    const api = getApi();
    const res = await api.get<BranchVariantPricingDto[]>(`/servicecatalog/branch/${branchId}/pricing`);
    return res.data;
  },

  /** Upsert clinical.surgery_type + clinical.iol_catalog from global catalog (current tenant). */
  async syncMaster(): Promise<ServiceCatalogSyncResult> {
    const api = getApi();
    const res = await api.post<ServiceCatalogSyncResult>('/servicecatalog/sync-master');
    return res.data;
  },
};

// ============================================================================
// Admin CRUD (S2) — requires master_data.view / master_data.manage
// ============================================================================

export interface CreateServiceCategoryRequest {
  code: string;
  name: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface UpdateServiceCategoryRequest {
  code?: string;
  name?: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface CreateCatalogServiceRequest {
  name: string;
  code?: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface UpdateCatalogServiceRequest {
  name?: string;
  code?: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface CreateServiceVariantRequest {
  name: string;
  code?: string;
  price: number;
  priceType: ServiceVariantDto['priceType'];
  hasIolOptions?: boolean;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
  subOptions?: string[] | null;
}

export interface UpdateServiceVariantRequest {
  name?: string;
  code?: string;
  price?: number;
  priceType?: ServiceVariantDto['priceType'];
  hasIolOptions?: boolean;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
  subOptions?: string[] | null;
}

export const serviceCatalogAdminApi = {
  async getAdminFull(includeInactive = true): Promise<FullCatalogResponse> {
    const api = getApi();
    const res = await api.get<FullCatalogResponse>('/servicecatalog/admin/full', {
      params: { includeInactive },
    });
    return res.data;
  },

  async createCategory(body: CreateServiceCategoryRequest): Promise<ServiceCategoryDto> {
    const api = getApi();
    const res = await api.post<ServiceCategoryDto>('/servicecatalog/admin/categories', body);
    return res.data;
  },

  async updateCategory(id: string, body: UpdateServiceCategoryRequest): Promise<ServiceCategoryDto> {
    const api = getApi();
    const res = await api.put<ServiceCategoryDto>(`/servicecatalog/admin/categories/${id}`, body);
    return res.data;
  },

  async deleteCategory(id: string): Promise<void> {
    const api = getApi();
    await api.delete(`/servicecatalog/admin/categories/${id}`);
  },

  async createService(categoryId: string, body: CreateCatalogServiceRequest): Promise<CatalogServiceDto> {
    const api = getApi();
    const res = await api.post<CatalogServiceDto>(
      `/servicecatalog/admin/categories/${categoryId}/services`,
      body,
    );
    return res.data;
  },

  async updateService(id: string, body: UpdateCatalogServiceRequest): Promise<CatalogServiceDto> {
    const api = getApi();
    const res = await api.put<CatalogServiceDto>(`/servicecatalog/admin/services/${id}`, body);
    return res.data;
  },

  async deleteService(id: string): Promise<void> {
    const api = getApi();
    await api.delete(`/servicecatalog/admin/services/${id}`);
  },

  async createVariant(serviceId: string, body: CreateServiceVariantRequest): Promise<ServiceVariantDto> {
    const api = getApi();
    const res = await api.post<ServiceVariantDto>(
      `/servicecatalog/admin/services/${serviceId}/variants`,
      body,
    );
    return res.data;
  },

  async updateVariant(id: string, body: UpdateServiceVariantRequest): Promise<ServiceVariantDto> {
    const api = getApi();
    const res = await api.put<ServiceVariantDto>(`/servicecatalog/admin/variants/${id}`, body);
    return res.data;
  },

  async deleteVariant(id: string): Promise<void> {
    const api = getApi();
    await api.delete(`/servicecatalog/admin/variants/${id}`);
  },

  async getIolCatalog(includeInactive = true): Promise<IolMasterAdminDto[]> {
    const api = getApi();
    const res = await api.get<IolMasterAdminDto[]>('/servicecatalog/admin/iol', {
      params: { includeInactive },
    });
    return res.data;
  },

  async createIol(body: CreateIolMasterRequest): Promise<IolMasterAdminDto> {
    const api = getApi();
    const res = await api.post<IolMasterAdminDto>('/servicecatalog/admin/iol', body);
    return res.data;
  },

  async updateIol(id: string, body: UpdateIolMasterRequest): Promise<IolMasterAdminDto> {
    const api = getApi();
    const res = await api.put<IolMasterAdminDto>(`/servicecatalog/admin/iol/${id}`, body);
    return res.data;
  },

  async deleteIol(id: string): Promise<void> {
    const api = getApi();
    await api.delete(`/servicecatalog/admin/iol/${id}`);
  },

  async getVariantIolMappings(variantId: string): Promise<VariantIolMappingAdminDto[]> {
    const api = getApi();
    const res = await api.get<VariantIolMappingAdminDto[]>(
      `/servicecatalog/admin/variants/${variantId}/iol-mappings`,
    );
    return res.data;
  },

  async setVariantIolMappings(
    variantId: string,
    links: VariantIolLinkRequest[],
  ): Promise<VariantIolMappingAdminDto[]> {
    const api = getApi();
    const res = await api.put<VariantIolMappingAdminDto[]>(
      `/servicecatalog/admin/variants/${variantId}/iol-mappings`,
      { links },
    );
    return res.data;
  },

  async getBranchPricingRows(branchId: string): Promise<BranchPricingRowDto[]> {
    const api = getApi();
    const res = await api.get<BranchPricingRowDto[]>(
      `/servicecatalog/admin/branch/${branchId}/pricing-rows`,
    );
    return res.data;
  },

  async upsertBranchVariantPrice(
    branchId: string,
    body: UpsertBranchVariantPriceRequest,
  ): Promise<BranchVariantPricingDto> {
    const api = getApi();
    const res = await api.put<BranchVariantPricingDto>(
      `/servicecatalog/admin/branch/${branchId}/pricing`,
      body,
    );
    return res.data;
  },

  async removeBranchVariantPrice(branchId: string, variantId: string): Promise<void> {
    const api = getApi();
    await api.delete(`/servicecatalog/admin/branch/${branchId}/pricing/${variantId}`);
  },
};

export interface IolMasterAdminDto {
  id: string;
  modelName: string;
  brandManufacturer: string;
  iolType: string;
  origin: string;
  price: number;
  productCode?: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface CreateIolMasterRequest {
  modelName: string;
  brandManufacturer: string;
  iolType?: string;
  origin?: string;
  price: number;
  productCode?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface UpdateIolMasterRequest {
  modelName?: string;
  brandManufacturer?: string;
  iolType?: string;
  origin?: string;
  price?: number;
  productCode?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface VariantIolMappingAdminDto {
  mappingId: string;
  iolMasterId: string;
  modelName: string;
  brandManufacturer: string;
  price: number;
  isDefault: boolean;
}

export interface VariantIolLinkRequest {
  iolMasterId: string;
  isDefault: boolean;
}

export interface BranchPricingRowDto {
  variantId: string;
  variantCode: string;
  variantName: string;
  categoryCode: string;
  globalAmount: number;
  branchAmount?: number | null;
}

export interface UpsertBranchVariantPriceRequest {
  variantId: string;
  amount: number;
}

/** Return a human-readable price suffix based on priceType */
export function priceSuffix(priceType: ServiceVariantDto['priceType']): string {
  if (priceType === 'PER_EYE') return '/eye';
  if (priceType === 'BOTH_EYES') return '/both eyes';
  return '';
}

