import { getApi } from '../api';
import type {
  OptometryLatestPriorResponse,
  OptometryPatientHistoryResponse,
  OptometryVisitExamRecord,
} from '@/lib/optometry/optometry-history.types';

export const optometryHistoryApi = {
  async getHistory(
    patientId: string,
    options?: {
      excludeVisitId?: string;
      excludeSameDayAsVisitId?: string;
      limit?: number;
    },
  ): Promise<OptometryPatientHistoryResponse> {
    const api = getApi();
    const params = new URLSearchParams();
    if (options?.excludeVisitId) params.set('excludeVisitId', options.excludeVisitId);
    if (options?.excludeSameDayAsVisitId) {
      params.set('excludeSameDayAsVisitId', options.excludeSameDayAsVisitId);
    }
    if (options?.limit != null) params.set('limit', String(options.limit));
    const qs = params.toString();
    const res = await api.get<OptometryPatientHistoryResponse>(
      `/patients/${patientId}/optometry-exams/history${qs ? `?${qs}` : ''}`,
    );
    return res.data;
  },

  async getLatestPrior(
    patientId: string,
    options?: { excludeVisitId?: string; excludeSameDayAsVisitId?: string },
  ): Promise<OptometryLatestPriorResponse> {
    const api = getApi();
    const params = new URLSearchParams();
    if (options?.excludeVisitId) params.set('excludeVisitId', options.excludeVisitId);
    if (options?.excludeSameDayAsVisitId) {
      params.set('excludeSameDayAsVisitId', options.excludeSameDayAsVisitId);
    }
    const qs = params.toString();
    const res = await api.get<OptometryLatestPriorResponse>(
      `/patients/${patientId}/optometry-exams/latest-prior${qs ? `?${qs}` : ''}`,
    );
    return res.data;
  },

  async getVisitExam(visitId: string): Promise<OptometryVisitExamRecord> {
    const api = getApi();
    const res = await api.get<OptometryVisitExamRecord>(`/visits/${visitId}/optometry-exams`);
    return res.data;
  },

  async archiveVisitExam(
    visitId: string,
    patientId: string,
    snapshot?: unknown,
  ): Promise<void> {
    const api = getApi();
    await api.post(`/visits/${visitId}/optometry-exams/archive`, {
      patientId,
      snapshot: snapshot ?? undefined,
    });
  },
};
