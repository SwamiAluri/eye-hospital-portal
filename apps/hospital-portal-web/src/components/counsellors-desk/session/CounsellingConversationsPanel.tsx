'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Download, Info, MessageSquare, Play, Trash2, X } from 'lucide-react';
import {
  CounsellingRecordingDetailsPanel,
  CounsellingRecordingDetailsSheet,
} from '@/components/counsellors-desk/session/CounsellingRecordingDetailsSheet';
import { CounsellingRecordingPlayer } from '@/components/counsellors-desk/session/CounsellingRecordingPlayer';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives/CounsellingButton';
import {
  CounsellingDialog,
  CounsellingDialogContent,
  CounsellingDialogDescription,
  CounsellingDialogHeader,
  CounsellingDialogTitle,
  CounsellingDialogFooter,
} from '@/components/counsellors-desk/session/primitives';
import { CounsellingStatusMessage } from '@/components/counsellors-desk/session/primitives/CounsellingStatusMessage';
import toast from 'react-hot-toast';
import { counsellingRecordingApi } from '@/lib/api/counselling-recording.api';
import { transcriptionApi, type SessionTranscript } from '@/lib/api/transcription.api';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { cn } from '@/lib/utils';
import {
  RECORDING_DELETE_SUPPORTED,
  conversationArchiveName,
  recordingContentAvailable,
  shouldPollTranscription,
  type RecordingPatientFieldsInput,
} from '@/lib/counsellors-desk/counselling-recording';

type History = Awaited<ReturnType<typeof counsellingRecordingApi.list>>;
type Conversation = History['conversations'][number];
type Recording = Conversation['recordings'][number];

const compactIconButton = 'h-8 w-8 min-h-8 shrink-0 rounded-full px-0';

function saveAuthorizedDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function useCompactRecordingDetails() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(max-width: 1023px)');
    const apply = () => setCompact(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);
  return compact;
}

function RecordingHistoryRow({
  recording,
  index,
  active,
  detailsSelected,
  selected,
  onToggle,
  onPlay,
  onViewDetails,
  player,
}: {
  recording: Recording;
  index: number;
  active: boolean;
  detailsSelected: boolean;
  selected: boolean;
  onToggle: () => void;
  onPlay: () => void;
  onViewDetails: () => void;
  player: ReactNode;
}) {
  const label = `Recording ${index + 1}`;
  const playable = recordingContentAvailable(recording.recordingState);
  return (
    <li className={`py-2.5 ${detailsSelected || active ? 'bg-counselling-primary/5' : ''}`} data-testid="counselling-recording-row" data-recording-selected={detailsSelected ? 'true' : 'false'}>
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          className="h-5 w-5 shrink-0 rounded border border-counselling-border accent-counselling-primary focus-visible:outline focus-visible:outline-2"
          aria-label={`Select recording ${index + 1}`}
          checked={selected}
          onChange={onToggle}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 text-sm font-medium text-counselling-foreground">{label}</p>
            {active && playable ? null : (
              <CounsellingButton
                type="button"
                size="sm"
                variant="ghost"
                className={compactIconButton}
                aria-label={`Play recording ${index + 1}`}
                title={`Play recording ${index + 1}`}
                disabled={!playable}
                onClick={() => { if (playable) onPlay(); }}
              >
                <Play className="h-4 w-4" aria-hidden />
              </CounsellingButton>
            )}
            <CounsellingButton
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 min-h-8 px-2"
              aria-label="View recording details"
              title="View recording details"
              aria-pressed={detailsSelected}
              onClick={onViewDetails}
            >
              <Info className="h-4 w-4" aria-hidden />
              View details
            </CounsellingButton>
          </div>
          {active && playable ? <div className="mt-2 min-w-0">{player}</div> : null}
        </div>
      </div>
    </li>
  );
}
export function CounsellingConversationsView({
  conversations,
  playingId,
  detailRecordingId = null,
  selectedIds = [],
  deleteConfirmCount = 0,
  patient,
  sessionLabel,
  onToggle,
  onClearSelection,
  onDownloadSelected,
  onDeleteSelected,
  onConfirmDelete,
  onCancelDelete,
  onDownloadRecording,
  onDeleteRecording,
  onCloseDetails,
  onViewDetails,
  onPlay,
  renderPlayer,
  transcriptLines = null,
  transcriptLoading = false,
  transcriptionBusy = false,
  onStartTranscription,
  onRetryTranscription,
  playbackSeconds = null,
  onSeekTranscript,
}: {
  conversations: Conversation[];
  now?: Date;
  playingId: string | null;
  detailRecordingId?: string | null;
  selectedIds?: string[];
  deleteConfirmCount?: number;
  patient?: RecordingPatientFieldsInput | null;
  sessionLabel?: string | null;
  onCloseDetails?: () => void;
  onToggle?: (recordingId: string) => void;
  onClearSelection?: () => void;
  onDownloadSelected?: () => void;
  onDeleteSelected?: () => void;
  onConfirmDelete?: () => void;
  onCancelDelete?: () => void;
  onDownloadRecording?: (recordingId: string) => void;
  onDeleteRecording?: (recordingId: string) => void;
  onViewDetails?: (recordingId: string) => void;
  onPlay: (recordingId: string) => void;
  renderPlayer?: (recording: Recording, index: number) => ReactNode;
  transcriptLines?: Array<{ speaker?: string | null; startSeconds?: number | null; endSeconds?: number | null; text: string }> | null;
  transcriptLoading?: boolean;
  transcriptionBusy?: boolean;
  onStartTranscription?: () => void;
  onRetryTranscription?: () => void;
  playbackSeconds?: number | null;
  onSeekTranscript?: (seconds: number) => void;
}) {
  const compactDetails = useCompactRecordingDetails();
  const focused = conversations.flatMap((conversation) =>
    conversation.recordings.map((recording, index) => ({ conversation, recording, index })),
  ).find((item) => item.recording.id === detailRecordingId) ?? null;
  const body = conversations.length === 0 ? (
        <CounsellingStatusMessage tone="info" title="No conversations recorded yet." />
      ) : (
        conversations.map((conversation) => {
          return (
            <section
              key={conversation.id}
              data-testid="counselling-conversation-card"
              className={cn(counsellingSessionTokens.sessionWidget, 'overflow-hidden')}
            >
              <header className={cn(counsellingSessionTokens.sessionWidgetPad, 'border-b border-counselling-border/60')} data-testid="counselling-conversation-header">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-counselling-muted text-counselling-foreground" aria-hidden>
                    <MessageSquare className="h-4 w-4" />
                  </span>
                  <h3 className="min-w-0 text-sm font-semibold text-counselling-foreground">
                    Conversation {conversation.sequenceNumber}
                  </h3>
                </div>
              </header>
              {conversation.recordings.length > 0 ? (
                <ul className="divide-y divide-counselling-border/70 border-t border-counselling-border/70 px-4">
                  {conversation.recordings.map((recording, index) => {
                    const active = playingId === recording.id;
                    return (
                      <RecordingHistoryRow
                        key={recording.id}
                        recording={recording}
                        index={index}
                        active={active}
                        detailsSelected={detailRecordingId === recording.id}
                        selected={selectedIds.includes(recording.id)}
                        onToggle={() => onToggle?.(recording.id)}
                        onPlay={() => onPlay(recording.id)}
                        onViewDetails={() => onViewDetails?.(recording.id)}
                        player={renderPlayer?.(recording, index) ?? (
                          <p role="status">Playing recording {index + 1}</p>
                        )}
                      />
                    );
                  })}
                </ul>
              ) : null}
            </section>
          );
        })
      );
  const details = focused ? (
    <CounsellingRecordingDetailsPanel
      title={`Recording ${focused.index + 1}`}
      recording={focused.recording}
      conversationLabel={`Conversation ${focused.conversation.sequenceNumber}`}
      counsellorName={focused.conversation.counsellorName}
      sessionLabel={sessionLabel}
      patient={patient}
      transcriptLines={transcriptLines}
      transcriptLoading={transcriptLoading}
      transcriptionBusy={transcriptionBusy}
      playbackSeconds={playingId === focused.recording.id ? playbackSeconds : null}
      onSeekTranscript={onSeekTranscript}
      onStartTranscription={onStartTranscription}
      onRetryTranscription={onRetryTranscription}
      onDownload={() => onDownloadRecording?.(focused.recording.id)}
      onDelete={() => onDeleteRecording?.(focused.recording.id)}
      onClose={onCloseDetails}
    />
  ) : null;

  return (
    <div
      className={cn(
        'flex min-h-0 w-full min-w-0 flex-1 flex-col',
        focused && 'lg:grid lg:h-full lg:grid-cols-5 lg:items-stretch lg:gap-3',
      )}
      data-testid="counselling-conversations-workspace"
      data-details-open={focused ? 'true' : 'false'}
    >
      <div className={cn('min-w-0 space-y-3', focused && 'lg:col-span-3 lg:self-start')}>
      {selectedIds.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-md border border-counselling-border bg-counselling-muted/30 px-3 py-2"
          data-testid="recording-selection-toolbar"
        >
          <p className="mr-auto text-sm font-medium">{selectedIds.length} selected</p>
          <CounsellingButton type="button" size="sm" variant="outline" aria-label="Download selected recordings" onClick={onDownloadSelected}>
            <Download className="h-4 w-4" aria-hidden />
            Download
          </CounsellingButton>
          {RECORDING_DELETE_SUPPORTED ? (
            <CounsellingButton type="button" size="sm" variant="outline" aria-label="Delete selected recordings" onClick={onDeleteSelected}>
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete
            </CounsellingButton>
          ) : null}
          <CounsellingButton type="button" size="sm" variant="ghost" aria-label="Clear selection" onClick={onClearSelection}>
            <X className="h-4 w-4" aria-hidden />
          </CounsellingButton>
        </div>
      ) : null}
      {body}
      {deleteConfirmCount > 0 ? (
      <CounsellingDialog open onOpenChange={(open) => { if (!open) onCancelDelete?.(); }}>
        <CounsellingDialogContent>
          <CounsellingDialogHeader>
            <CounsellingDialogTitle>
              {deleteConfirmCount === 1 ? 'Delete 1 recording?' : `Delete ${deleteConfirmCount} recordings?`}
            </CounsellingDialogTitle>
            <CounsellingDialogDescription>
              These recordings will no longer be available in this counselling session.
            </CounsellingDialogDescription>
          </CounsellingDialogHeader>
          <CounsellingDialogFooter>
            <CounsellingButton type="button" size="sm" variant="outline" onClick={onCancelDelete}>Cancel</CounsellingButton>
            <CounsellingButton type="button" size="sm" variant="primary" onClick={onConfirmDelete}>
              {deleteConfirmCount === 1 ? 'Delete recording' : 'Delete recordings'}
            </CounsellingButton>
          </CounsellingDialogFooter>
        </CounsellingDialogContent>
      </CounsellingDialog>
      ) : null}
      </div>
      {focused ? (
      <aside
        className="hidden h-full min-h-0 lg:col-span-2 lg:block"
        data-testid="counselling-recording-details-pane"
        aria-label="Recording details"
      >
        {details}
      </aside>
      ) : null}
      {compactDetails && focused ? (
        <CounsellingRecordingDetailsSheet
          open
          onOpenChange={(open) => { if (!open) onCloseDetails?.(); }}
          title={`Recording ${focused.index + 1}`}
          recording={focused.recording}
          conversationLabel={`Conversation ${focused.conversation.sequenceNumber}`}
          counsellorName={focused.conversation.counsellorName}
          sessionLabel={sessionLabel}
          patient={patient}
          transcriptLines={transcriptLines}
          transcriptLoading={transcriptLoading}
          transcriptionBusy={transcriptionBusy}
          playbackSeconds={playingId === focused.recording.id ? playbackSeconds : null}
          onSeekTranscript={onSeekTranscript}
          onStartTranscription={onStartTranscription}
          onRetryTranscription={onRetryTranscription}
          onDownload={() => onDownloadRecording?.(focused.recording.id)}
          onDelete={() => onDeleteRecording?.(focused.recording.id)}
        />
      ) : null}
    </div>
  );
}

export function CounsellingConversationsPanel({
  sessionId,
  patient,
  sessionLabel,
  historyVersion = 0,
}: {
  sessionId: string;
  patient?: RecordingPatientFieldsInput | null;
  sessionLabel?: string | null;
  historyVersion?: number;
}) {
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [detailRecordingId, setDetailRecordingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [transcript, setTranscript] = useState<SessionTranscript | null>(null);
  const [transcriptFor, setTranscriptFor] = useState<string | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptionBusy, setTranscriptionBusy] = useState(false);
  const [playbackSeconds, setPlaybackSeconds] = useState(0);
  const [seekRequest, setSeekRequest] = useState<{ recordingId: string; seconds: number; token: number } | null>(null);

  const detailStatus = (history?.conversations ?? [])
    .flatMap((conversation) => conversation.recordings)
    .find((recording) => recording.id === detailRecordingId)?.transcriptionStatus ?? null;

  const contentAvailable = (recordingId: string) => (history?.conversations ?? []).some((conversation) =>
    conversation.recordings.some((recording) => recording.id === recordingId && recordingContentAvailable(recording.recordingState)),
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPlayingId(null);
    void counsellingRecordingApi.list(sessionId).then((data) => {
      if (!cancelled) {
        setHistory(data);
        setError(null);
        const live = new Set(data.conversations.flatMap((conversation) => conversation.recordings.map((recording) => recording.id)));
        setSelectedIds((current) => current.filter((id) => live.has(id)));
        setDetailRecordingId((current) => (current && live.has(current) ? current : null));
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setError('Conversations could not be loaded.');
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
      setPlayingId(null);
    };
  }, [sessionId, reloadKey]);

  const sessionForRefresh = useRef(sessionId);
  useEffect(() => {
    if (historyVersion === 0) return undefined;
    const sessionChanged = sessionForRefresh.current !== sessionId;
    sessionForRefresh.current = sessionId;
    if (sessionChanged) return undefined;
    let cancelled = false;
    void counsellingRecordingApi.list(sessionId).then((data) => {
      if (cancelled) return;
      setHistory(data);
      setError(null);
      const live = new Set(data.conversations.flatMap((conversation) => conversation.recordings.map((recording) => recording.id)));
      setSelectedIds((current) => current.filter((id) => live.has(id)));
      setDetailRecordingId((current) => (current && live.has(current) ? current : null));
    }).catch(() => {
      if (!cancelled) setError('Conversations could not be loaded.');
    });
    return () => {
      cancelled = true;
    };
  }, [historyVersion, sessionId]);

  useEffect(() => {
    setSelectedIds([]);
    setPendingDeleteIds([]);
    setDetailRecordingId(null);
  }, [sessionId]);

  useEffect(() => {
    if (!detailRecordingId || !shouldPollTranscription(detailStatus)) return undefined;
    let cancelled = false;
    const timer = window.setInterval(() => {
      void transcriptionApi.getTranscriptionStatus(detailRecordingId).then((result) => {
        if (cancelled) return;
        setHistory((current) => {
          if (!current) return current;
          return {
            ...current,
            conversations: current.conversations.map((conversation) => ({
              ...conversation,
              recordings: conversation.recordings.map((recording) => (
                recording.id === detailRecordingId
                  ? { ...recording, transcriptionStatus: result.status }
                  : recording
              )),
            })),
          };
        });
      }).catch(() => undefined);
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [detailRecordingId, detailStatus]);

  useEffect(() => {
    if (!detailRecordingId || detailStatus !== 'Completed') {
      setTranscript(null);
      setTranscriptFor(null);
      setTranscriptLoading(false);
      return undefined;
    }
    let cancelled = false;
    setTranscript(null);
    setTranscriptLoading(true);
    void transcriptionApi.getTranscripts(detailRecordingId).then((rows) => {
      if (cancelled) return;
      setTranscript(rows.find((row) => row.isOriginalLanguage) ?? rows[0] ?? null);
      setTranscriptFor(detailRecordingId);
      setTranscriptLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setTranscript(null);
      setTranscriptFor(detailRecordingId);
      setTranscriptLoading(false);
      toast.error('Transcript could not be loaded.');
    });
    return () => {
      cancelled = true;
    };
  }, [detailRecordingId, detailStatus]);

  const applyTranscriptionStatus = (recordingId: string, status: string) => {
    setHistory((current) => {
      if (!current) return current;
      return {
        ...current,
        conversations: current.conversations.map((conversation) => ({
          ...conversation,
          recordings: conversation.recordings.map((recording) => (
            recording.id === recordingId ? { ...recording, transcriptionStatus: status } : recording
          )),
        })),
      };
    });
  };

  const requestTranscription = async () => {
    if (!detailRecordingId) return;
    setTranscriptionBusy(true);
    try {
      const result = await transcriptionApi.startTranscription(detailRecordingId, {});
      if (result.status === 'Pending' || result.status === 'InProgress' || result.status === 'AlreadyCompleted') {
        applyTranscriptionStatus(
          detailRecordingId,
          result.status === 'AlreadyCompleted' ? 'Completed' : result.status,
        );
        return;
      }
      if (result.status === 'Failed' || result.status === 'NotConfigured') {
        applyTranscriptionStatus(detailRecordingId, 'Failed');
      }
      toast.error('Transcription could not be completed.');
    } catch {
      toast.error('Transcription could not be completed.');
    } finally {
      setTranscriptionBusy(false);
    }
  };

  const archiveSequence = (ids: string[]) => {
    const matches = (history?.conversations ?? []).filter((conversation) =>
      conversation.recordings.some((recording) => ids.includes(recording.id)));
    return matches.length === 1 ? matches[0].sequenceNumber : null;
  };

  const downloadIds = async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      const blob = await counsellingRecordingApi.downloadSelected(sessionId, ids);
      const fileName = ids.length === 1
        ? 'recording.webm'
        : conversationArchiveName(archiveSequence(ids));
      saveAuthorizedDownload(blob, fileName);
      toast.success(ids.length === 1 ? 'Recording download started.' : 'Download started.');
    } catch {
      toast.error('Recording could not be downloaded.');
    }
  };

  const confirmDelete = async () => {
    const ids = pendingDeleteIds;
    if (ids.length === 0) return;
    try {
      const result = await counsellingRecordingApi.deleteSelected(sessionId, ids);
      setPendingDeleteIds([]);
      if (result.deletedCount > 0) {
        if (playingId && ids.includes(playingId)) setPlayingId(null);
        setDetailRecordingId((current) => (current && ids.includes(current) ? null : current));
        setReloadKey((value) => value + 1);
      }
      if (result.deletedCount === 1 && result.failedCount === 1) {
        toast.error('1 recording deleted. 1 could not be deleted.');
      } else if (result.deletedCount > 0 && result.failedCount > 0) {
        toast.error(`${result.deletedCount} recordings deleted. ${result.failedCount} could not be deleted.`);
      } else if (result.deletedCount === 1) {
        toast.success('Recording deleted.');
      } else if (result.deletedCount > 1) {
        toast.success(`${result.deletedCount} recordings deleted.`);
      } else {
        toast.error('Recording could not be deleted.');
      }
    } catch {
      toast.error('Recording could not be deleted.');
    }
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col" data-testid="counselling-conversations-panel">
      {loading ? (
        <CounsellingStatusMessage tone="loading" title="Loading conversations" />
      ) : error ? (
        <CounsellingStatusMessage tone="error" title={error} />
      ) : (
        <CounsellingConversationsView
          conversations={history?.conversations ?? []}
          patient={patient}
          sessionLabel={sessionLabel}
          playingId={playingId}
          detailRecordingId={detailRecordingId}
          selectedIds={selectedIds}
          deleteConfirmCount={pendingDeleteIds.length}
          onToggle={(recordingId) => setSelectedIds((current) => (
            current.includes(recordingId)
              ? current.filter((id) => id !== recordingId)
              : [...current, recordingId]
          ))}
          onClearSelection={() => setSelectedIds([])}
          onDownloadSelected={() => { void downloadIds(selectedIds); }}
          onDeleteSelected={() => setPendingDeleteIds(selectedIds)}
          onConfirmDelete={() => { void confirmDelete(); }}
          onCancelDelete={() => setPendingDeleteIds([])}
          onDownloadRecording={(recordingId) => { void downloadIds([recordingId]); }}
          onDeleteRecording={(recordingId) => setPendingDeleteIds([recordingId])}
          onCloseDetails={() => setDetailRecordingId(null)}
          onViewDetails={(recordingId) => {
            setDetailRecordingId(recordingId);
            setPlayingId(contentAvailable(recordingId) ? recordingId : null);
          }}
          onPlay={(recordingId) => {
            if (contentAvailable(recordingId)) setPlayingId(recordingId);
          }}
          renderPlayer={(recording, index) => (
            recordingContentAvailable(recording.recordingState) ? (
              <CounsellingRecordingPlayer
                sessionId={sessionId}
                recordingId={recording.id}
                knownDurationSeconds={recording.durationSeconds}
                controlName={`Recording ${index + 1}`}
                seekRequest={seekRequest?.recordingId === recording.id ? seekRequest : null}
                onPosition={(seconds) => {
                  if (playingId === recording.id) setPlaybackSeconds(seconds);
                }}
              />
            ) : null
          )}
          transcriptLines={
            transcript && transcriptFor === detailRecordingId
              ? (transcript.segments?.length
                ? transcript.segments.map((segment) => ({
                  speaker: segment.speaker,
                  startSeconds: segment.start,
                  endSeconds: segment.end,
                  text: segment.text,
                }))
                : [{ text: transcript.transcriptText }])
              : null
          }
          transcriptLoading={transcriptLoading}
          transcriptionBusy={transcriptionBusy}
          playbackSeconds={playbackSeconds}
          onSeekTranscript={(seconds) => {
            if (!detailRecordingId || !contentAvailable(detailRecordingId)) return;
            setPlayingId(detailRecordingId);
            setSeekRequest({ recordingId: detailRecordingId, seconds, token: Date.now() });
          }}
          onStartTranscription={() => { void requestTranscription(); }}
          onRetryTranscription={() => { void requestTranscription(); }}
        />
      )}
    </div>
  );
}
