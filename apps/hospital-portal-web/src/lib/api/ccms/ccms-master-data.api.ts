// CCMS – Master Data API client (payers, TPA, govt schemes, packages)
import { getCcmsApi } from './ccms-base';

export type PayerCategory = 'insurance' | 'other_debtor';

export interface InsurancePayer {
  id: string;
  name: string;
  shortCode?: string;
  tpaId?: string;
  contactEmail?: string;
  contactPhone?: string;
  portalUrl?: string;
  status: string;
  // Migration 123 fields
  payerCategory?: PayerCategory;
  debtorSubtype?: string;
  creditLimit?: number;
  exportCode?: string;
  hospitalIdentifier?: string;
  serviceTaxApplicable?: boolean;
  defaultServiceTaxPercent?: number;
  tdsMandatory?: boolean;
  validFrom?: string;
  validTo?: string;
  formatCode?: string;
}

export interface TpaOrganization {
  id: string;
  name: string;
  shortCode?: string;
  contactEmail?: string;
  contactPhone?: string;
  claimsEmail?: string;
  tatDaysPreauth?: number;
  tatDaysClaim?: number;
  status: string;
}

export interface GovernmentScheme {
  id: string;
  schemeName: string;
  schemeCode: string;
  stateCode?: string;
  coverageDescription?: string;
  status: string;
}

export interface CoveragePackage {
  id: string;
  packageName: string;
  packageCode: string;
  payerId?: string;
  coverageLimit: number;
  coPayPercentage?: number;
  status: string;
}

export interface CreatePayerRequest {
  name: string;
  shortCode?: string;
  tpaId?: string;
  contactEmail?: string;
  contactPhone?: string;
  portalUrl?: string;
  payerCategory?: PayerCategory;
  debtorSubtype?: string;
  creditLimit?: number;
  exportCode?: string;
  hospitalIdentifier?: string;
  serviceTaxApplicable?: boolean;
  defaultServiceTaxPercent?: number;
  tdsMandatory?: boolean;
  validFrom?: string;
  validTo?: string;
  formatCode?: string;
}

export type UpdatePayerRequest = Partial<CreatePayerRequest>;

export async function listInsurancePayers(): Promise<InsurancePayer[]> {
  const { data } = await getCcmsApi().get('/ccms/master/insurance-providers');
  const items: any[] = Array.isArray(data) ? data : (data?.items ?? []);
  return items.map(p => ({
    id: p.id,
    name: p.providerName ?? p.name ?? '',
    shortCode: p.providerCode ?? p.shortCode,
    contactEmail: p.contactEmail,
    contactPhone: p.contactPhone,
    status: p.status ?? 'active',
  }));
}

export async function createInsurancePayer(req: CreatePayerRequest): Promise<InsurancePayer> {
  const { data } = await getCcmsApi().post('/ccms/master/insurance-providers', req);
  return data;
}

export async function updateInsurancePayer(id: string, req: UpdatePayerRequest): Promise<InsurancePayer> {
  const { data } = await getCcmsApi().put(`/ccms/master/insurance-providers/${id}`, req);
  return data;
}

export async function deleteInsurancePayer(id: string): Promise<void> {
  await getCcmsApi().delete(`/ccms/master/insurance-providers/${id}`);
}

export async function listTpaOrganizations(): Promise<TpaOrganization[]> {
  const { data } = await getCcmsApi().get('/ccms/master/tpa-providers');
  const items: any[] = Array.isArray(data) ? data : (data?.items ?? []);
  return items.map(t => ({
    id: t.id,
    name: t.tpaName ?? t.name ?? '',
    shortCode: t.tpaCode ?? t.shortCode,
    contactEmail: t.contactEmail,
    contactPhone: t.contactPhone,
    status: t.status ?? 'active',
  }));
}

export async function listGovernmentSchemes(): Promise<GovernmentScheme[]> {
  const { data } = await getCcmsApi().get('/ccms/master/government-schemes');
  const items: any[] = Array.isArray(data) ? data : (data?.items ?? []);
  return items.map(s => ({
    id: s.id,
    schemeName: s.schemeName ?? s.name ?? '',
    schemeCode: s.schemeCode ?? s.code ?? '',
    status: s.status ?? 'active',
  }));
}

export async function listCoveragePackages(payerId?: string): Promise<CoveragePackage[]> {
  const { data } = await getCcmsApi().get('/ccms/master/coverage-packages', {
    params: payerId ? { payerId } : undefined,
  });
  return Array.isArray(data) ? data : (data?.items ?? []);
}
