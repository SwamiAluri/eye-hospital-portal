import { getApi } from '../api';

export interface SavedCounsellingRecording {
  conversationId: string;
  sequenceNumber?: number;
  recordingId: string;
  contentType?: string;
  recordingState?: string;
  durationSeconds?: number;
  createdAt?: string;
  message?: string;
}

export const counsellingRecordingApi = {
  async list(sessionId: string): Promise<{
    conversations: Array<{
      id: string;
      sequenceNumber: number;
      startedAt: string;
      endedAt?: string | null;
      status: string;
      createdAt: string;
      counsellorName?: string | null;
      recordings: Array<{
        id: string;
        createdAt: string;
        durationSeconds?: number | null;
        contentType?: string | null;
        fileSizeBytes?: number | null;
        updatedAt?: string | null;
        createdByUserId?: string | null;
        recordingState: string;
        transcriptionStatus?: string | null;
        retentionExpiresAt?: string | null;
      }>;
    }>;
  }> {
    const response = await getApi().get<{
      conversations: Array<{
        id: string;
        sequenceNumber: number;
        startedAt: string;
        endedAt?: string | null;
        status: string;
        createdAt: string;
        counsellorName?: string | null;
        recordings: Array<{
          id: string;
          createdAt: string;
          durationSeconds?: number | null;
          contentType?: string | null;
          fileSizeBytes?: number | null;
          updatedAt?: string | null;
          createdByUserId?: string | null;
          recordingState: string;
          transcriptionStatus?: string | null;
          retentionExpiresAt?: string | null;
        }>;
      }>;
    }>(`/Counseling/sessions/${sessionId}/conversations`);
    return response.data;
  },

  async upload(input: {
    sessionId: string;
    audio: Blob;
    fileName: string;
    durationSeconds: number;
    version: number;
  }): Promise<SavedCounsellingRecording> {
    const form = new FormData();
    form.append('audioFile', input.audio, input.fileName);
    form.append('durationSeconds', String(input.durationSeconds));
    form.append('version', String(input.version));
    const response = await getApi().post<SavedCounsellingRecording>(
      `/Counseling/sessions/${input.sessionId}/recordings`,
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      },
    );
    return response.data;
  },

  async openContent(sessionId: string, recordingId: string): Promise<Blob> {
    const response = await getApi().get<Blob>(
      `/Counseling/sessions/${sessionId}/recordings/${recordingId}/content`,
      { responseType: 'blob', timeout: 120000 },
    );
    return response.data;
  },

  async downloadSelected(sessionId: string, recordingIds: string[]): Promise<Blob> {
    const response = await getApi().post<Blob>(
      `/Counseling/sessions/${sessionId}/recordings/download`,
      { recordingIds },
      { responseType: 'blob', timeout: 120000 },
    );
    return response.data;
  },

  async deleteSelected(sessionId: string, recordingIds: string[]): Promise<{ deletedCount: number; failedCount: number }> {
    const response = await getApi().post<{ deletedCount: number; failedCount: number }>(
      `/Counseling/sessions/${sessionId}/recordings/delete`,
      { recordingIds },
    );
    return response.data;
  },
};
