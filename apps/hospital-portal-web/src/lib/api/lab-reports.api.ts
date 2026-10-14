import { getApi } from '../api';

export interface LabReport {
  id: string;
  patientId: string;
  visitId?: string;
  tenantId?: string;
  testDefinitionId?: string | null;
  panelId?: string | null;
  testName: string;
  testCode?: string;
  testCategory: string; // hematology, biochemistry, microbiology, pathology, ophthalmology
  clinicalIndication?: string | null;
  orderedByName?: string;
  orderedById?: string;
  items?: Array<{
    id: string;
    testDefinitionId?: string | null;
    testName: string;
    testCode?: string | null;
    testCategory?: string | null;
    displayOrder: number;
  }>;
  orderedAt?: string;
  sampleCollectedAt?: string;
  completedAt?: string;
  resultValue?: string;
  resultUnit?: string;
  referenceRange?: string;
  interpretation?: string; // normal, abnormal, critical, high, low
  labName?: string;
  technicianName?: string;
  verifiedByName?: string;
  specimenType?: string;
  priority: string;
  notes?: string;
  reportUrl?: string;
  status: string; // ordered, sample_collected, in_progress, completed, cancelled, on_hold
  /** Worklist projection — populated by GET /lab-reports list only */
  patientDisplayName?: string | null;
  /** Worklist projection — populated by GET /lab-reports list only */
  medicalRecordNumber?: string | null;
  canonicalDocumentId?: string | null;
  canonicalFileName?: string | null;
  canonicalMimeType?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface LabReportListParams {
  status?: string;
  category?: string;
  priority?: string;
  search?: string;
  take?: number;
}

export interface LabReportFormData {
  patientId: string;
  visitId?: string;
  testName: string;
  testCode?: string;
  testCategory: string;
  orderedByName?: string;
  orderedById?: string;
  orderedAt?: string;
  specimenType?: string;
  priority?: string;
  notes?: string;
  status?: string;
}

export interface LabReportResultData {
  resultValue?: string;
  resultUnit?: string;
  referenceRange?: string;
  interpretation?: string;
}

export const labReportsApi = {
  /** Tenant worklist — GET /lab-reports (server-side filters only). */
  async list(params?: LabReportListParams) {
    const api = getApi();
    const queryParts: string[] = [];
    if (params?.status) queryParts.push(`status=${encodeURIComponent(params.status)}`);
    if (params?.category) queryParts.push(`category=${encodeURIComponent(params.category)}`);
    if (params?.priority) queryParts.push(`priority=${encodeURIComponent(params.priority)}`);
    if (params?.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);
    if (params?.take) queryParts.push(`take=${params.take}`);
    const query = queryParts.length ? `?${queryParts.join('&')}` : '';
    return api.get<LabReport[]>(`/lab-reports${query}`);
  },

  async getByPatient(patientId: string, params?: { status?: string; category?: string }) {
    const api = getApi();
    const queryParts: string[] = [];
    if (params?.status) queryParts.push(`status=${params.status}`);
    if (params?.category) queryParts.push(`category=${params.category}`);
    const query = queryParts.length ? `?${queryParts.join('&')}` : '';
    return api.get<LabReport[]>(`/lab-reports/patient/${patientId}${query}`);
  },

  async getById(id: string) {
    const api = getApi();
    return api.get<LabReport>(`/lab-reports/${id}`);
  },

  async create(data: LabReportFormData) {
    const api = getApi();
    return api.post<LabReport>('/lab-reports', data);
  },

  /** L2 catalog-driven create — server derives name/code/category/specimen. */
  async createFromCatalog(data: {
    patientId: string;
    visitId?: string;
    /** Legacy single-test; prefer items for multi-test one LabReport. */
    testDefinitionId?: string;
    panelId?: string;
    items?: Array<{ testDefinitionId?: string; panelId?: string }>;
    specimenType?: string;
    orderedById: string;
    clinicalIndication: string;
    notes?: string;
    priority?: string;
  }) {
    const api = getApi();
    return api.post<LabReport>('/lab-reports/catalog-order', data);
  },

  async update(id: string, data: Partial<LabReportFormData>) {
    const api = getApi();
    return api.put<LabReport>(`/lab-reports/${id}`, data);
  },

  async complete(id: string, result: LabReportResultData) {
    const api = getApi();
    return api.post<LabReport>(`/lab-reports/${id}/complete`, result);
  },

  async attachReport(id: string, file: File) {
    const api = getApi();
    const form = new FormData();
    form.append('file', file);
    return api.post<LabReport>(`/lab-reports/${id}/attach-report`, form);
  },

  async delete(id: string) {
    const api = getApi();
    return api.delete(`/lab-reports/${id}`);
  },
};

export async function downloadLabReportContent(labReportId: string): Promise<Blob> {
  const { data } = await getApi().get<Blob>(`/lab-reports/${labReportId}/report/content`, {
    responseType: 'blob',
  });
  return data;
}
