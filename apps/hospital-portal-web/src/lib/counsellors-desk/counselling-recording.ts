export type ConversationRecorderPhase =
  | 'idle'
  | 'recording'
  | 'paused'
  | 'stopping'
  | 'uploading'
  | 'saved'
  | 'failed';

/** Delete uses the existing recording mutation permission and owner check. */
export const RECORDING_DELETE_SUPPORTED = true;

export const RECORDING_REMINDER_DELAY_MS = 120_000;
export const PLAYBACK_SEEK_STEP_SECONDS = 10;

export function recordingDownloadKind(recordingIds: string[]): 'file' | 'archive' | null {
  if (recordingIds.length === 0) return null;
  return recordingIds.length === 1 ? 'file' : 'archive';
}

export function conversationArchiveName(sequenceNumber: number | null): string {
  if (sequenceNumber == null) return 'Counselling-Recordings.zip';
  return `Counselling-Conversation-${sequenceNumber}-Recordings.zip`;
}

export function toggleRecordingSelection(selectedIds: string[], recordingId: string): string[] {
  return selectedIds.includes(recordingId)
    ? selectedIds.filter((id) => id !== recordingId)
    : [...selectedIds, recordingId];
}

export function formatRecordedOn(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function audioFormatLabel(contentType?: string | null): string | null {
  if (!contentType?.trim()) return null;
  const [base, ...params] = contentType.split(';').map((part) => part.trim()).filter(Boolean);
  if (!base) return null;
  const codecs = params.find((part) => part.toLowerCase().startsWith('codecs='))?.slice('codecs='.length).trim();
  return codecs ? `${base} (${codecs})` : base;
}

export function formatFileSize(bytes?: number | null): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface RecordingDetailField {
  label: string;
  value: string;
}

export function recordingDetailFields(input: {
  createdAt: string;
  durationLabel: string;
  counsellorName?: string | null;
  conversationLabel: string;
  status: string;
  recordingId: string;
  sessionLabel?: string | null;
  location?: string | null;
  updatedAt?: string | null;
}): RecordingDetailField[] {
  const recorded = formatRecordedOn(input.createdAt);
  const updated = input.updatedAt ? formatRecordedOn(input.updatedAt) : '';
  const fields: RecordingDetailField[] = [];
  if (recorded) fields.push({ label: 'Recorded on', value: recorded });
  fields.push({ label: 'Duration', value: input.durationLabel });
  if (input.counsellorName) fields.push({ label: 'Counsellor', value: input.counsellorName });
  if (input.sessionLabel) fields.push({ label: 'Session', value: input.sessionLabel });
  fields.push({ label: 'Conversation', value: input.conversationLabel });
  if (input.location) fields.push({ label: 'Location', value: input.location });
  fields.push({ label: 'Status', value: input.status });
  fields.push({ label: 'Recording ID', value: input.recordingId });
  if (recorded) fields.push({ label: 'Created at', value: recorded });
  if (updated) fields.push({ label: 'Updated at', value: updated });
  return fields;
}

export function recordingTechnicalFields(input: {
  contentType?: string | null;
  durationLabel: string;
  recordingId: string;
  createdAt: string;
  fileSizeBytes?: number | null;
  updatedAt?: string | null;
  device?: string | null;
}): RecordingDetailField[] {
  const fields: RecordingDetailField[] = [];
  if (input.device) fields.push({ label: 'Device', value: input.device });
  const format = audioFormatLabel(input.contentType);
  if (format) fields.push({ label: 'Audio format', value: format });
  const size = formatFileSize(input.fileSizeBytes);
  if (size) fields.push({ label: 'File size', value: size });
  fields.push({ label: 'Duration', value: input.durationLabel });
  fields.push({ label: 'Recording ID', value: input.recordingId });
  const recorded = formatRecordedOn(input.createdAt);
  if (recorded) fields.push({ label: 'Created at', value: recorded });
  const updated = input.updatedAt ? formatRecordedOn(input.updatedAt) : '';
  if (updated) fields.push({ label: 'Updated at', value: updated });
  return fields;
}

export interface RecordingPatientFieldsInput {
  patientName?: string | null;
  mrn?: string | null;
  ageLabel?: string | null;
  sex?: string | null;
  eye?: string | null;
}

export function recordingPatientFields(input: RecordingPatientFieldsInput): RecordingDetailField[] {
  const fields: RecordingDetailField[] = [];
  if (input.patientName) fields.push({ label: 'Patient', value: input.patientName });
  if (input.mrn) fields.push({ label: 'MRN', value: input.mrn });
  const ageSex = [input.ageLabel, input.sex].filter(Boolean).join(' · ');
  if (ageSex) fields.push({ label: 'Age / Sex', value: ageSex });
  if (input.eye) fields.push({ label: 'Eye', value: input.eye });
  return fields;
}

export function formatRecordingElapsed(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

export function extensionForAudioType(mimeType: string): string {
  const base = mimeType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (base === 'audio/ogg') return 'ogg';
  if (base === 'audio/mp4') return 'm4a';
  if (base === 'audio/mpeg') return 'mp3';
  if (base === 'audio/wav' || base === 'audio/x-wav') return 'wav';
  return 'webm';
}

/** Page open must not start MediaRecorder. Recording begins only from the click handler. */
export const conversationRecordingStartsAutomatically = false;

export type RecordingNavigationBlock = 'recording' | 'saving';

export function recordingNavigationBlock(
  phase: ConversationRecorderPhase,
): RecordingNavigationBlock | null {
  if (phase === 'recording' || phase === 'paused' || phase === 'stopping') return 'recording';
  if (phase === 'uploading') return 'saving';
  return null;
}

export function resolveRecorderPhase(
  phase: ConversationRecorderPhase,
  mediaState: 'idle' | 'recording' | 'paused' | 'stopped',
): ConversationRecorderPhase {
  if (phase === 'stopping' || phase === 'uploading' || phase === 'saved' || phase === 'failed') {
    return phase;
  }
  if (phase === 'paused' || mediaState === 'paused') return 'paused';
  if (phase === 'recording' || mediaState === 'recording') return 'recording';
  return phase;
}

export function recordingPhaseLabel(phase: ConversationRecorderPhase): string {
  switch (phase) {
    case 'recording':
      return 'Recording';
    case 'paused':
      return 'Paused';
    case 'stopping':
      return 'Stopping';
    case 'uploading':
      return 'Saving';
    case 'saved':
      return 'Saved';
    case 'failed':
      return 'Failed';
    default:
      return 'Ready';
  }
}

export function recordingStateLabel(state: string | null | undefined): string {
  if (state === 'Failed') return 'Failed';
  if (state === 'Created' || state === 'Processing') return 'Saving';
  if (state === 'Uploaded' || state === 'Completed') return 'Saved';
  return 'Saved';
}

export function recordingContentAvailable(state: string | null | undefined): boolean {
  return state === 'Uploaded';
}

export function transcriptStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'Pending':
      return 'Queued';
    case 'InProgress':
      return 'Transcribing';
    case 'Completed':
      return 'Transcript ready';
    case 'Failed':
      return 'Transcription failed';
    default:
      return 'Not started';
  }
}

export function transcriptPlaceholder(status: string | null | undefined): string {
  return transcriptStatusLabel(status);
}

export function shouldPollTranscription(status: string | null | undefined): boolean {
  return status === 'Pending' || status === 'InProgress';
}

export function transcriptionAction(
  transcriptionStatus: string | null | undefined,
  recordingState: string | null | undefined,
): 'start' | 'retry' | 'none' {
  const saved = recordingState === 'Uploaded' || recordingState === 'Completed';
  if (!saved) return 'none';
  if (transcriptionStatus === 'Failed') return 'retry';
  if (!transcriptionStatus || transcriptionStatus === 'NotRequested') return 'start';
  return 'none';
}

export function formatTranscriptTimestamp(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

export function transcriptSpeakerLabel(speaker: string | null | undefined): string | null {
  const match = /^speaker_(\d+)$/.exec(speaker ?? '');
  if (!match) return null;
  return `Speaker ${match[1]}`;
}

export interface TranscriptSegmentView {
  speaker?: string | null;
  startSeconds?: number | null;
  endSeconds?: number | null;
  text: string;
}

export function activeTranscriptSegmentIndex(
  segments: TranscriptSegmentView[],
  seconds: number,
): number {
  if (!Number.isFinite(seconds)) return -1;
  let active = -1;
  segments.forEach((segment, index) => {
    if (segment.startSeconds == null || !Number.isFinite(segment.startSeconds)) return;
    const end = segment.endSeconds ?? segments[index + 1]?.startSeconds;
    if (seconds + 0.001 >= segment.startSeconds && (end == null || seconds < end)) active = index;
  });
  return active;
}

export function transcriptMatchIndexes(segments: TranscriptSegmentView[], query: string): number[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return segments.flatMap((segment, index) => (
    segment.text.toLowerCase().includes(needle) ? [index] : []
  ));
}

export function formatRecordingClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Shows an expiry only when an approved policy already supplied one. Does not invent a period. */
export function approvedRetentionLabel(expiresAt?: string | null): string | null {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;
  return `Available until ${date.toLocaleDateString()}`;
}

export function formatConversationWhen(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toDateString() === now.toDateString()
    ? `Today · ${time}`
    : `${date.toLocaleDateString()} · ${time}`;
}

export function conversationDurationSeconds(
  recordings: Array<{ durationSeconds?: number | null }>,
): number | null {
  if (recordings.length === 0) return null;
  if (recordings.some((r) => r.durationSeconds == null)) return null;
  return recordings.reduce((sum, r) => sum + (r.durationSeconds ?? 0), 0);
}

export function seekPlaybackTime(current: number, delta: number, duration: number): number {
  const span = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const next = (Number.isFinite(current) ? current : 0) + delta;
  return Math.min(span, Math.max(0, next));
}

/** WebM metadata often reports Infinity until the file ends. Keep the known recording length. */
export function resolvePlaybackDuration(mediaDuration: number, knownDuration: number): number {
  if (Number.isFinite(mediaDuration) && mediaDuration > 0) return mediaDuration;
  if (Number.isFinite(knownDuration) && knownDuration > 0) return knownDuration;
  return 0;
}

export function releasePlayback(
  audio: { pause: () => void; removeAttribute: (name: string) => void; load: () => void } | null,
  objectUrl: string | null,
  revoke: (url: string) => void,
): void {
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  if (objectUrl) revoke(objectUrl);
}

export interface ReminderConversation {
  sequenceNumber: number;
  endedAt?: string | null;
  recordings: unknown[];
}

export function interactionReminderKey(conversations: ReminderConversation[]): string {
  const open = conversations.find((c) => !c.endedAt);
  if (open) return `open-${open.sequenceNumber}`;
  const last = conversations[conversations.length - 1];
  return last ? `after-${last.sequenceNumber}` : 'none';
}

export function interactionHasRecording(conversations: ReminderConversation[]): boolean {
  const open = conversations.find((c) => !c.endedAt);
  if (!open) return false;
  return open.recordings.length > 0;
}

export function shouldOfferRecordingReminder(input: {
  eligible: boolean;
  elapsedMs: number;
  dismissedKey: string | null;
  interactionKey: string;
  hasRecording: boolean;
}): boolean {
  if (!input.eligible || input.hasRecording) return false;
  if (input.elapsedMs < RECORDING_REMINDER_DELAY_MS) return false;
  return input.dismissedKey !== input.interactionKey;
}
