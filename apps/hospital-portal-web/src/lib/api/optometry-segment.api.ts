import { getApi } from '../api';

export interface OptometrySegmentExamDto {
  id: string;
  visitId: string;
  patientId: string;
  segmentKey: string;
  data: unknown;
  updatedAt: string;
}

export interface SaveOptometrySegmentRequest {
  patientId: string;
  data: unknown;
}

export const optometrySegmentApi = {
  async listByVisit(visitId: string): Promise<OptometrySegmentExamDto[]> {
    const api = getApi();
    const res = await api.get<OptometrySegmentExamDto[]>(
      `/visits/${visitId}/optometry-segments`,
    );
    return res.data;
  },

  async getSegment(
    visitId: string,
    segmentKey: string,
  ): Promise<OptometrySegmentExamDto | null> {
    const api = getApi();
    try {
      const res = await api.get<OptometrySegmentExamDto>(
        `/visits/${visitId}/optometry-segments/${segmentKey}`,
      );
      return res.data;
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) return null;
      throw err;
    }
  },

  async upsertSegment(
    visitId: string,
    segmentKey: string,
    body: SaveOptometrySegmentRequest,
  ): Promise<OptometrySegmentExamDto> {
    const api = getApi();
    const res = await api.put<OptometrySegmentExamDto>(
      `/visits/${visitId}/optometry-segments/${segmentKey}`,
      body,
    );
    return res.data;
  },
};
