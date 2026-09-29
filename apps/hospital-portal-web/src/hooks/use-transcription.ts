// Transcription Hooks - React Query hooks for audio transcription & translation
import { useMutation, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import {
  transcriptionApi,
  type SessionTranscript,
  type TranscriptSegment,
  type TranscriptionJobResponse,
  type TranslationJobResponse,
  type TranscriptEdit,
  type StartTranscriptionRequest,
  type StartTranslationRequest,
  type EditTranscriptRequest,
  type SupportedLanguage,
} from '@/lib/api/transcription.api';

// ============================================================================
// Query Keys
// ============================================================================

export const transcriptionKeys = {
  all: ['transcription'] as const,
  status: (recordingId: string) => [...transcriptionKeys.all, 'status', recordingId] as const,
  transcripts: (recordingId: string) => [...transcriptionKeys.all, 'transcripts', recordingId] as const,
  edits: (transcriptId: string) => [...transcriptionKeys.all, 'edits', transcriptId] as const,
  languages: () => [...transcriptionKeys.all, 'languages'] as const,
};

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Get transcription status for a recording (with polling)
 */
export function useTranscriptionStatus(
  recordingId: string,
  options?: Omit<UseQueryOptions<{ recordingId: string; status: string }>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: transcriptionKeys.status(recordingId),
    queryFn: () => transcriptionApi.getTranscriptionStatus(recordingId),
    enabled: !!recordingId,
    // Poll every 10 seconds when status is InProgress
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'Pending' || status === 'InProgress') return 10000;
      return false;
    },
    staleTime: 5000, // 5 seconds
    ...options,
  });
}

/**
 * Get all transcripts (all languages) for a recording
 */
export function useTranscripts(
  recordingId: string,
  options?: Omit<UseQueryOptions<SessionTranscript[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: transcriptionKeys.transcripts(recordingId),
    queryFn: () => transcriptionApi.getTranscripts(recordingId),
    enabled: !!recordingId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
}

/**
 * Get edit history for a transcript
 */
export function useTranscriptEdits(
  transcriptId: string,
  options?: Omit<UseQueryOptions<TranscriptEdit[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: transcriptionKeys.edits(transcriptId),
    queryFn: () => transcriptionApi.getTranscriptEdits(transcriptId),
    enabled: !!transcriptId,
    staleTime: 1 * 60 * 1000, // 1 minute
    ...options,
  });
}

/**
 * Get supported languages for transcription/translation
 */
export function useSupportedLanguages(
  options?: Omit<UseQueryOptions<SupportedLanguage[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: transcriptionKeys.languages(),
    queryFn: () => transcriptionApi.getSupportedLanguages(),
    staleTime: 60 * 60 * 1000, // 1 hour (static list)
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Start transcription for a recording
 */
export function useStartTranscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ recordingId, request }: { recordingId: string; request: StartTranscriptionRequest }) =>
      transcriptionApi.startTranscription(recordingId, request),
    onSuccess: (_, variables) => {
      // Invalidate status to trigger refetch and start polling
      queryClient.invalidateQueries({ queryKey: transcriptionKeys.status(variables.recordingId) });
      queryClient.invalidateQueries({ queryKey: transcriptionKeys.transcripts(variables.recordingId) });
    },
  });
}

/**
 * Start translation for a transcript
 */
export function useStartTranslation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: StartTranslationRequest) => transcriptionApi.startTranslation(request),
    onSuccess: (_, variables) => {
      // Invalidate transcripts to show new translations
      queryClient.invalidateQueries({ queryKey: transcriptionKeys.transcripts(variables.recordingId) });
    },
  });
}

/**
 * Edit a transcript segment (manual correction)
 */
export function useEditTranscript() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: EditTranscriptRequest) => transcriptionApi.editTranscriptSegment(request),
    onSuccess: (data) => {
      // Invalidate transcripts and edits
      queryClient.invalidateQueries({ queryKey: transcriptionKeys.transcripts(data.transcriptId) });
      queryClient.invalidateQueries({ queryKey: transcriptionKeys.edits(data.transcriptId) });
    },
  });
}
