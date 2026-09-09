// Diagnoses API - ICD-10 Code Search & Patient Diagnosis Management
// Phase 3: Prescription & Clinical Examination

import { getApi } from '../api';
import {
  DiagnosisCode,
  DiagnosisSearchResult,
  DiagnosisSuggestion,
  PatientDiagnosis,
  CreatePatientDiagnosisRequest,
  UpdatePatientDiagnosisRequest,
} from '@/types/diagnosis';

/**
 * Search ICD-10 diagnosis codes
 * GET /api/diagnoses/search
 */
export async function searchDiagnosisCodes(
  query: string,
  ophthalmologyOnly: boolean = true,
  maxResults: number = 20
): Promise<DiagnosisSearchResult[]> {
  const api = getApi();
  const response = await api.get<DiagnosisCode[] | { data?: DiagnosisCode[] }>('/diagnoses/search', {
    params: { query, limit: maxResults },
  });

  const payload = response.data;
  const rawList: unknown[] = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown })?.data)
      ? ((payload as { data: unknown[] }).data)
      : [];

  const queryLower = query.toLowerCase();
  const mapped = rawList
    .map((row) => normalizeDiagnosisCode(row))
    .filter((code): code is DiagnosisCode => !!code?.code);

  const filtered = ophthalmologyOnly
    ? mapped.filter((c) => c.isOphthalmology !== false)
    : mapped;

  return filtered.map((code) => {
    const codeLower = code.code.toLowerCase();
    const descLower = (code.description ?? '').toLowerCase();

    let matchType: 'exact' | 'partial' | 'fuzzy' = 'fuzzy';
    if (codeLower === queryLower || descLower === queryLower) {
      matchType = 'exact';
    } else if (codeLower.startsWith(queryLower) || descLower.startsWith(queryLower)) {
      matchType = 'partial';
    }

    const score = matchType === 'exact' ? 100 : matchType === 'partial' ? 75 : 50;

    return {
      code,
      score,
      matchType,
    };
  });
}

function normalizeDiagnosisCode(row: unknown): DiagnosisCode | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const code = String(r.code ?? r.Code ?? '').trim();
  if (!code) return null;
  const description = String(r.description ?? r.Description ?? '').trim();
  const isOphthalmologyRaw = r.isOphthalmology ?? r.IsOphthalmology;
  return {
    id: String(r.id ?? r.Id ?? code),
    code,
    description,
    category: String(r.category ?? r.Category ?? ''),
    icdVersion: String(r.icdVersion ?? r.IcdVersion ?? 'ICD-10'),
    isOphthalmology:
      typeof isOphthalmologyRaw === 'boolean' ? isOphthalmologyRaw : true,
    laterality: (r.laterality ?? r.Laterality ?? null) as DiagnosisCode['laterality'],
    commonUsage: (r.commonUsage ?? r.CommonUsage) as string | undefined,
    clinicalNotes: (r.clinicalNotes ?? r.ClinicalNotes) as string | undefined,
  };
}

/**
 * Get smart diagnosis suggestions based on patient demographics
 * POST /api/diagnoses/suggest
 */
export async function getDiagnosisSuggestions(
  patientId: string,
  age?: number,
  gender?: string
): Promise<DiagnosisSuggestion[]> {
  const api = getApi();
  const response = await api.post<DiagnosisCode[]>('/diagnoses/suggest', {
    patientId,
    age,
    gender,
  });
  
  // Transform backend response to frontend format with reason and confidence
  return response.data.map((code, index) => ({
    code,
    reason: `Suggested based on clinical profile`,
    confidence: Math.max(0.6, 1 - (index * 0.1)), // Simple confidence scoring
    relatedCodes: [],
  }));
}

/**
 * Get diagnosis code by ID
 * GET /api/diagnoses/{id}
 */
export async function getDiagnosisCodeById(id: string): Promise<DiagnosisCode> {
  const api = getApi();
  const response = await api.get(`/diagnoses/${id}`);
  return response.data;
}

/**
 * Get ICD-10 categories
 * GET /api/diagnoses/categories
 */
export async function getDiagnosisCategories(): Promise<string[]> {
  const api = getApi();
  const response = await api.get('/diagnoses/categories');
  return response.data;
}

/**
 * Get patient diagnoses
 * GET /api/diagnoses/patient/{patientId}
 */
export async function getPatientDiagnoses(patientId: string): Promise<PatientDiagnosis[]> {
  const api = getApi();
  const response = await api.get(`/diagnoses/patient/${patientId}`);
  return response.data;
}

/**
 * Add diagnosis to patient
 * POST /api/diagnoses/patient
 */
export async function addPatientDiagnosis(
  request: CreatePatientDiagnosisRequest
): Promise<PatientDiagnosis> {
  const api = getApi();
  const response = await api.post('/diagnoses/patient', request);
  return response.data;
}

/**
 * Update patient diagnosis
 * PUT /api/diagnoses/patient/{id}
 */
export async function updatePatientDiagnosis(
  id: string,
  request: UpdatePatientDiagnosisRequest
): Promise<PatientDiagnosis> {
  const api = getApi();
  const response = await api.put(`/diagnoses/patient/${id}`, request);
  return response.data;
}

/**
 * Delete patient diagnosis
 * DELETE /api/diagnoses/patient/{id}
 */
export async function deletePatientDiagnosis(id: string): Promise<void> {
  const api = getApi();
  await api.delete(`/diagnoses/patient/${id}`);
}
