// Transcription API - Module 3.12 Audio Transcription & Translation
import { getApi } from '../api';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface TranscriptSegment {
  start?: number;
  end?: number;
  text: string;
  confidence?: number;
  speaker?: string | null;
}

export interface SessionTranscript {
  id: string;
  recordingId: string;
  languageCode: string;
  languageName: string;
  isOriginalLanguage: boolean;
  transcriptText: string;
  confidenceScore?: number;
  wordCount?: number;
  segments?: TranscriptSegment[];
  createdAt: string;
}

export interface TranscriptionJobResponse {
  recordingId: string;
  status: string; // InProgress, Completed, Failed, NotConfigured, AlreadyCompleted
  jobId?: string;
  message?: string;
}

export interface TranslationJobResponse {
  recordingId: string;
  targetLanguages: string[];
  status: string;
  message?: string;
}

export interface TranscriptEdit {
  id: string;
  transcriptId: string;
  segmentIndex: number;
  originalText: string;
  editedText: string;
  editReason?: string;
  createdAt: string;
  createdByUserName: string;
}

export interface StartTranscriptionRequest {
  sourceLanguage?: string; // Default: 'en-US'
}

export interface StartTranslationRequest {
  recordingId: string;
  sourceTranscriptId: string;
  targetLanguages: string[]; // e.g., ['hi-IN', 'te-IN']
}

export interface EditTranscriptRequest {
  transcriptId: string;
  segmentIndex: number;
  editedText: string;
  editReason?: string;
}

export interface SupportedLanguage {
  code: string;
  name: string;
}

// ============================================================================
// API Functions
// ============================================================================

export const transcriptionApi = {
  /**
   * Start transcription for a recording
   */
  async startTranscription(
    recordingId: string,
    request: StartTranscriptionRequest
  ): Promise<TranscriptionJobResponse> {
    const api = getApi();
    const response = await api.post<TranscriptionJobResponse>(
      `/transcription/start/${recordingId}`,
      request,
      { skipForbiddenRedirect: true },
    );
    return response.data;
  },

  /**
   * Check transcription status for a recording
   */
  async getTranscriptionStatus(recordingId: string): Promise<{ recordingId: string; status: string }> {
    const api = getApi();
    const response = await api.get<{ recordingId: string; status: string }>(
      `/transcription/status/${recordingId}`,
      { skipForbiddenRedirect: true },
    );
    return response.data;
  },

  /**
   * Get all transcripts (all languages) for a recording
   */
  async getTranscripts(recordingId: string): Promise<SessionTranscript[]> {
    const api = getApi();
    const response = await api.get<SessionTranscript[]>(
      `/transcription/${recordingId}/transcripts`,
      { skipForbiddenRedirect: true },
    );
    return response.data;
  },

  /**
   * Start translation for a transcript
   */
  async startTranslation(request: StartTranslationRequest): Promise<TranslationJobResponse> {
    const api = getApi();
    const response = await api.post<TranslationJobResponse>('/transcription/translate', request);
    return response.data;
  },

  /**
   * Edit a transcript segment (manual correction)
   */
  async editTranscriptSegment(request: EditTranscriptRequest): Promise<TranscriptEdit> {
    const api = getApi();
    const response = await api.patch<TranscriptEdit>('/transcription/edit', request);
    return response.data;
  },

  /**
   * Get edit history for a transcript
   */
  async getTranscriptEdits(transcriptId: string): Promise<TranscriptEdit[]> {
    const api = getApi();
    const response = await api.get<TranscriptEdit[]>(`/transcription/${transcriptId}/edits`);
    return response.data;
  },

  /**
   * Get supported languages
   */
  async getSupportedLanguages(): Promise<SupportedLanguage[]> {
    const api = getApi();
    const response = await api.get<SupportedLanguage[]>('/transcription/languages');
    return response.data;
  },
};
