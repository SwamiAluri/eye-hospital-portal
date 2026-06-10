/**
 * Examination Draft API
 *
 * Manages saving and retrieving examination drafts from the backend.
 * Drafts are auto-saved every 30 seconds and expire after 24 hours.
 * Visit-scoped when visitId is provided (optometry exam).
 */

import { getApi } from '../api';

export interface ExaminationDraftData {
  patientId: string;
  doctorId: string;
  visitId?: string;
  data: unknown;
  expiresAt?: string;
}

export interface ExaminationDraft {
  id: string;
  patientId: string;
  doctorId: string;
  visitId?: string | null;
  data: unknown;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export const examinationDraftApi = {
  /**
   * Save or update examination draft (upsert by patient + doctor + visit when visitId set).
   * POST /api/Examinations/draft
   */
  async saveDraft(draftData: ExaminationDraftData): Promise<ExaminationDraft> {
    const api = getApi();
    const response = await api.post<ExaminationDraft>('/Examinations/draft', draftData);
    return response.data;
  },

  /**
   * Get draft for a patient, optionally scoped to a visit.
   * GET /api/Examinations/draft/{patientId}?visitId=
   */
  async getDraft(patientId: string, visitId?: string): Promise<ExaminationDraft | null> {
    const api = getApi();
    try {
      const params = visitId ? { visitId } : undefined;
      const response = await api.get<ExaminationDraft>(`/Examinations/draft/${patientId}`, {
        params,
      });
      return response.data;
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Check if draft exists for patient (optional visit scope).
   * HEAD /api/Examinations/draft/{patientId}?visitId=
   */
  async hasDraft(patientId: string, visitId?: string): Promise<boolean> {
    const api = getApi();
    try {
      const params = visitId ? { visitId } : undefined;
      await api.head(`/Examinations/draft/${patientId}`, { params });
      return true;
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        return false;
      }
      console.error('Error checking draft existence:', error);
      return false;
    }
  },

  /**
   * Delete draft for a patient (optional visit scope).
   * DELETE /api/Examinations/draft/{patientId}?visitId=
   */
  async deleteDraft(patientId: string, visitId?: string): Promise<void> {
    const api = getApi();
    const params = visitId ? { visitId } : undefined;
    await api.delete(`/Examinations/draft/${patientId}`, { params });
  },

  /**
   * Get all drafts for current doctor
   * GET /api/Examinations/drafts
   */
  async getAllDrafts(): Promise<ExaminationDraft[]> {
    const api = getApi();
    const response = await api.get<ExaminationDraft[]>('/Examinations/drafts');
    return response.data;
  },

  /**
   * Cleanup expired drafts (admin endpoint)
   * POST /api/Examinations/drafts/cleanup
   */
  async cleanupExpiredDrafts(): Promise<{ deletedCount: number }> {
    const api = getApi();
    const response = await api.post<{ deletedCount: number }>('/Examinations/drafts/cleanup');
    return response.data;
  },
};

export default examinationDraftApi;
