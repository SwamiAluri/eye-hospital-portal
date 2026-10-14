/**
 * Enterprise LMS — Laboratory Service HTTP client.
 *
 * L-CAT-01A: health / secure-ping shell
 * L-CAT-01B: governed catalogue CRUD + lifecycle
 *
 * Distinct from Pathology Laboratory clients:
 * - laboratory-catalog.api.ts → AuthService /api/laboratory/catalog
 * - lab-reports.api.ts → AuthService /api/lab-reports
 */
import axios, { type AxiosInstance } from 'axios';
import { attachAuthRequestInterceptor, attachAuthResponseInterceptor } from '../auth-interceptors';

const LABORATORY_BASE_URL =
  process.env.NEXT_PUBLIC_LABORATORY_API_URL ?? 'http://localhost:7076/api';

let laboratoryAxios: AxiosInstance | undefined;

export function initLaboratoryApi(): AxiosInstance {
  laboratoryAxios = axios.create({
    baseURL: LABORATORY_BASE_URL,
    timeout: 30_000,
    headers: { 'Content-Type': 'application/json' },
  });
  attachAuthRequestInterceptor(laboratoryAxios);
  attachAuthResponseInterceptor(laboratoryAxios);
  return laboratoryAxios;
}

export function getLaboratoryApi(): AxiosInstance {
  return laboratoryAxios ?? initLaboratoryApi();
}

export type LmsHealthResponse = {
  status: string;
  service: string;
  domain: string;
  slice: string;
  catalogueImplemented: boolean;
  database: { reachable: boolean; error?: string | null };
  utc: string;
};

export type LmsSecurePingResponse = {
  status: string;
  service: string;
  userId: string;
  tenantId: string;
  tenantContext: string | null;
  requiredPermission: string;
};

export type LmsPanelComponentInput = {
  componentCatalogueItemId: string;
  componentVersionId: string;
  sortOrder: number;
  isRequired?: boolean;
};

export type LmsCreateCatalogueDraftRequest = {
  catalogueType: 'TEST' | 'PANEL' | 'REFERRAL_TEST';
  internalOrderCode: string;
  displayName: string;
  discipline: string;
  synonyms?: string;
  method?: string;
  classification?: 'LOCAL' | 'REFERRAL';
  orderable?: boolean;
  preparationInstruction?: string;
  specimenTypeRef?: string;
  containerRef?: string;
  requiredVolume?: string;
  patientPreparation?: string;
  referralPartnerRef?: string;
  serviceCatalogRef?: string;
  changeReason?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  branchIds?: string[];
  panelComponents?: LmsPanelComponentInput[];
};

export type LmsUpdateCatalogueDraftRequest = Partial<
  Omit<LmsCreateCatalogueDraftRequest, 'catalogueType'>
> & {
  clearEffectiveTo?: boolean;
  expectedRowVersion?: number;
};

export type LmsLifecycleActionRequest = {
  reason?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  expectedRowVersion?: number;
};

export type LmsPanelComponentDto = {
  id: string;
  componentCatalogueItemId: string;
  componentVersionId: string;
  sortOrder: number;
  isRequired: boolean;
  componentDisplayName?: string | null;
  componentInternalCode?: string | null;
};

export type LmsCatalogueVersionDto = {
  id: string;
  catalogueItemId: string;
  catalogueType: string;
  versionNumber: number;
  status: string;
  internalOrderCode: string;
  displayName: string;
  synonyms?: string | null;
  discipline: string;
  method?: string | null;
  classification: string;
  orderable: boolean;
  preparationInstruction?: string | null;
  specimenTypeRef?: string | null;
  containerRef?: string | null;
  requiredVolume?: string | null;
  patientPreparation?: string | null;
  referralPartnerRef?: string | null;
  serviceCatalogRef?: string | null;
  changeReason?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  createdAt: string;
  createdBy: string;
  submittedAt?: string | null;
  submittedBy?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  activatedAt?: string | null;
  activatedBy?: string | null;
  retiredAt?: string | null;
  retiredBy?: string | null;
  supersededAt?: string | null;
  supersededBy?: string | null;
  supersededByVersionId?: string | null;
  rowVersion: number;
  branchIds: string[];
  panelComponents: LmsPanelComponentDto[];
  isTenantWide: boolean;
};

export type LmsCatalogueVersionSummaryDto = {
  id: string;
  versionNumber: number;
  status: string;
  internalOrderCode: string;
  displayName: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  createdAt: string;
  supersededByVersionId?: string | null;
};

export type LmsCatalogueItemDetailDto = {
  id: string;
  tenantId: string;
  catalogueType: string;
  currentActiveVersionId?: string | null;
  latestVersionId?: string | null;
  createdAt: string;
  createdBy: string;
  currentVersion?: LmsCatalogueVersionDto | null;
  versionHistory: LmsCatalogueVersionSummaryDto[];
};

export type LmsCatalogueListItemDto = {
  id: string;
  latestVersionId: string;
  catalogueType: string;
  internalOrderCode: string;
  displayName: string;
  synonyms?: string | null;
  discipline: string;
  classification: string;
  status: string;
  versionNumber: number;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  isTenantWide: boolean;
  branchIds: string[];
};

export type LmsPagedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
};

export type LmsCatalogueListParams = {
  search?: string;
  catalogueType?: string;
  discipline?: string;
  status?: string;
  classification?: string;
  branchId?: string;
  page?: number;
  pageSize?: number;
};

/** Shell health probe — anonymous. */
export async function getLmsHealth(): Promise<LmsHealthResponse> {
  const { data } = await getLaboratoryApi().get<LmsHealthResponse>('/lms/health', {
    skipForbiddenRedirect: true,
  } as never);
  return data;
}

/** Auth boundary probe — requires JWT + lms.view. */
export async function getLmsSecurePing(): Promise<LmsSecurePingResponse> {
  const { data } = await getLaboratoryApi().get<LmsSecurePingResponse>('/lms/secure-ping');
  return data;
}

export async function listLmsCatalogue(
  params: LmsCatalogueListParams = {},
): Promise<LmsPagedResult<LmsCatalogueListItemDto>> {
  const { data } = await getLaboratoryApi().get<LmsPagedResult<LmsCatalogueListItemDto>>(
    '/lms/catalogue',
    { params },
  );
  return data;
}

export async function getLmsCatalogueItem(id: string): Promise<LmsCatalogueItemDetailDto> {
  const { data } = await getLaboratoryApi().get<LmsCatalogueItemDetailDto>(`/lms/catalogue/${id}`);
  return data;
}

export async function getLmsCatalogueVersions(
  id: string,
): Promise<LmsCatalogueVersionSummaryDto[]> {
  const { data } = await getLaboratoryApi().get<LmsCatalogueVersionSummaryDto[]>(
    `/lms/catalogue/${id}/versions`,
  );
  return data;
}

export async function createLmsCatalogueDraft(
  body: LmsCreateCatalogueDraftRequest,
): Promise<LmsCatalogueItemDetailDto> {
  const { data } = await getLaboratoryApi().post<LmsCatalogueItemDetailDto>(
    '/lms/catalogue',
    body,
  );
  return data;
}

export async function updateLmsCatalogueDraft(
  id: string,
  body: LmsUpdateCatalogueDraftRequest,
): Promise<LmsCatalogueItemDetailDto> {
  const { data } = await getLaboratoryApi().put<LmsCatalogueItemDetailDto>(
    `/lms/catalogue/${id}/draft`,
    body,
  );
  return data;
}

export async function submitLmsCatalogueReview(
  id: string,
  body: LmsLifecycleActionRequest = {},
): Promise<LmsCatalogueItemDetailDto> {
  const { data } = await getLaboratoryApi().post<LmsCatalogueItemDetailDto>(
    `/lms/catalogue/${id}/submit-review`,
    body,
  );
  return data;
}

export async function returnLmsCatalogueDraft(
  id: string,
  body: LmsLifecycleActionRequest = {},
): Promise<LmsCatalogueItemDetailDto> {
  const { data } = await getLaboratoryApi().post<LmsCatalogueItemDetailDto>(
    `/lms/catalogue/${id}/return-draft`,
    body,
  );
  return data;
}

export async function approveLmsCatalogue(
  id: string,
  body: LmsLifecycleActionRequest = {},
): Promise<LmsCatalogueItemDetailDto> {
  const { data } = await getLaboratoryApi().post<LmsCatalogueItemDetailDto>(
    `/lms/catalogue/${id}/approve`,
    body,
  );
  return data;
}

export async function activateLmsCatalogue(
  id: string,
  body: LmsLifecycleActionRequest = {},
): Promise<LmsCatalogueItemDetailDto> {
  const { data } = await getLaboratoryApi().post<LmsCatalogueItemDetailDto>(
    `/lms/catalogue/${id}/activate`,
    body,
  );
  return data;
}

export async function retireLmsCatalogue(
  id: string,
  body: LmsLifecycleActionRequest = {},
): Promise<LmsCatalogueItemDetailDto> {
  const { data } = await getLaboratoryApi().post<LmsCatalogueItemDetailDto>(
    `/lms/catalogue/${id}/retire`,
    body,
  );
  return data;
}

export async function supersedeLmsCatalogue(
  id: string,
  body: LmsLifecycleActionRequest = {},
): Promise<LmsCatalogueItemDetailDto> {
  const { data } = await getLaboratoryApi().post<LmsCatalogueItemDetailDto>(
    `/lms/catalogue/${id}/supersede`,
    body,
  );
  return data;
}
