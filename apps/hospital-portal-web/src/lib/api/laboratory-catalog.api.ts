import { getApi } from '../api';

export type LaboratoryCatalogKind = 'test' | 'panel';

export interface LaboratorySpecimenOption {
  specimenType: string;
  isDefault: boolean;
}

export interface LaboratoryAnalyteDto {
  id: string;
  name: string;
  localCode?: string | null;
  valueType: string;
  unit?: string | null;
  referenceRangeText?: string | null;
  displayOrder: number;
}

export type LaboratoryCommercialState =
  | 'MAPPED'
  | 'UNMAPPED'
  | 'NON_BILLABLE'
  | 'UNPRICED';

export interface LaboratoryTestDefinitionDto {
  id: string;
  name: string;
  localCode: string;
  description?: string | null;
  category?: string | null;
  method?: string | null;
  turnaroundHours?: number | null;
  serviceVariantId?: string | null;
  isNonBillable?: boolean;
  isActive: boolean;
  kind: 'test';
  commercialState?: LaboratoryCommercialState;
  serviceVariantCode?: string | null;
  serviceVariantName?: string | null;
  financiallyActionable?: boolean;
  resolverKind?: string | null;
  specimenTypes: LaboratorySpecimenOption[];
  analytes?: LaboratoryAnalyteDto[];
}

export interface LaboratoryCommercialStateDto {
  testDefinitionId: string;
  localCode: string;
  name: string;
  category?: string | null;
  isActive: boolean;
  isNonBillable: boolean;
  serviceVariantId?: string | null;
  serviceVariantCode?: string | null;
  serviceVariantName?: string | null;
  commercialState: LaboratoryCommercialState;
  resolverKind?: string | null;
  resolverReason?: string | null;
  financiallyActionable: boolean;
}

/** L3-UX-01 read-only Order Summary line (amounts only when FIN-VIS authorized). */
export interface LaboratoryOrderSummaryLineDto {
  testDefinitionId: string;
  localCode: string;
  name: string;
  category?: string | null;
  panelId?: string | null;
  panelName?: string | null;
  panelCode?: string | null;
  quantity: number;
  commercialState: LaboratoryCommercialState;
  serviceVariantId?: string | null;
  serviceVariantCode?: string | null;
  serviceVariantName?: string | null;
  financiallyActionable: boolean;
  unitPrice?: number | null;
  lineEstimate?: number | null;
}

export interface LaboratoryOrderSummaryDto {
  selectedItemCount: number;
  lineCount: number;
  financialAmountsVisible: boolean;
  estimateTotal?: number | null;
  lines: LaboratoryOrderSummaryLineDto[];
}

export interface LaboratoryOrderSummaryPayload {
  items: Array<{ testDefinitionId?: string; panelId?: string }>;
}

export interface LaboratoryServiceVariantOptionDto {
  id: string;
  code?: string | null;
  name: string;
  isActive: boolean;
}

export interface LaboratoryPanelSummaryDto {
  id: string;
  name: string;
  localCode: string;
  description?: string | null;
  category?: string | null;
  isActive: boolean;
  kind: 'panel';
}

export interface LaboratoryPanelDetailDto extends LaboratoryPanelSummaryDto {
  items: Array<{
    testDefinitionId: string;
    displayOrder: number;
    isRequired: boolean;
    test: LaboratoryTestDefinitionDto | null;
  }>;
}

export interface LaboratoryCatalogOrderPayload {
  patientId: string;
  visitId?: string;
  testDefinitionId?: string;
  panelId?: string;
  items?: Array<{ testDefinitionId?: string; panelId?: string }>;
  specimenType?: string;
  orderedById: string;
  clinicalIndication: string;
  notes?: string;
  priority?: string;
}

export interface LaboratoryTestWritePayload {
  name: string;
  localCode: string;
  description?: string;
  category?: string;
  method?: string;
  turnaroundHours?: number;
  serviceVariantId?: string;
  specimenTypes: string[];
  analytes?: Array<{
    name: string;
    localCode?: string;
    valueType?: string;
    unit?: string;
    referenceRangeText?: string;
  }>;
}

export interface LaboratoryPanelWritePayload {
  name: string;
  localCode: string;
  description?: string;
  category?: string;
  testDefinitionIds: string[];
}

export interface LaboratoryOrderingClinicianDto {
  id: string;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  specialization?: string | null;
  department?: string | null;
  qualification?: string | null;
  licenseNumber?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
}

export const laboratoryCatalogApi = {
  searchTests(params?: { search?: string; activeOnly?: boolean; take?: number }) {
    return getApi().get<LaboratoryTestDefinitionDto[]>('/laboratory/catalog/tests', {
      params,
      skipForbiddenRedirect: true,
    });
  },

  getTest(id: string) {
    return getApi().get<LaboratoryTestDefinitionDto>(`/laboratory/catalog/tests/${id}`, {
      skipForbiddenRedirect: true,
    });
  },

  searchPanels(params?: { search?: string; activeOnly?: boolean; take?: number }) {
    return getApi().get<LaboratoryPanelSummaryDto[]>('/laboratory/catalog/panels', {
      params,
      skipForbiddenRedirect: true,
    });
  },

  getPanel(id: string) {
    return getApi().get<LaboratoryPanelDetailDto>(`/laboratory/catalog/panels/${id}`, {
      skipForbiddenRedirect: true,
    });
  },

  createTest(payload: LaboratoryTestWritePayload) {
    return getApi().post<LaboratoryTestDefinitionDto>('/laboratory/catalog/tests', payload, {
      skipForbiddenRedirect: true,
    });
  },

  createPanel(payload: LaboratoryPanelWritePayload) {
    return getApi().post<LaboratoryPanelDetailDto>('/laboratory/catalog/panels', payload, {
      skipForbiddenRedirect: true,
    });
  },

  /** L2 least-privilege clinician lookup (patient.view) — not /users/doctors/search. */
  searchOrderingClinicians(params?: { search?: string; take?: number }) {
    return getApi().get<{ data: LaboratoryOrderingClinicianDto[]; count: number }>(
      '/laboratory/catalog/ordering-clinicians',
      { params, skipForbiddenRedirect: true },
    );
  },

  /** L3-COM-01 commercial read model (no monetary amounts). */
  getCommercialState(testId: string) {
    return getApi().get<LaboratoryCommercialStateDto>(
      `/laboratory/catalog/tests/${testId}/commercial`,
      { skipForbiddenRedirect: true },
    );
  },

  /** L3-UX-01 read-only Order Summary / estimate (server enforces FIN-VIS amounts). */
  getOrderSummary(payload: LaboratoryOrderSummaryPayload) {
    return getApi().post<LaboratoryOrderSummaryDto>(
      '/laboratory/catalog/order-summary',
      payload,
      { skipForbiddenRedirect: true },
    );
  },

  mapServiceVariant(testId: string, serviceVariantId: string) {
    return getApi().put<LaboratoryCommercialStateDto>(
      `/laboratory/catalog/tests/${testId}/commercial/map`,
      { serviceVariantId },
      { skipForbiddenRedirect: true },
    );
  },

  unmapServiceVariant(testId: string) {
    return getApi().delete<LaboratoryCommercialStateDto>(
      `/laboratory/catalog/tests/${testId}/commercial/map`,
      { skipForbiddenRedirect: true },
    );
  },

  setNonBillable(testId: string, isNonBillable: boolean) {
    return getApi().put<LaboratoryCommercialStateDto>(
      `/laboratory/catalog/tests/${testId}/commercial/non-billable`,
      { isNonBillable },
      { skipForbiddenRedirect: true },
    );
  },

  /** Active ServiceVariant identity picker (no prices; patient.update). */
  searchServiceVariants(params?: { search?: string; take?: number }) {
    return getApi().get<LaboratoryServiceVariantOptionDto[]>(
      '/laboratory/catalog/service-variants',
      { params, skipForbiddenRedirect: true },
    );
  },
};
