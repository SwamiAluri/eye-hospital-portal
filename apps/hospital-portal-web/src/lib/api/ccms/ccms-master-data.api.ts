// CCMS – Master Data API client (payers, TPA, govt schemes, packages)
import { getCcmsApi } from './ccms-base';

export type PayerCategory = 'insurance' | 'other_debtor';

export interface InsurancePayer {
  id: string;
  name: string;
  /** Master `insurance.provider` code — matches CCMS `provider_code` */
  providerCode?: string;
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
  /** Required for insurance payers — must match a master `insurance.provider` code */
  providerCode?: string;
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

function mapInsurancePayer(p: Record<string, unknown>): InsurancePayer {
  const code = (p.providerCode ?? p.shortCode) as string | undefined;
  return {
    id: p.id as string,
    name: (p.providerName ?? p.name ?? '') as string,
    providerCode: code,
    shortCode: code,
    tpaId: p.tpaId as string | undefined,
    contactEmail: p.contactEmail as string | undefined,
    contactPhone: p.contactPhone as string | undefined,
    portalUrl: p.portalUrl as string | undefined,
    status: (p.status as string) ?? 'active',
    payerCategory: p.payerCategory as PayerCategory | undefined,
    debtorSubtype: p.debtorSubtype as string | undefined,
    creditLimit: p.creditLimit as number | undefined,
    exportCode: p.exportCode as string | undefined,
    hospitalIdentifier: p.hospitalIdentifier as string | undefined,
    serviceTaxApplicable: p.serviceTaxApplicable as boolean | undefined,
    defaultServiceTaxPercent: p.defaultServiceTaxPercent as number | undefined,
    tdsMandatory: p.tdsMandatory as boolean | undefined,
    validFrom: p.validFrom as string | undefined,
    validTo: p.validTo as string | undefined,
    formatCode: p.formatCode as string | undefined,
  };
}

function toCreatePayerPayload(req: CreatePayerRequest): Record<string, unknown> {
  const code = req.providerCode ?? req.shortCode;
  return {
    providerName: req.name,
    providerCode: code,
    contactEmail: req.contactEmail,
    contactPhone: req.contactPhone,
    portalUrl: req.portalUrl,
    payerCategory: req.payerCategory ?? 'insurance',
    debtorSubtype: req.debtorSubtype,
    creditLimit: req.creditLimit,
    exportCode: req.exportCode,
    hospitalIdentifier: req.hospitalIdentifier,
    serviceTaxApplicable: req.serviceTaxApplicable,
    defaultServiceTaxPercent: req.defaultServiceTaxPercent,
    tdsMandatory: req.tdsMandatory,
    validFrom: req.validFrom,
    validTo: req.validTo,
    formatCode: req.formatCode,
  };
}

export async function listInsurancePayers(): Promise<InsurancePayer[]> {
  const { data } = await getCcmsApi().get('/ccms/master/insurance-providers');
  const items: Record<string, unknown>[] = Array.isArray(data) ? data : (data?.items ?? []);
  return items.map(mapInsurancePayer);
}

export async function createInsurancePayer(req: CreatePayerRequest): Promise<InsurancePayer> {
  const { data } = await getCcmsApi().post('/ccms/master/insurance-providers', toCreatePayerPayload(req));
  return mapInsurancePayer(data as Record<string, unknown>);
}

export async function updateInsurancePayer(id: string, req: UpdatePayerRequest): Promise<InsurancePayer> {
  const { data } = await getCcmsApi().put(`/ccms/master/insurance-providers/${id}`, toCreatePayerPayload(req as CreatePayerRequest));
  return mapInsurancePayer(data as Record<string, unknown>);
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

export interface DocumentRequirement {
  id: string;
  documentType: string;
  documentName: string;
  isRequired: boolean;
  appliesAt?: string;
  insuranceProviderId?: string | null;
  tpaProviderId?: string | null;
  governmentSchemeId?: string | null;
}

function readString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function readBool(row: Record<string, unknown>, ...keys: string[]): boolean {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === 1) return true;
    if (value === 'false' || value === 0) return false;
  }
  return false;
}

export function mapDocumentRequirementRow(row: Record<string, unknown>): DocumentRequirement {
  const documentType = readString(row, 'documentType', 'DocumentType');
  const documentName = readString(row, 'documentName', 'DocumentName') || documentType;
  return {
    id: readString(row, 'id', 'Id'),
    documentType,
    documentName,
    isRequired: readBool(row, 'isRequired', 'IsRequired', 'required', 'Required'),
    appliesAt: readString(row, 'appliesAt', 'AppliesAt') || undefined,
    insuranceProviderId:
      (readString(row, 'insuranceProviderId', 'InsuranceProviderId') || null) as string | null,
    tpaProviderId:
      (readString(row, 'tpaProviderId', 'TpaProviderId') || null) as string | null,
    governmentSchemeId:
      (readString(row, 'governmentSchemeId', 'GovernmentSchemeId') || null) as string | null,
  };
}

export async function listDocumentRequirements(opts?: {
  stage?: string;
  payerType?: string;
  insuranceProviderId?: string;
  tpaProviderId?: string;
  governmentSchemeId?: string;
  /** When true, only generic + matching-payer rows (empty ids → generic only). */
  caseScoped?: boolean;
}): Promise<DocumentRequirement[]> {
  const { data } = await getCcmsApi().get('/ccms/master/document-requirements', {
    params: {
      stage: opts?.stage,
      payerType: opts?.payerType,
      insuranceProviderId: opts?.insuranceProviderId,
      tpaProviderId: opts?.tpaProviderId,
      governmentSchemeId: opts?.governmentSchemeId,
      caseScoped: opts?.caseScoped ? 'true' : undefined,
    },
  });
  const items: Record<string, unknown>[] = Array.isArray(data) ? data : [];
  return items
    .map(mapDocumentRequirementRow)
    .filter((r) => r.documentType.length > 0);
}
